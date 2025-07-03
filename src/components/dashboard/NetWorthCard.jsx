import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Wallet, PiggyBank } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { convertCurrency, useCurrencyConversion } from "../utils/CurrencyConverter";
// import { useToast } from "@/components/ui/use-toast"; // Exemplo se fosse adicionar toast de erro

export default function NetWorthCard({ netWorth, accounts, isLoading }) {
  const navigate = useNavigate();
  const [convertedNetWorth, setConvertedNetWorth] = useState(0);
  const { isLoading: isConverting, preloadExchangeRates: preloadRatesFromHook } = useCurrencyConversion();
  // const { toast } = useToast(); // Exemplo se fosse adicionar toast de erro

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  useEffect(() => {
    const localPreloadExchangeRates = preloadRatesFromHook;

    const calculateConvertedNetWorth = async () => {
      // Se o dashboard ainda está carregando ou não há contas, define patrimônio como 0 e retorna.
      if (isLoading || !accounts?.length) {
        setConvertedNetWorth(0); // Zerar se não há contas ou se dados do dashboard estão carregando
        return;
      }
      
      const uniqueCurrencies = [...new Set(accounts.map(acc => acc.currency || 'BRL'))];
      const foreignCurrencies = uniqueCurrencies.filter(curr => curr !== 'BRL');
      
      if (foreignCurrencies.length > 0) {
        await localPreloadExchangeRates(foreignCurrencies);
      }

      let totalInBRL = 0;

      try {
        const conversionPromises = accounts
          .filter(acc => acc.is_active !== false)
          .map(async (account) => {
            // Usar explicitamente initial_balance para consistência com outros cálculos de saldo.
            const balance = parseFloat(account.initial_balance || 0);
            const currency = account.currency || 'BRL';
            
            if (currency === 'BRL') {
              return balance;
            } else {
              const convertedBalance = await convertCurrency(balance, currency, 'BRL');
              return convertedBalance;
            }
          });

        const convertedBalances = await Promise.all(conversionPromises);
        totalInBRL = convertedBalances.reduce((sum, balance) => sum + (balance || 0), 0);
        
        setConvertedNetWorth(totalInBRL);
      } catch (error) {
        console.error('Erro ao converter patrimônio líquido:', error);
        // Em caso de erro, zerar o patrimônio ou mostrar um estado de erro em vez de fallback para prop não convertida.
        setConvertedNetWorth(0);
        // Poderia também definir um estado de erro para exibir uma mensagem ao usuário.
        // toast({ title: "Erro ao calcular patrimônio", description: "Não foi possível converter todos os valores.", variant: "destructive" });
      }
    };

    calculateConvertedNetWorth();
  }, [accounts, netWorth, isLoading, preloadRatesFromHook]);

  const activeAccounts = accounts ? accounts.filter(acc => acc.is_active !== false) : [];
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