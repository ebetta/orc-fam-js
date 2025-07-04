
import React, { useState, useEffect } from "react";
// import { Account } from "@/api/entities"; // Removed
// import { Transaction } from "@/api/entities"; // Removed
// import { Tag } from "@/api/entities"; // Removed
// import { User } from "@/api/entities"; // Removed
import { supabase } from "@/lib/supabaseClient"; // Added
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
    // User data is already available in Layout or via supabase.auth.getUser() directly if needed
    // For this dashboard, we'll fetch user data again if WelcomeCard needs specific fields not in session.
    // However, the `user` state here was from Base44 User.me(). Supabase user is handled by Layout.
    // We can get it from supabase.auth.getUser() if needed by WelcomeCard.
    // For now, let's fetch Supabase user data for the WelcomeCard.
    const fetchCurrentUser = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser); // This sets the user for WelcomeCard
    };
    fetchCurrentUser();
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      // Fetch data using Supabase
      const { data: accountsData, error: accountsError } = await supabase
        .from('accounts')
        .select('*')
        .order('updated_at', { ascending: false });
      if (accountsError) console.error("Erro ao carregar contas:", accountsError);

      const fetchedAccounts = accountsData || [];
      const processedAccounts = fetchedAccounts.map(acc => ({
        ...acc,
        initial_balance: (acc.initial_balance === null || typeof acc.initial_balance === 'undefined' || isNaN(parseFloat(acc.initial_balance)))
                         ? 0
                         : parseFloat(acc.initial_balance)
      }));
      setAccounts(processedAccounts);

      // Fetch recent transactions
      const { data: recentTransactionsData, error: recentTransactionsError } = await supabase
        .from('transactions')
        .select('*')
        .order('transaction_date', { ascending: false })
        .limit(5);
      if (recentTransactionsError) console.error("Erro ao carregar transações recentes:", recentTransactionsError);
      setTransactions(recentTransactionsData || []);

      // Fetch all transactions for charts (up to 500)
      const { data: allTransactionsData, error: allTransactionsError } = await supabase
        .from('transactions')
        .select('*')
        .order('transaction_date', { ascending: false })
        .limit(500);
      if (allTransactionsError) console.error("Erro ao carregar todas as transações:", allTransactionsError);
      setAllTransactions(allTransactionsData || []);
      
      const { data: tagsData, error: tagsError } = await supabase
        .from('tags')
        .select('*');
      if (tagsError) console.error("Erro ao carregar tags:", tagsError);
      setTags(tagsData || []);

      // Pré-carregar cotações
      const currentAccounts = accountsData || [];
      if (currentAccounts.length > 0) {
        const uniqueCurrencies = [...new Set(currentAccounts.map(acc => acc.currency || 'BRL'))];
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
    // Simplified: Sum of initial balances. True net worth requires transaction processing.
    // This matches the change made in Accounts where current_balance was removed.
    // For a more accurate dashboard net worth, we'd need to calculate it based on transactions.
    // This can be a future enhancement.
    return accounts.reduce((total, account) => {
      if (account.is_active === false) return total;
      return total + (parseFloat(account.initial_balance) || 0);
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
          netWorth={netWorth} // Esta prop é ignorada para o cálculo principal no card
          accounts={accounts}
          isLoading={isLoading}
          transactions={allTransactions} // Passando todas as transações
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
