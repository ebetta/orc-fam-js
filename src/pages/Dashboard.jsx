
import React, { useState, useEffect } from "react";
import { Account } from "@/api/entities";
import { Transaction } from "@/api/entities";
import { Tag } from "@/api/entities";
import { User } from "@/api/entities";
import { motion } from "framer-motion";
import { useCurrencyConversion } from "../components/utils/CurrencyConverter";

import WelcomeCard from "../components/dashboard/WelcomeCard";
import NetWorthCard from "../components/dashboard/NetWorthCard";
import AccountsList from "../components/dashboard/AccountsList";
import RecentTransactions from "../components/dashboard/RecentTransactions";
import ExpensesChart from "../components/dashboard/ExpensesChart";
import PatrimonyEvolutionChart from "../components/dashboard/PatrimonyEvolutionChart";

export default function Dashboard() {
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]);
  const [tags, setTags] = useState([]);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { preloadExchangeRates } = useCurrencyConversion();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      // Carregar dados com controle de rate limit
      const [userData] = await Promise.all([
        User.me().catch(err => {
          console.error("Erro ao carregar usuário:", err);
          return null;
        })
      ]);
      
      setUser(userData);

      // Carregar contas primeiro
      const accountsData = await Account.list("-updated_date").catch(err => {
        console.error("Erro ao carregar contas:", err);
        return [];
      });
      setAccounts(accountsData);

      // Aguardar um pouco antes da próxima chamada
      await new Promise(resolve => setTimeout(resolve, 200));

      // Carregar transações com limite menor para o dashboard
      const recentTransactionsData = await Transaction.list("-transaction_date", 5).catch(err => {
        console.error("Erro ao carregar transações recentes:", err);
        return [];
      });
      setTransactions(recentTransactionsData);

      // Aguardar um pouco antes da próxima chamada
      await new Promise(resolve => setTimeout(resolve, 200));

      // Carregar todas as transações para gráficos (com limite razoável)
      const allTransactionsData = await Transaction.list("-transaction_date", 500).catch(err => {
        console.error("Erro ao carregar todas as transações:", err);
        return [];
      });
      setAllTransactions(allTransactionsData);

      // Aguardar um pouco antes da próxima chamada
      await new Promise(resolve => setTimeout(resolve, 200));

      const tagsData = await Tag.list().catch(err => {
        console.error("Erro ao carregar tags:", err);
        return [];
      });
      setTags(tagsData);

      // Pré-carregar cotações das moedas utilizadas nas contas
      if (accountsData.length > 0) {
        const uniqueCurrencies = [...new Set(accountsData.map(acc => acc.currency || 'BRL'))];
        const foreignCurrencies = uniqueCurrencies.filter(curr => curr !== 'BRL');
        
        if (foreignCurrencies.length > 0) {
          console.log('Pré-carregando cotações para:', foreignCurrencies);
          await preloadExchangeRates(foreignCurrencies);
        }
      }

    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
    setIsLoading(false);
  };

  const calculateNetWorth = () => {
    return accounts.reduce((total, account) => {
      if (account.is_active === false) return total;
      return total + (account.current_balance || account.initial_balance || 0);
    }, 0);
  };

  const getAccountsByType = () => {
    const activeAccounts = accounts.filter(acc => acc.is_active !== false);
    const groupedAccounts = {
      checking: activeAccounts.filter(acc => acc.account_type === 'checking'),
      savings: activeAccounts.filter(acc => acc.account_type === 'savings'),
      credit_card: activeAccounts.filter(acc => acc.account_type === 'credit_card'),
      investment: activeAccounts.filter(acc => acc.account_type === 'investment'),
      cash: activeAccounts.filter(acc => acc.account_type === 'cash')
    };
    return groupedAccounts;
  };

  const netWorth = calculateNetWorth();
  const groupedAccounts = getAccountsByType();

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-full mx-auto xl:max-w-screen-2xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <WelcomeCard user={user} />
      </motion.div>
      
      {/* Grid para os dois gráficos principais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="h-full" 
        >
          <ExpensesChart 
            transactions={allTransactions}
            tags={tags}
            isLoading={isLoading}
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="h-full"
        >
          <PatrimonyEvolutionChart
            accounts={accounts}
            transactions={allTransactions}
            isLoading={isLoading}
          />
        </motion.div>
      </div>

      {/* Card de Patrimônio Líquido Total */}
       <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <NetWorthCard 
          netWorth={netWorth}
          accounts={accounts}
          isLoading={isLoading}
        />
      </motion.div>

      {/* Grid para Lista de Contas e Transações Recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <AccountsList 
            groupedAccounts={groupedAccounts}
            isLoading={isLoading}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <RecentTransactions 
            transactions={transactions}
            isLoading={isLoading}
          />
        </motion.div>
      </div>
    </div>
  );
}
