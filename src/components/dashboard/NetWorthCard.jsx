import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Wallet, PiggyBank } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { convertCurrency, useCurrencyConversion } from "../utils/CurrencyConverter";
// import { useToast } from "@/components/ui/use-toast";

export default function NetWorthCard({ accounts, isLoading, customNetWorth }) {
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
      if (customNetWorth !== undefined && customNetWorth !== null) {
        setConvertedNetWorth(customNetWorth);
        return;
      }

      if (isLoading || !accounts?.length) {
        setConvertedNetWorth(0);
        return;
      }

      // Preload exchange rates for foreign currencies
      const uniqueCurrencies = [...new Set(accounts.map(acc => acc.currency || 'BRL'))];
      const foreignCurrencies = uniqueCurrencies.filter(curr => curr !== 'BRL');
      if (foreignCurrencies.length > 0) {
        try {
          await preloadExchangeRates(foreignCurrencies);
        } catch (preloadError) {
          console.error('Erro durante preloadExchangeRates:', preloadError);
        }
      }

      let totalInBRL = 0;

      try {
        const conversionPromises = accounts
          .filter(acc => acc.is_active !== false)
          .map(async (account) => {
            const balance = account.current_balance ?? account.initial_balance ?? 0;
            const currency = account.currency || 'BRL';

            const convertedBalance = await convertCurrency(balance, currency, 'BRL');

            // Credit cards are liabilities, so their absolute value should always be subtracted
            if (account.account_type === 'credit_card') {
              return -Math.abs(convertedBalance);
            }
            return convertedBalance;
          });

        const convertedBalances = await Promise.all(conversionPromises);

        totalInBRL = convertedBalances.reduce((sum, balance) => sum + balance, 0);

        setConvertedNetWorth(totalInBRL);
      } catch (error) {
        console.error('Erro ao converter patrimônio líquido:', error);
        setConvertedNetWorth(0);
      }
    };

    calculateConvertedNetWorth();
  }, [accounts, isLoading, preloadExchangeRates, customNetWorth]);

  const activeAccounts = accounts ? accounts.filter(acc => acc.is_active !== false) : [];
  const totalAccounts = activeAccounts.length;

  const handleNetWorthClick = () => {
    navigate(createPageUrl("Transactions") + "?accountId=all");
  };

  return (
    <Card className="bg-white shadow-lg border-0 overflow-hidden h-full flex flex-col">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b py-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <div className="p-1.5 bg-blue-100 rounded-lg">
                <Wallet className="w-4 h-4 text-blue-600" />
              </div>
              Patrimônio Líquido
            </CardTitle>
            <p className="text-gray-500 text-xs mt-0.5">Saldo total convertido para BRL</p>
          </div>
          <div className="p-2 bg-blue-500 rounded-full">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 flex-grow flex flex-col justify-center">
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
              className={`text-3xl font-bold mb-2 cursor-pointer hover:text-blue-600 transition-colors duration-200 ${convertedNetWorth < 0 ? 'text-red-600' : 'text-gray-900'}`}
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