import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabaseClient";
import { convertCurrency, formatCurrencyWithSymbol } from "@/components/utils/CurrencyConverter";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import {
  Landmark, // Ícone para o card principal
  CreditCard,
  Wallet,
  PiggyBank,
  TrendingUp,
  Banknote,
} from "lucide-react";

// Configuração dos ícones para tipos de conta (similar ao AccountsGrid)
const accountTypeIcons = {
  checking: Wallet,
  savings: PiggyBank,
  credit_card: CreditCard,
  investment: TrendingUp,
  cash: Banknote,
  default: Wallet, // Ícone padrão
};

const calculateAccountBalanceAndDetails = async (account, allTransactions, accountsData, convertCurrencyFn) => {
  let currentBalanceInAccountCurrency = parseFloat(account.initial_balance) || 0;
  const accountCurrency = account.currency;

  const accountCurrencyMap = new Map(accountsData.map(acc => [acc.id, acc.currency]));

  for (const transaction of allTransactions) {
    const transactionAmount = parseFloat(transaction.amount);
    if (isNaN(transactionAmount)) continue;

    let amountEffect = 0;
    let transactionConsidered = false;

    if (transaction.account_id === account.id) {
      transactionConsidered = true;
      const transactionCurrency = accountCurrencyMap.get(transaction.account_id) || 'BRL';
      let amountInAccountCurrency = transactionAmount;
      if (transactionCurrency !== accountCurrency) {
        amountInAccountCurrency = await convertCurrencyFn(transactionAmount, transactionCurrency, accountCurrency, transaction.transaction_date);
      }
      if (transaction.transaction_type === "income") amountEffect = amountInAccountCurrency;
      else if (transaction.transaction_type === "expense") amountEffect = -amountInAccountCurrency;
      else if (transaction.transaction_type === "transfer") amountEffect = -amountInAccountCurrency;
    } else if (transaction.destination_account_id === account.id && transaction.transaction_type === "transfer") {
      transactionConsidered = true;
      const sourceAccountCurrency = accountCurrencyMap.get(transaction.account_id) || 'BRL';
      let amountInAccountCurrency = transactionAmount;
      if (sourceAccountCurrency !== accountCurrency) {
        amountInAccountCurrency = await convertCurrencyFn(transactionAmount, sourceAccountCurrency, accountCurrency, transaction.transaction_date);
      }
      amountEffect = amountInAccountCurrency;
    }

    if (transactionConsidered) {
      currentBalanceInAccountCurrency += amountEffect;
    }
  }

  let balanceInBRL = currentBalanceInAccountCurrency;
  if (accountCurrency !== "BRL") {
    balanceInBRL = await convertCurrencyFn(currentBalanceInAccountCurrency, accountCurrency, "BRL", null);
  }

  return {
    balanceInBRL, // Saldo final para exibição principal (sempre em BRL)
    original_balance: currentBalanceInAccountCurrency, // Saldo na moeda original da conta
    original_currency: accountCurrency, // Moeda original da conta
    account_type: account.account_type, // Tipo da conta para o ícone
  };
};


export default function AccountBalancesSummary({ accounts }) {
  const [accountBalances, setAccountBalances] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAllDataAndCalculateBalances = async () => {
      setIsLoading(true);

      if (!accounts || accounts.length === 0) {
        setAccountBalances([]);
        setIsLoading(false);
        return;
      }

      const { data: allTransactions, error: transactionsError } = await supabase
        .from("transactions")
        .select("*");

      if (transactionsError) {
        console.error("Erro ao buscar transações:", transactionsError);
        setAccountBalances(accounts.map(acc => ({
          id: acc.id,
          name: acc.name,
          balance: 0,
          currency: "BRL", // Exibição principal em BRL
          original_balance: 0,
          original_currency: acc.currency,
          account_type: acc.account_type,
          error: "Erro ao calcular saldo"
        })));
        setIsLoading(false);
        return;
      }

      const balancesPromises = accounts.map(async (account) => {
        const details = await calculateAccountBalanceAndDetails(account, allTransactions || [], accounts, convertCurrency);
        return {
          id: account.id,
          name: account.name,
          balance: details.balanceInBRL, // Para exibição principal
          currency: "BRL", // Moeda da exibição principal
          original_balance: details.original_balance,
          original_currency: details.original_currency,
          account_type: details.account_type,
        };
      });

      try {
        const resolvedBalances = await Promise.all(balancesPromises);
        resolvedBalances.sort((a, b) => a.name.localeCompare(b.name));
        setAccountBalances(resolvedBalances);
      } catch (error) {
        console.error("Erro ao resolver promessas de cálculo de saldo:", error);
        setAccountBalances(accounts.map(acc => ({
          id: acc.id,
          name: acc.name,
          balance: 0,
          currency: "BRL",
          original_balance: 0,
          original_currency: acc.currency,
          account_type: acc.account_type,
          error: "Erro no cálculo"
        })));
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllDataAndCalculateBalances();
  }, [accounts]);

  const handleAccountCardClick = (accountId) => {
    navigate(`/transactions?accountId=${accountId}`);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-xl font-semibold text-gray-700">
            <Landmark className="w-6 h-6 mr-3 text-blue-600" />
            Saldo Atual das Contas
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="p-4 flex flex-col justify-between" style={{ minHeight: '110px' }}>
              <div> {/* Skeleton para o título */}
                <Skeleton className="h-6 w-3/4 mb-2" />
              </div>
              <div className="mt-auto pt-2"> {/* Skeleton para a área de valores */}
                <Skeleton className="h-8 w-1/2 mb-1" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </Card>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!accounts || accounts.length === 0) {
    return null;
  }

  return (
    <Card className="shadow-lg border-gray-200">
      <CardHeader>
        <CardTitle className="flex items-center text-xl font-semibold text-gray-700">
          <Landmark className="w-6 h-6 mr-3 text-blue-600" /> {/* Ícone do Card Principal */}
          Saldo Atual das Contas
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {accountBalances.map((account) => {
          const AccountIcon = accountTypeIcons[account.account_type] || accountTypeIcons.default;
          const isNegative = account.balance < 0;
          const showOriginalBalance = account.original_currency !== "BRL";

          return (
            <motion.div
              key={account.id}
              whileHover={{ scale: 1.05, boxShadow: "0px 5px 15px rgba(0,0,0,0.1)" }}
              whileTap={{ scale: 0.98 }}
              className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm hover:shadow-md cursor-pointer flex flex-col justify-between h-full"
              onClick={() => handleAccountCardClick(account.id)}
              style={{ minHeight: '110px' }} // Ajustar altura mínima se necessário
            >
              <div>
                <div className="flex justify-between items-start">
                  <h4 className="text-md font-medium text-blue-600 truncate pr-2" title={account.name}>
                    {account.name}
                  </h4>
                  <AccountIcon className="w-5 h-5 text-gray-400" />
                </div>
              </div>
              <div className="mt-auto pt-2"> {/* Use mt-auto para empurrar para baixo, pt-2 para espaço do título */}
                <p className={`text-lg font-bold ${isNegative ? 'text-red-600' : 'text-gray-800'}`}>
                  {formatCurrencyWithSymbol(account.balance, account.currency)} {/* Saldo em BRL */}
                </p>
                {showOriginalBalance && (
                  <p className="text-xs text-gray-500 mt-0.5"> {/* Ajuste de margem se necessário */}
                    ({formatCurrencyWithSymbol(account.original_balance, account.original_currency)})
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
}
