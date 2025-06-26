
import React, { useState, useEffect, useCallback, useMemo } from "react"; // Added useMemo here for clarity, though React.useMemo would also work if React is imported.
// import { Transaction } from "@/api/entities"; // Removed
// import { Account } from "@/api/entities"; // Removed
// import { Tag } from "@/api/entities"; // Removed
import { supabase } from "@/lib/supabaseClient"; // Added
import { motion } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";

import TransactionsHeader from "../components/transactions/TransactionsHeader";
import TransactionForm from "../components/transactions/TransactionForm";
import TransactionsList from "../components/transactions/TransactionsList";
import PeriodSummary from "../components/transactions/PeriodSummary";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [tags, setTags] = useState([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const { toast } = useToast();

  // Estados de paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20); // 20 transações por página

  const [filters, setFilters] = useState({
    type: "all",
    accountId: "all",
    tagId: "all",
    period: { from: null, to: null }, 
    searchTerm: ""
  });

  // Verificar se há parâmetros de URL ao carregar a página
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const accountIdFromUrl = urlParams.get('accountId');
    const tagIdFromUrl = urlParams.get('tagId');
    const periodFromUrl = urlParams.get('periodFrom');
    const periodToUrl = urlParams.get('periodTo');
    
    if (accountIdFromUrl || tagIdFromUrl || periodFromUrl || periodToUrl) {
      setFilters(prev => ({
        ...prev,
        accountId: accountIdFromUrl || prev.accountId,
        tagId: tagIdFromUrl || prev.tagId,
        period: {
          from: periodFromUrl || prev.period.from,
          to: periodToUrl || prev.period.to
        }
      }));
    }
  }, []); // Empty dependency array means it runs once on mount.

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Should not happen if ProtectedRoute is working, but good for safety
        toast({ title: "Usuário não autenticado.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      const [transactionsResponse, accountsResponse, tagsResponse] = await Promise.all([
        supabase.from('transactions').select('*').order('transaction_date', { ascending: false }),
        supabase.from('accounts').select('*'),
        supabase.from('tags').select('*')
      ]);

      if (transactionsResponse.error) throw transactionsResponse.error;
      if (accountsResponse.error) throw accountsResponse.error;
      if (tagsResponse.error) throw tagsResponse.error;

      const rawTransactions = transactionsResponse.data || [];
      // Map _base44 fields to standard fields for consistent use in the frontend
      const mappedTransactions = rawTransactions.map(t => ({
        ...t,
        account_id: t.account_id_base44 || t.account_id,
        tag_id: t.tag_id_base44 || t.tag_id,
        destination_account_id: t.destination_account_id_base44 || t.destination_account_id,
        // We can choose to remove the _base44 fields after mapping if desired,
        // but keeping them doesn't harm as long as frontend components prioritize standard names.
        // For clarity, let's assume for now components will use the standard names after this mapping.
      }));

      setTransactions(mappedTransactions);
      setAccounts(accountsResponse.data || []);
      setTags(tagsResponse.data || []);

    } catch (error) {
      console.error("Erro ao carregar dados:", error.message);
      toast({
        title: "Erro ao carregar dados",
        description: "Ocorreu um problema ao buscar os dados. Tente novamente.",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Resetar para primeira página quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // REMOVED updateAccountBalance function as current_balance is not stored in accounts table.

  const handleFormSubmit = async (transactionData) => {
    const isEditing = !!editingTransaction?.id;
    // const originalTransaction = isEditing ? transactions.find(t => t.id === editingTransaction.id) : null; // Get from state if needed

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      if (isEditing) {
        // Balance adjustments are implicit due to transaction changes, no direct account update here.
        const { error } = await supabase
          .from("transactions")
          .update(transactionData)
          .eq("id", editingTransaction.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("transactions")
          .insert([{ ...transactionData, user_id: user.id }]);
        if (error) throw error;
      }

      // Balance updates are now implicit. Reloading data will recalculate summaries.
      toast({
        title: `Transação ${isEditing ? 'Atualizada' : 'Criada'}!`,
        description: `A transação "${transactionData.description}" foi salva com sucesso.`,
        className: "bg-green-100 text-green-800 border-green-300",
      });
      setShowForm(false);
      setEditingTransaction(null);
      loadInitialData(); // Recarregar tudo para garantir consistência
    } catch (error) {
      console.error("Erro ao salvar transação:", error);
      toast({
        title: "Erro ao salvar transação",
        description: "Não foi possível salvar. Verifique os dados e tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleEditTransaction = (transaction) => {
    setEditingTransaction(transaction);
    setShowForm(true);
  };

  const handleDeleteTransaction = async (transactionId) => {
    try {
      const transactionToDelete = transactions.find(t => t.id === transactionId);
      if (!transactionToDelete) {
        toast({ title: "Transação não encontrada para exclusão.", variant: "destructive" });
        return;
      }

      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", transactionId);
      if (error) throw error;

      // Balance updates are now implicit. Reloading data will recalculate summaries.
      toast({
        title: "Transação Excluída!",
        description: `A transação "${transactionToDelete.description}" foi excluída.`,
      });
      loadInitialData();
    } catch (error) {
      console.error("Erro ao excluir transação:", error);
      toast({
        title: "Erro ao excluir transação",
        variant: "destructive",
      });
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingTransaction(null);
  };

  const filteredTransactions = transactions.filter(transaction => {
    const typeMatch = filters.type === "all" || transaction.transaction_type === filters.type;
    // Account match includes transactions where the account is either the source or the destination of a transfer
    const accountMatch = filters.accountId === "all" || 
                         transaction.account_id === filters.accountId || 
                         transaction.destination_account_id === filters.accountId;
    const tagMatch = filters.tagId === "all" || transaction.tag_id === filters.tagId;
    
    // Datas em string 'YYYY-MM-DD' podem ser interpretadas como UTC. 
    // Substituir hífens por barras força a interpretação como data local, evitando erros de fuso horário.
    const transactionDate = new Date(transaction.transaction_date.replace(/-/g, '/'));
    transactionDate.setHours(0,0,0,0); // Normalize to compare only dates

    let periodMatch = true;
    if (filters.period.from) {
        const fromDate = new Date(filters.period.from.replace(/-/g, '/'));
        fromDate.setHours(0,0,0,0);
        periodMatch = periodMatch && transactionDate >= fromDate;
    }
    if (filters.period.to) {
        const toDate = new Date(filters.period.to.replace(/-/g, '/'));
        toDate.setHours(0,0,0,0);
        periodMatch = periodMatch && transactionDate <= toDate;
    }
    
    const searchTermMatch = filters.searchTerm === "" || 
      transaction.description.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
      (accounts.find(a => a.id === transaction.account_id)?.name.toLowerCase().includes(filters.searchTerm.toLowerCase())) ||
      (tags.find(t => t.id === transaction.tag_id)?.name.toLowerCase().includes(filters.searchTerm.toLowerCase()));

    return typeMatch && accountMatch && tagMatch && periodMatch && searchTermMatch;
  });

import { convertCurrency } from "../components/utils/CurrencyConverter"; // Added for balance calculation

// Function to sort transactions consistently: Descending by date, then descending by creation time
const sortTransactionsForDisplay = (transactions) => {
  return transactions.sort((a, b) => {
    const dateA = new Date(a.transaction_date.replace(/-/g, '/')).getTime();
    const dateB = new Date(b.transaction_date.replace(/-/g, '/')).getTime();
    if (dateA !== dateB) return dateB - dateA; // Descending by date
    return (new Date(b.created_at || 0)).getTime() - (new Date(a.created_at || 0)).getTime(); // Descending by creation
  });
};

// Function to sort transactions for progressive calculation: Ascending by date, then ascending by creation time
const sortTransactionsForCalculation = (transactions) => {
  return transactions.sort((a, b) => {
    const dateA = new Date(a.transaction_date.replace(/-/g, '/')).getTime();
    const dateB = new Date(b.transaction_date.replace(/-/g, '/')).getTime();
    if (dateA !== dateB) return dateA - dateB; // Ascending by date
    return (new Date(a.created_at || 0)).getTime() - (new Date(b.created_at || 0)).getTime(); // Ascending by creation
  });
};


export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [tags, setTags] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isCalculatingBalance, setIsCalculatingBalance] = useState(false); // New state for balance calculation
  const [processedTransactions, setProcessedTransactions] = useState([]); // Holds transactions with saldo

  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const { toast } = useToast();

  // Estados de paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20); // 20 transações por página

  const [filters, setFilters] = useState({
    type: "all",
    accountId: "all",
    tagId: "all",
    period: { from: null, to: null },
    searchTerm: ""
  });

  // Verificar se há parâmetros de URL ao carregar a página
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const accountIdFromUrl = urlParams.get('accountId');
    const tagIdFromUrl = urlParams.get('tagId');
    const periodFromUrl = urlParams.get('periodFrom');
    const periodToUrl = urlParams.get('periodTo');

    if (accountIdFromUrl || tagIdFromUrl || periodFromUrl || periodToUrl) {
      setFilters(prev => ({
        ...prev,
        accountId: accountIdFromUrl || prev.accountId,
        tagId: tagIdFromUrl || prev.tagId,
        period: {
          from: periodFromUrl || prev.period.from,
          to: periodToUrl || prev.period.to
        }
      }));
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Usuário não autenticado.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      // Fetch all data concurrently
      const [transactionsResponse, accountsResponse, tagsResponse] = await Promise.all([
        supabase.from('transactions').select('*').order('transaction_date', { ascending: false }).order('created_at', { ascending: false }), // Already sorted for display initially
        supabase.from('accounts').select('*'),
        supabase.from('tags').select('*')
      ]);

      if (transactionsResponse.error) throw transactionsResponse.error;
      if (accountsResponse.error) throw accountsResponse.error;
      if (tagsResponse.error) throw tagsResponse.error;

      const rawTransactions = transactionsResponse.data || [];
      const mappedTransactions = rawTransactions.map(t => ({
        ...t,
        account_id: t.account_id_base44 || t.account_id,
        tag_id: t.tag_id_base44 || t.tag_id,
        destination_account_id: t.destination_account_id_base44 || t.destination_account_id,
      }));

      setTransactions(mappedTransactions); // This is the raw, unfiltered, unsorted list from DB
      setAccounts(accountsResponse.data || []);
      setTags(tagsResponse.data || []);

    } catch (error) {
      console.error("Erro ao carregar dados:", error.message);
      toast({
        title: "Erro ao carregar dados",
        description: "Ocorreu um problema ao buscar os dados. Tente novamente.",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Resetar para primeira página quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // --- Effect to calculate filtered and progressive balance ---

  // First, memoize the filtered transactions based on original transactions and filters
  const filteredTransactions = React.useMemo(() => {
    if (isLoading || accounts.length === 0) {
      return [];
    }
    return transactions.filter(transaction => {
      const typeMatch = filters.type === "all" || transaction.transaction_type === filters.type;
      const accountMatch = filters.accountId === "all" ||
                           transaction.account_id === filters.accountId ||
                           transaction.destination_account_id === filters.accountId;
      const tagMatch = filters.tagId === "all" || transaction.tag_id === filters.tagId;

      const transactionDate = new Date(transaction.transaction_date.replace(/-/g, '/'));
      transactionDate.setHours(0,0,0,0);

      let periodMatch = true;
      if (filters.period.from) {
          const fromDate = new Date(filters.period.from.replace(/-/g, '/'));
          fromDate.setHours(0,0,0,0);
          periodMatch = periodMatch && transactionDate >= fromDate;
      }
      if (filters.period.to) {
          const toDate = new Date(filters.period.to.replace(/-/g, '/'));
          toDate.setHours(0,0,0,0);
          periodMatch = periodMatch && transactionDate <= toDate;
      }

      const searchTermMatch = filters.searchTerm === "" ||
        transaction.description.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        (accounts.find(a => a.id === transaction.account_id)?.name.toLowerCase().includes(filters.searchTerm.toLowerCase())) ||
        (tags.find(t => t.id === transaction.tag_id)?.name.toLowerCase().includes(filters.searchTerm.toLowerCase()));

      return typeMatch && accountMatch && tagMatch && periodMatch && searchTermMatch;
    });
  }, [transactions, accounts, filters, isLoading]);


  useEffect(() => {
    const calculateBalances = async () => {
      if (isLoading || accounts.length === 0) {
        setProcessedTransactions([]);
        return;
      }
      setIsCalculatingBalance(true);

      // Use the memoized filteredTransactions
      const accountCurrencyMap = new Map(accounts.map(acc => [acc.id, acc.currency]));

      // Augment with primary account currency for 'amount' display
      let transactionsToProcess = filtered.map(t => ({
        ...t,
        currency: accountCurrencyMap.get(t.account_id) || 'BRL', // For 'Valor' column
        saldo: null,
        saldoCurrency: null,
      }));


      // --- Progressive Balance (Saldo) Calculation ---
      if (filters.period.from) { // Saldo calculation requires a starting date for reference
        if (filters.accountId !== "all") {
          // --- Single Account Saldo ---
          const selectedAccountId = filters.accountId;
          const periodFromDate = new Date(filters.period.from.replace(/-/g, '/'));
          periodFromDate.setHours(0, 0, 0, 0);

          const account = accounts.find(acc => acc.id === selectedAccountId);
          let balanceAtFilterStart = 0;
          const selectedAccountCurrency = account?.currency || 'BRL';

          if (account) {
            balanceAtFilterStart = parseFloat(account.initial_balance || 0);

            const allAccountTransactionsBeforeFilter = sortTransactionsForCalculation(
              transactions.filter(t => {
                const tDate = new Date(t.transaction_date.replace(/-/g, '/'));
                tDate.setHours(0,0,0,0);
                return (t.account_id === selectedAccountId || (t.transaction_type === "transfer" && t.destination_account_id === selectedAccountId)) &&
                       tDate.getTime() < periodFromDate.getTime();
              })
            );

            for (const t of allAccountTransactionsBeforeFilter) {
              const amount = parseFloat(t.amount);
              if (t.transaction_type === "income") balanceAtFilterStart += amount;
              else if (t.transaction_type === "expense") balanceAtFilterStart -= amount;
              else if (t.transaction_type === "transfer") {
                if (t.account_id === selectedAccountId) balanceAtFilterStart -= amount;
                else if (t.destination_account_id === selectedAccountId) balanceAtFilterStart += amount;
              }
            }
          }

          let tempProcessingArray = sortTransactionsForCalculation([...transactionsToProcess]);
          let runningBalance = balanceAtFilterStart;

          tempProcessingArray = tempProcessingArray.map(t => {
            const transactionAmount = parseFloat(t.amount);
            let updatedBalance = runningBalance;
            if (t.transaction_type === "income") updatedBalance += transactionAmount;
            else if (t.transaction_type === "expense") updatedBalance -= transactionAmount;
            else if (t.transaction_type === "transfer") {
              if (t.account_id === selectedAccountId) updatedBalance -= transactionAmount;
              else if (t.destination_account_id === selectedAccountId) updatedBalance += transactionAmount;
            }
            runningBalance = updatedBalance;
            return { ...t, saldo: updatedBalance, saldoCurrency: selectedAccountCurrency };
          });
          transactionsToProcess = tempProcessingArray;

        } else {
          // --- All Accounts Saldo (Calculated in BRL) ---
          const periodFromDate = new Date(filters.period.from.replace(/-/g, '/'));
          periodFromDate.setHours(0, 0, 0, 0);
          let totalBalanceAtFilterStartBRL = 0;

          for (const acc of accounts) {
            let accountBalanceAtStart = parseFloat(acc.initial_balance || 0);
            const accountTransactionsBeforeFilter = sortTransactionsForCalculation(
              transactions.filter(t => {
                const tDate = new Date(t.transaction_date.replace(/-/g, '/'));
                tDate.setHours(0,0,0,0);
                return (t.account_id === acc.id || (t.transaction_type === "transfer" && t.destination_account_id === acc.id)) &&
                       tDate.getTime() < periodFromDate.getTime();
              })
            );

            for (const t of accountTransactionsBeforeFilter) {
              const amount = parseFloat(t.amount);
              if (t.transaction_type === "income") accountBalanceAtStart += amount;
              else if (t.transaction_type === "expense") accountBalanceAtStart -= amount;
              else if (t.transaction_type === "transfer") {
                if (t.account_id === acc.id) accountBalanceAtStart -= amount;
                else if (t.destination_account_id === acc.id) accountBalanceAtStart += amount;
              }
            }
            totalBalanceAtFilterStartBRL += await convertCurrency(accountBalanceAtStart, acc.currency, 'BRL');
          }

          let tempProcessingArray = sortTransactionsForCalculation([...transactionsToProcess]);
          let runningTotalBalanceBRL = totalBalanceAtFilterStartBRL;

          for (let i = 0; i < tempProcessingArray.length; i++) {
            const t = tempProcessingArray[i];
            const transactionAmount = parseFloat(t.amount);
            const amountInBRL = await convertCurrency(transactionAmount, accountCurrencyMap.get(t.account_id) || 'BRL', 'BRL');

            // Transfers between internal accounts are net zero for total balance.
            // Only income/expense affect total balance.
            if (t.transaction_type === "income") {
              runningTotalBalanceBRL += amountInBRL;
            } else if (t.transaction_type === "expense") {
              runningTotalBalanceBRL -= amountInBRL;
            }
            // For transfers between two accounts *within the system*, the net effect on the *total combined balance* is zero.
            // If a transfer's source or destination is external, it should be categorized as expense or income.
            // Assuming current 'transfer' type is for internal movements.
            tempProcessingArray[i] = { ...t, saldo: runningTotalBalanceBRL, saldoCurrency: 'BRL' };
          }
          transactionsToProcess = tempProcessingArray;
        }
      } else {
        // No period.from, so no saldo calculation possible for now
        transactionsToProcess = transactionsToProcess.map(t => ({ ...t, saldo: null, saldoCurrency: null }));
      }

      // Finally, sort for display
      setProcessedTransactions(sortTransactionsForDisplay(transactionsToProcess));
      setIsCalculatingBalance(false);
    };

    calculateBalances();

  }, [transactions, accounts, filters, isLoading]); // Recalculate when these change


  const handleFormSubmit = async (transactionData) => {
    const isEditing = !!editingTransaction?.id;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      if (isEditing) {
        const { error } = await supabase
          .from("transactions")
          .update(transactionData)
          .eq("id", editingTransaction.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("transactions")
          .insert([{ ...transactionData, user_id: user.id }]);
        if (error) throw error;
      }
      toast({
        title: `Transação ${isEditing ? 'Atualizada' : 'Criada'}!`,
        description: `A transação "${transactionData.description}" foi salva com sucesso.`,
        className: "bg-green-100 text-green-800 border-green-300",
      });
      setShowForm(false);
      setEditingTransaction(null);
      loadInitialData(); // Recarregar tudo to trigger recalculation
    } catch (error) {
      console.error("Erro ao salvar transação:", error);
      toast({
        title: "Erro ao salvar transação",
        description: "Não foi possível salvar. Verifique os dados e tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleEditTransaction = (transaction) => {
    setEditingTransaction(transaction);
    setShowForm(true);
  };

  const handleDeleteTransaction = async (transactionId) => {
    try {
      const transactionToDelete = transactions.find(t => t.id === transactionId); // Find from original list
      if (!transactionToDelete) {
        toast({ title: "Transação não encontrada para exclusão.", variant: "destructive" });
        return;
      }

      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", transactionId);
      if (error) throw error;

      toast({
        title: "Transação Excluída!",
        description: `A transação "${transactionToDelete.description}" foi excluída.`,
      });
      loadInitialData(); // Recarregar tudo to trigger recalculation
    } catch (error) {
      console.error("Erro ao excluir transação:", error);
      toast({
        title: "Erro ao excluir transação",
        variant: "destructive",
      });
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingTransaction(null);
  };

  // Pagination logic based on processedTransactions
  const totalItems = processedTransactions.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTransactions = processedTransactions.slice(startIndex, endIndex);

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <TransactionsHeader
          onAddTransaction={() => {
            // Se uma conta estiver selecionada no filtro, passa como um "template"
            const template = filters.accountId !== 'all' ? { account_id: filters.accountId } : null;
            setEditingTransaction(template);
            setShowForm(true);
          }}
          accounts={accounts}
          tags={tags}
          filters={filters}
          onFiltersChange={setFilters}
          transactionsCount={totalItems}
        />
      </motion.div>

      {/* Resumo do Período */}
      <PeriodSummary 
        transactions={filteredTransactions}
        filters={filters}
      />

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-40 flex justify-center items-center p-4 overflow-auto"
          onClick={handleCancelForm}
        >
            <div onClick={e => e.stopPropagation()} className="w-full max-w-2xl">
                 <TransactionForm
                    transaction={editingTransaction}
                    accounts={accounts.filter(acc => acc.is_active !== false)}
                    tags={tags.filter(t => t.is_active !== false)}
                    onSave={handleFormSubmit}
                    onCancel={handleCancelForm}
                />
            </div>
        </motion.div>
      )}
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <TransactionsList
          transactions={transactionsWithProgressiveBalance} // Pass the augmented transactions with progressive balance and currency info
          accounts={accounts}
          tags={tags}
          isLoading={isLoading}
          onEditTransaction={handleEditTransaction}
          onDeleteTransaction={handleDeleteTransaction}
          filters={filters} // Pass filters so TransactionsList can conditionally render the 'Saldo' column
          // Propriedades de paginação
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      </motion.div>
    </div>
  );
}
