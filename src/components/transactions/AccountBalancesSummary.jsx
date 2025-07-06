import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabaseClient";
import { convertCurrency, formatCurrencyWithSymbol } from "@/components/utils/CurrencyConverter";
import { Skeleton } from "@/components/ui/skeleton"; // Para feedback de carregamento
import { motion } from "framer-motion"; // Importar motion

const calculateAccountBalance = async (account, allTransactions, accountsData, convertCurrencyFn) => {
  let currentBalance = parseFloat(account.initial_balance) || 0;
  const accountCurrency = account.currency;

  // Mapeamento para buscar a moeda da conta de origem de uma transferência
  const accountCurrencyMap = new Map(accountsData.map(acc => [acc.id, acc.currency]));

  for (const transaction of allTransactions) {
    const transactionAmount = parseFloat(transaction.amount);
    if (isNaN(transactionAmount)) continue; // Pular transação se o valor for inválido

    let amountEffect = 0;
    let transactionConsidered = false;

    // Lógica para transações normais (receita, despesa) e SAÍDA de transferência
    if (transaction.account_id === account.id) {
      transactionConsidered = true;
      const transactionCurrency = accountCurrencyMap.get(transaction.account_id) || 'BRL'; // Moeda da transação (da conta de origem)

      let amountInAccountCurrency = transactionAmount;
      if (transactionCurrency !== accountCurrency) {
        // Converte o valor da transação para a moeda da conta ATUAL para cálculo do saldo
        // Usa a data da transação para a cotação correta
        amountInAccountCurrency = await convertCurrencyFn(transactionAmount, transactionCurrency, accountCurrency, transaction.transaction_date);
      }

      if (transaction.transaction_type === "income") {
        amountEffect = amountInAccountCurrency;
      } else if (transaction.transaction_type === "expense") {
        amountEffect = -amountInAccountCurrency;
      } else if (transaction.transaction_type === "transfer") {
        // Saída da transferência
        amountEffect = -amountInAccountCurrency;
      }
    }
    // Lógica para ENTRADA de transferência
    else if (transaction.destination_account_id === account.id && transaction.transaction_type === "transfer") {
      transactionConsidered = true;
      // Para transferências recebidas, a transação é registrada na conta de origem.
      // O 'amount' da transação está na moeda da conta de ORIGEM.
      const sourceAccountCurrency = accountCurrencyMap.get(transaction.account_id) || 'BRL';

      let amountInAccountCurrency = transactionAmount;
      if (sourceAccountCurrency !== accountCurrency) {
        // Converte o valor da transferência (que está na moeda da conta de origem)
        // para a moeda da conta de DESTINO (a conta atual)
        // Usa a data da transação para a cotação correta
        amountInAccountCurrency = await convertCurrencyFn(transactionAmount, sourceAccountCurrency, accountCurrency, transaction.transaction_date);
      }
      amountEffect = amountInAccountCurrency;
    }

    if (transactionConsidered) {
      currentBalance += amountEffect;
    }
  }

  // Após calcular o saldo na moeda da conta, converter para BRL se necessário para exibição
  if (accountCurrency !== "BRL") {
    return await convertCurrencyFn(currentBalance, accountCurrency, "BRL", null); // null para taxa mais recente
  }

  return currentBalance;
};


export default function AccountBalancesSummary({ accounts }) {
  const [accountBalances, setAccountBalances] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  // Não precisamos mais de allTransactions no estado do componente, pois será buscado dentro de calculateBalances
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAllDataAndCalculateBalances = async () => {
      setIsLoading(true);

      if (!accounts || accounts.length === 0) {
        setAccountBalances([]);
        setIsLoading(false);
        return;
      }

      // Buscar todas as transações uma única vez
      const { data: allTransactions, error: transactionsError } = await supabase
        .from("transactions")
        .select("*");

      if (transactionsError) {
        console.error("Erro ao buscar transações:", transactionsError);
        setAccountBalances(accounts.map(acc => ({
          id: acc.id,
          name: acc.name,
          balance: 0, // Ou algum valor de erro/fallback
          currency: "BRL",
          error: "Erro ao calcular saldo"
        })));
        setIsLoading(false);
        return;
      }

      const balancesPromises = accounts.map(async (account) => {
        const balance = await calculateAccountBalance(account, allTransactions || [], accounts, convertCurrency);
        return {
          id: account.id,
          name: account.name,
          balance: balance,
          currency: "BRL",
        };
      });

      try {
        const resolvedBalances = await Promise.all(balancesPromises);
        resolvedBalances.sort((a, b) => a.name.localeCompare(b.name));
        setAccountBalances(resolvedBalances);
      } catch (error) {
        console.error("Erro ao resolver promessas de cálculo de saldo:", error);
        // Tratar erro de cálculo individual aqui se necessário
        setAccountBalances(accounts.map(acc => ({
          id: acc.id,
          name: acc.name,
          balance: 0,
          currency: "BRL",
          error: "Erro no cálculo"
        })));
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllDataAndCalculateBalances();
  }, [accounts]); // Dependência apenas em 'accounts'

  const handleAccountCardClick = (accountId) => {
    navigate(`/transactions?accountId=${accountId}`);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Saldo Atual das Contas</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(3)].map((_, i) => ( // Mostrar 3 skeletons como placeholder
            <Card key={i} className="p-4">
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-8 w-1/2" />
            </Card>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!accounts || accounts.length === 0) {
    return null; // Não renderizar nada se não houver contas
  }

  return (
    <Card className="shadow-lg border-gray-200">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-gray-700">Saldo Atual das Contas</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {accountBalances.map((account) => (
          <motion.div
            key={account.id}
            whileHover={{ scale: 1.05, boxShadow: "0px 5px 15px rgba(0,0,0,0.1)" }}
            whileTap={{ scale: 0.98 }}
            className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm hover:shadow-md cursor-pointer flex flex-col justify-between h-full"
            onClick={() => handleAccountCardClick(account.id)}
            style={{ minHeight: '100px' }} // Garante uma altura mínima
          >
            <div>
              <h4 className="text-md font-medium text-blue-600 truncate" title={account.name}>
                {account.name}
              </h4>
            </div>
            <div>
              <p className="text-lg font-bold text-gray-800">
                {formatCurrencyWithSymbol(account.balance, account.currency)}
              </p>
            </div>
          </motion.div>
        ))}
      </CardContent>
    </Card>
  );
}
