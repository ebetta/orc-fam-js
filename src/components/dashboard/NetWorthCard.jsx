import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Wallet, PiggyBank } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { convertCurrency, useCurrencyConversion } from "../utils/CurrencyConverter";
// import { useToast } from "@/components/ui/use-toast";

export default function NetWorthCard({ netWorth, accounts, isLoading, transactions }) { // Adicionada prop transactions
  const navigate = useNavigate();
  const [convertedNetWorth, setConvertedNetWorth] = useState(0);
  const { isLoading: isConverting, preloadExchangeRates: preloadRatesFromHook } = useCurrencyConversion();
  // const { toast } = useToast();

  // Log inicial de props ao renderizar ou quando props mudam
  console.log('[NetWorthCard] Props recebidas:', { netWorth, accounts, isLoading, transactions });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  useEffect(() => {
    console.log('[NetWorthCard useEffect] Iniciando. Props atuais:', { isLoadingProp: isLoading, accountsProp: accounts, netWorthProp: netWorth });
    const localPreloadExchangeRates = preloadRatesFromHook;

    const calculateConvertedNetWorth = async () => {
      console.log('[NetWorthCard calculateConvertedNetWorth] Iniciando cálculo.');
      // A guarda agora também pode verificar transactions se for essencial para o cálculo
      if (isLoading || !accounts?.length /* || !transactions?.length */) { // Adicionar !transactions?.length se for crítico
        console.log('[NetWorthCard calculateConvertedNetWorth] Condição de guarda atingida:', { isLoading, hasAccounts: !!accounts?.length, hasTransactions: !!transactions?.length });
        setConvertedNetWorth(0);
        return;
      }
      
      const uniqueCurrencies = [...new Set(accounts.map(acc => acc.currency || 'BRL'))];
      const foreignCurrencies = uniqueCurrencies.filter(curr => curr !== 'BRL');
      console.log('[NetWorthCard calculateConvertedNetWorth] Moedas estrangeiras para preload:', foreignCurrencies);
      
      if (foreignCurrencies.length > 0) {
        try {
            console.log('[NetWorthCard calculateConvertedNetWorth] Preloading rates...');
            await localPreloadExchangeRates(foreignCurrencies);
            console.log('[NetWorthCard calculateConvertedNetWorth] Preloading rates concluído.');
        } catch (preloadError) {
            console.error('[NetWorthCard calculateConvertedNetWorth] Erro durante preloadExchangeRates:', preloadError);
            // Continuar mesmo se o preload falhar, convertCurrency tentará buscar individualmente.
        }
      }

      let totalInBRL = 0;

      try {
        console.log('[NetWorthCard calculateConvertedNetWorth] Processando contas:', accounts.filter(acc => acc.is_active !== false));
        const conversionPromises = accounts
          .filter(acc => acc.is_active !== false)
          .map(async (account, index) => {
            console.log(`[NetWorthCard map account ${index}] Conta:`, account);

            // Calcular saldo atual da conta
            let currentAccountBalance = parseFloat(account.initial_balance); // Já tratado para ser 0 se null/NaN no Dashboard.jsx
            if (isNaN(currentAccountBalance)) currentAccountBalance = 0; // Segurança adicional

            const accountCurrency = account.currency || 'BRL';
            console.log(`[NetWorthCard map account ${index}] Saldo Inicial Processado: ${currentAccountBalance}, Moeda: ${accountCurrency}`);

            if (transactions && transactions.length > 0) {
              transactions.forEach(t => {
                // Não precisamos filtrar por data aqui, pois queremos o saldo ATUAL
                const amount = parseFloat(t.amount || 0);
                if (t.account_id === account.id) { // Transação originada desta conta
                  if (t.transaction_type === 'income') currentAccountBalance += amount;
                  else if (t.transaction_type === 'expense') currentAccountBalance -= amount;
                  else if (t.transaction_type === 'transfer') currentAccountBalance -= amount; // Saída por transferência
                }
                if (t.destination_account_id === account.id) { // Transação destinada a esta conta
                  if (t.transaction_type === 'transfer') currentAccountBalance += amount; // Entrada por transferência
                }
              });
            }
            console.log(`[NetWorthCard map account ${index}] Saldo Atual (após transações): ${currentAccountBalance}`);
            
            if (accountCurrency === 'BRL') {
              console.log(`[NetWorthCard map account ${index}] Moeda BRL, retornando saldo atual: ${currentAccountBalance}`);
              return currentAccountBalance;
            } else {
              console.log(`[NetWorthCard map account ${index}] Convertendo ${currentAccountBalance} ${accountCurrency} para BRL...`);
              const convertedBalance = await convertCurrency(currentAccountBalance, accountCurrency, 'BRL');
              console.log(`[NetWorthCard map account ${index}] Convertido para BRL: ${convertedBalance}`);
              return convertedBalance;
            }
          });

        const convertedBalances = await Promise.all(conversionPromises);
        console.log('[NetWorthCard calculateConvertedNetWorth] Saldos convertidos (array):', convertedBalances);

        totalInBRL = convertedBalances.reduce((sum, balance) => {
            const currentVal = balance || 0;
            console.log(`[NetWorthCard reduce] sum: ${sum}, currentVal: ${currentVal}`);
            return sum + currentVal;
        }, 0);
        console.log('[NetWorthCard calculateConvertedNetWorth] Total em BRL (após reduce):', totalInBRL);
        
        setConvertedNetWorth(totalInBRL);
      } catch (error) {
        console.error('[NetWorthCard calculateConvertedNetWorth] Erro ao converter patrimônio líquido:', error);
        setConvertedNetWorth(0);
        // toast({ title: "Erro ao calcular patrimônio", description: "Não foi possível converter todos os valores.", variant: "destructive" });
      }
    };

    calculateConvertedNetWorth();
  // Adicionar transactions às dependências
  }, [accounts, isLoading, preloadRatesFromHook, transactions]);

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