import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Wallet, PiggyBank } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { convertCurrency, useCurrencyConversion } from "../utils/CurrencyConverter";

export default function NetWorthCard({ netWorth, accounts, isLoading }) {
  const navigate = useNavigate();
  const [convertedNetWorth, setConvertedNetWorth] = useState(0);
  const { isLoading: isConverting, preloadExchangeRates } = useCurrencyConversion();

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  useEffect(() => {
    const calculateConvertedNetWorth = async () => {
      if (isLoading || !accounts?.length) return;
      
      // Pré-carregar cotações das moedas utilizadas
      const uniqueCurrencies = [...new Set(accounts.map(acc => acc.currency || 'BRL'))];
      const foreignCurrencies = uniqueCurrencies.filter(curr => curr !== 'BRL');
      
      if (foreignCurrencies.length > 0) {
        await preloadExchangeRates(foreignCurrencies);
      }

      let totalInBRL = 0;

      try {
        // Processar contas em paralelo para melhor performance
        const conversionPromises = accounts
          .filter(acc => acc.is_active !== false)
          .map(async (account) => {
            const balance = account.current_balance || account.initial_balance || 0;
            const currency = account.currency || 'BRL';
            
            if (currency === 'BRL') {
              return balance;
            } else {
              const convertedBalance = await convertCurrency(balance, currency, 'BRL');
              return convertedBalance;
            }
          });

        const convertedBalances = await Promise.all(conversionPromises);
        totalInBRL = convertedBalances.reduce((sum, balance) => sum + balance, 0);
        
        setConvertedNetWorth(totalInBRL);
      } catch (error) {
        console.error('Erro ao converter patrimônio líquido:', error);
        setConvertedNetWorth(netWorth); // Fallback para valor não convertido
      }
    };

    calculateConvertedNetWorth();
  }, [accounts, netWorth, isLoading, preloadExchangeRates]);

  const activeAccounts = accounts.filter(acc => acc.is_active !== false);
  const totalAccounts = activeAccounts.length;

  const handleNetWorthClick = () => {
    navigate(createPageUrl("Transactions") + "?accountId=all");
  };

  return (
    <Card className="bg-white shadow-lg border-0 overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Wallet className="w-5 h-5 text-blue-600" />
              </div>
              Patrimônio Líquido
            </CardTitle>
            <p className="text-gray-600 mt-1">Saldo total convertido para BRL</p>
          </div>
          <div className="p-3 bg-blue-500 rounded-full">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-8">
        {isLoading || isConverting ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-12 w-48" />
              {isConverting && (
                <div className="text-xs text-blue-600 flex items-center gap-1">
                  <div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin" />
                  Convertendo...
                </div>
              )}
            </div>
            <Skeleton className="h-6 w-32" />
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div 
              className={`text-4xl font-bold mb-2 cursor-pointer hover:text-blue-600 transition-colors duration-200 ${convertedNetWorth < 0 ? 'text-red-600' : 'text-gray-900'}`}
              onClick={handleNetWorthClick}
              title="Clique para ver todas as transações"
            >
              {formatCurrency(convertedNetWorth)}
            </div>
            <div className="flex items-center gap-4 text-gray-600">
              <div className="flex items-center gap-2">
                <PiggyBank className="w-4 h-4" />
                <span className="text-sm">
                  {totalAccounts} conta{totalAccounts !== 1 ? 's' : ''} ativa{totalAccounts !== 1 ? 's' : ''}
                </span>
              </div>
              {convertedNetWorth > 0 && (
                <div className="flex items-center gap-1 text-green-600">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm font-medium">Patrimônio positivo</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}