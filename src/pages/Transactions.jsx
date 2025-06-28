
import React, { useState, useEffect, useCallback, useMemo } from "react";
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

// Helper function to calculate progressive balances
const calculateProgressiveBalances = (
  transactionsToDisplay, // Already ordered newest to oldest, and with currency mapped
  allSystemTransactions, // All transactions from the user, for historical calculation
  accounts,
  filters
) => {
  // Ensure transactionsToDisplay is what we expect (paginated, currency mapped)
  // Ensure allSystemTransactions is the full list from state (e.g., state.transactions)

  if (filters.tagId !== 'all' || !accounts.length || !transactionsToDisplay.length) {
    return transactionsToDisplay.map(t => ({
      ...t,
      progressiveBalance: null,
      progressiveBalanceCurrency: null,
    }));
  }

  const transactionsWithBalances = transactionsToDisplay.map(t => ({ ...t })); // Deep clone array of objects

  // Step 1: Calculate Saldo da Primeira Linha (Mais Recente na Visualização)
  const firstTxInView = transactionsWithBalances[0];
  let balanceAfterFirstTx = 0;
  let currencyForBalance = 'BRL';

  // Sort all transactions chronologically (oldest first) for initial balance calculation
  const allTransactionsChronological = [...allSystemTransactions]
    .sort((a, b) => {
      const dateA = new Date(a.transaction_date.replace(/-/g, '/')).getTime();
      const dateB = new Date(b.transaction_date.replace(/-/g, '/')).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return (new Date(a.created_at || 0)).getTime() - (new Date(b.created_at || 0)).getTime();
    });

  if (filters.accountId !== "all") {
    const selectedAccount = accounts.find(acc => acc.id === filters.accountId);
    if (selectedAccount) {
      balanceAfterFirstTx = parseFloat(selectedAccount.initial_balance || 0);
      currencyForBalance = selectedAccount.currency || 'BRL';
      for (const t of allTransactionsChronological) {
        // IMPORTANT: The t.account_id and t.destination_account_id here are after the
        // _base44 mapping. They MUST be comparable with filters.accountId (which comes from accounts.id).
        // If accounts.id is UUID and transaction IDs become base44, comparisons will fail.
        const amount = parseFloat(t.amount);
        if (t.account_id === filters.accountId) {
          if (t.transaction_type === "income") balanceAfterFirstTx += amount;
          else if (t.transaction_type === "expense") balanceAfterFirstTx -= amount;
          else if (t.transaction_type === "transfer") balanceAfterFirstTx -= amount;
        } else if (t.transaction_type === "transfer" && t.destination_account_id === filters.accountId) {
          balanceAfterFirstTx += amount;
        }
        if (t.id === firstTxInView.id) break;
      }
    }
  } else { // All accounts
    balanceAfterFirstTx = accounts.reduce((sum, acc) => sum + parseFloat(acc.initial_balance || 0), 0);
    currencyForBalance = 'BRL';
    for (const t of allTransactionsChronological) {
      const amount = parseFloat(t.amount);
      if (t.transaction_type === "income") balanceAfterFirstTx += amount;
      else if (t.transaction_type === "expense") balanceAfterFirstTx -= amount;
      // Internal transfers are neutral for "all accounts" sum
      if (t.id === firstTxInView.id) break;
    }
  }
  transactionsWithBalances[0].progressiveBalance = balanceAfterFirstTx;
  transactionsWithBalances[0].progressiveBalanceCurrency = currencyForBalance;

  // Step 2: Calculate Saldo das Linhas Subsequentes
  for (let i = 1; i < transactionsWithBalances.length; i++) {
    const prevTx = transactionsWithBalances[i-1];
    const currentTx = transactionsWithBalances[i];
    let saldoLinhaAnterior = prevTx.progressiveBalance;
    let efeitoInversoTxAnterior = 0;
    const amountPrevTx = parseFloat(prevTx.amount);

    // Again, prevTx.account_id and prevTx.destination_account_id must be comparable with filters.accountId
    if (filters.accountId !== "all") {
      const selectedId = filters.accountId;
      if (prevTx.account_id === selectedId) { // Tx anterior foi da conta selecionada
        if (prevTx.transaction_type === 'income') efeitoInversoTxAnterior = -amountPrevTx;
        else if (prevTx.transaction_type === 'expense') efeitoInversoTxAnterior = +amountPrevTx;
        else if (prevTx.transaction_type === 'transfer') efeitoInversoTxAnterior = +amountPrevTx; // Transferência de SAÍDA
      } else if (prevTx.destination_account_id === selectedId && prevTx.transaction_type === 'transfer') { // Transferência de ENTRADA
        efeitoInversoTxAnterior = -amountPrevTx;
      }
    } else { // Todas as Contas
      if (prevTx.transaction_type === 'income') efeitoInversoTxAnterior = -amountPrevTx;
      else if (prevTx.transaction_type === 'expense') efeitoInversoTxAnterior = +amountPrevTx;
      // For 'transfer' in "All Accounts", an internal transfer has zero net effect, so efeitoInversoTxAnterior remains 0.
    }
    currentTx.progressiveBalance = saldoLinhaAnterior + efeitoInversoTxAnterior;
    currentTx.progressiveBalanceCurrency = prevTx.progressiveBalanceCurrency;
  }
  return transactionsWithBalances;
};


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
        toast({ title: "Usuário não autenticado.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      const [transactionsResponse, accountsResponse, tagsResponse] = await Promise.all([
        supabase.from('transactions').select('*').order('transaction_date', { ascending: false }).order('updated_at', { ascending: false }),
        supabase.from('accounts').select('*'),
        supabase.from('tags').select('*')
      ]);

      if (transactionsResponse.error) throw transactionsResponse.error;
      if (accountsResponse.error) throw accountsResponse.error;
      if (tagsResponse.error) throw tagsResponse.error;

      const rawTransactions = transactionsResponse.data || [];
      const mappedTransactions = rawTransactions.map(t => ({
        ...t,
        // This mapping prioritizes _base44 if it exists.
        // For balance calculations to be correct, filters.accountId (from accounts.id)
        // MUST use the same ID format that results from this mapping.
        // If accounts.id are UUIDs and _base44 fields are different, comparisons will fail.
        account_id: t.account_id_base44 || t.account_id,
        tag_id: t.tag_id_base44 || t.tag_id,
        destination_account_id: t.destination_account_id_base44 || t.destination_account_id,
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
      loadInitialData();
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

  const totalItems = filteredTransactions.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);

  const accountCurrencyMap = useMemo(() => new Map(accounts.map(acc => [acc.id, acc.currency])), [accounts]);

  const transactionsForDisplay = useMemo(() => {
    return paginatedTransactions.map(t => ({
      ...t,
      // t.account_id here is after _base44 mapping from loadInitialData
      // It's crucial that accountCurrencyMap uses the same ID format for lookup.
      // (accounts.id from loadInitialData should match the format of t.account_id after mapping)
      currency: accountCurrencyMap.get(t.account_id) || 'BRL'
    }));
  }, [paginatedTransactions, accountCurrencyMap]);

  const transactionsWithProgressiveBalance = useMemo(() => {
    // `transactions` (full list from state) is passed as `allSystemTransactions`
    return calculateProgressiveBalances(transactionsForDisplay, transactions, accounts, filters);
  }, [transactionsForDisplay, transactions, accounts, filters]);

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <TransactionsHeader
          onAddTransaction={() => {
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
