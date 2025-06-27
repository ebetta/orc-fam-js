
import React, { useState, useEffect, useCallback } from "react";
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

  // Calcular paginação
  const totalItems = filteredTransactions.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);

  // --- Progressive Balance Calculation ---
  let transactionsWithProgressiveBalance = [...paginatedTransactions]; // Clone the array for processing

  // Initialize a map for quick currency lookup
  const accountCurrencyMap = new Map(accounts.map(acc => [acc.id, acc.currency]));

  // Augment all transactions with their primary account's currency for display of 'amount'
  let processedTransactions = paginatedTransactions.map(t => ({
    ...t,
    currency: accountCurrencyMap.get(t.account_id) || 'BRL'
  }));

  // --- Progressive Balance Calculation ---
  // The "Saldo" column for a transaction shows the balance *after* that transaction occurred.
  // Transactions are displayed newest first (descending date).

  // 1. Get all transactions (not just filtered ones yet, because earlier transactions affect later balances)
  //    and sort them chronologically (oldest first) to correctly calculate running balances.
  const allTransactionsChronological = [...transactions].sort((a, b) => {
    const dateA = new Date(a.transaction_date.replace(/-/g, '/')).getTime();
    const dateB = new Date(b.transaction_date.replace(/-/g, '/')).getTime();
    if (dateA !== dateB) return dateA - dateB;
    return (new Date(a.created_at || 0)).getTime() - (new Date(b.created_at || 0)).getTime();
  });

  // 2. Calculate the running balance after each transaction and store it in a map.
  const balancesAfterTransactionMap = new Map();
  let runningBalanceForMap;
  let currentCurrencyForMap = 'BRL'; // Default

  if (filters.accountId !== "all") {
    // Single account selected
    const selectedAccount = accounts.find(acc => acc.id === filters.accountId);
    runningBalanceForMap = selectedAccount ? parseFloat(selectedAccount.initial_balance || 0) : 0;
    currentCurrencyForMap = selectedAccount ? (selectedAccount.currency || 'BRL') : 'BRL';

    for (const t of allTransactionsChronological) {
      const amount = parseFloat(t.amount);
      if (t.account_id === filters.accountId) {
        if (t.transaction_type === "income") runningBalanceForMap += amount;
        else if (t.transaction_type === "expense") runningBalanceForMap -= amount;
        else if (t.transaction_type === "transfer") runningBalanceForMap -= amount;
      } else if (t.transaction_type === "transfer" && t.destination_account_id === filters.accountId) {
        runningBalanceForMap += amount;
      }
      balancesAfterTransactionMap.set(t.id, { balance: runningBalanceForMap, currency: currentCurrencyForMap });
    }
  } else {
    // All accounts selected
    runningBalanceForMap = accounts.reduce((sum, acc) => sum + parseFloat(acc.initial_balance || 0), 0);
    currentCurrencyForMap = 'BRL';

    for (const t of allTransactionsChronological) {
      const amount = parseFloat(t.amount);
      if (t.transaction_type === "income") {
        runningBalanceForMap += amount;
      } else if (t.transaction_type === "expense") {
        runningBalanceForMap -= amount;
      }
      balancesAfterTransactionMap.set(t.id, { balance: runningBalanceForMap, currency: currentCurrencyForMap });
    }
  }

  // 3. Add 'progressiveBalance' (balance *after* transaction) to processedTransactions.
  //    `processedTransactions` are already sorted for display (newest first, from paginatedTransactions).
  transactionsWithProgressiveBalance = processedTransactions.map(t => {
    const balanceInfo = balancesAfterTransactionMap.get(t.id);
    return {
      ...t,
      progressiveBalance: balanceInfo ? balanceInfo.balance : null,
      progressiveBalanceCurrency: balanceInfo ? balanceInfo.currency : (filters.accountId !== "all" ? accounts.find(a=>a.id === t.account_id)?.currency || 'BRL' : 'BRL'),
    };
  });

  // 4. Implement the visual running calculation as per user request:
  // Saldo_Visual[i] = Saldo_Visual[i-1] (saldo da linha anterior, mais nova) - Valor_Transacao[i] (valor da transação da linha atual)
  // This means the "Saldo" for row `i` is the balance *before* transaction `i` occurred,
  // relative to the balance of the *previous visual row*.
  // The first row's saldo is balance *after* that transaction.
  if (transactionsWithProgressiveBalance.length > 0) {
    // The first transaction in the view (newest) already has its `progressiveBalance` set
    // to the balance *after* it occurred. This is Saldo_Visual[0].

    for (let i = 1; i < transactionsWithProgressiveBalance.length; i++) {
      const prevVisualRowTx = transactionsWithProgressiveBalance[i-1]; // Transaction from the row above (newer)
      const currentVisualRowTx = transactionsWithProgressiveBalance[i]; // Transaction for the current row (older)

      let amountEffectCurrentTx = parseFloat(currentVisualRowTx.amount);

      // Determine the effect of currentVisualRowTx on the balance
      if (filters.accountId !== "all") { // Single account selected
        const selectedAccountId = filters.accountId;
        if (currentVisualRowTx.account_id === selectedAccountId) { // Primary account
          if (currentVisualRowTx.transaction_type === "income") {
            // Income increases balance. Saldo[i-1] is after prevTx. To get Saldo[i] (before currentTx), subtract currentTx's income.
            // No, this is Saldo[i] = Saldo[i-1] - Valor. Valor is positive for income.
            // So, Saldo[i] = Saldo[i-1] - (+amount)
          } else if (currentVisualRowTx.transaction_type === "expense") {
            // Expense decreases balance. Valor is positive for expense.
            // Saldo[i] = Saldo[i-1] - (-amount) -> Saldo[i-1] + amount
             amountEffectCurrentTx = -amountEffectCurrentTx;
          } else if (currentVisualRowTx.transaction_type === "transfer") { // Transfer out
            // Transfer out decreases balance.
             amountEffectCurrentTx = -amountEffectCurrentTx;
          }
        } else if (currentVisualRowTx.transaction_type === "transfer" && currentVisualRowTx.destination_account_id === selectedAccountId) { // Transfer in
          // Transfer in increases balance.
          // Saldo[i] = Saldo[i-1] - (+amount) for transfer-in if we consider "Valor" as positive.
        } else {
           amountEffectCurrentTx = 0; // Transaction doesn't affect selected account's balance directly for this calculation step
        }
      } else { // All accounts selected
        if (currentVisualRowTx.transaction_type === "income") {
          // Saldo[i] = Saldo[i-1] - (+amount)
        } else if (currentVisualRowTx.transaction_type === "expense") {
          // Saldo[i] = Saldo[i-1] - (-amount)
           amountEffectCurrentTx = -amountEffectCurrentTx;
        } else if (currentVisualRowTx.transaction_type === "transfer") {
           amountEffectCurrentTx = 0; // Internal transfers are neutral to total, so their "value" effect on running sum is 0
        }
      }
      // User: "saldo da primeira linha menos o valor da segunda linha"
      // Saldo[1] = Saldo[0] - Valor[1]
      // If Valor[1] is income (positive value), Saldo[1] = Saldo[0] - Income[1]
      // If Valor[1] is expense (negative value in display, but positive amount), Saldo[1] = Saldo[0] - Expense[1] (assuming Expense[1] is positive number)
      // The `amount` field is always positive.
      // The prefix (+/-) is visual.
      // So, if current is income: Saldo_Visual[i] = Saldo_Visual[i-1] - currentVisualRowTx.amount
      // If current is expense: Saldo_Visual[i] = Saldo_Visual[i-1] + currentVisualRowTx.amount
      // If current is transfer out (from selected account): Saldo_Visual[i] = Saldo_Visual[i-1] + currentVisualRowTx.amount
      // If current is transfer in (to selected account): Saldo_Visual[i] = Saldo_Visual[i-1] - currentVisualRowTx.amount

      let newProgressiveBalance = prevVisualRowTx.progressiveBalance;
      const currentTxAmount = parseFloat(currentVisualRowTx.amount);

      if (filters.accountId !== "all") { // Single Account
          const selectedId = filters.accountId;
          if (currentVisualRowTx.account_id === selectedId) { // Transaction is FROM selected account
              if (currentVisualRowTx.transaction_type === 'income') newProgressiveBalance -= currentTxAmount;
              else if (currentVisualRowTx.transaction_type === 'expense') newProgressiveBalance += currentTxAmount;
              else if (currentVisualRowTx.transaction_type === 'transfer') newProgressiveBalance += currentTxAmount; // Transfer OUT
          } else if (currentVisualRowTx.destination_account_id === selectedId && currentVisualRowTx.transaction_type === 'transfer') { // Transfer IN TO selected account
              newProgressiveBalance -= currentTxAmount;
          }
          // If transaction does not involve the selected account, saldo should ideally not change due to this tx.
          // However, the request is "saldo da linha anterior MENOS o VALOR da segunda linha".
          // This implies the "valor" itself, as displayed, is always subtracted. This needs clarification if "valor" means absolute amount or signed amount.
          // Given "Valor" column shows absolute numbers with a +/- prefix, let's assume "valor" means the number itself.
          // The logic above correctly implements: Saldo_novo = Saldo_anterior +/- Efeito_da_transacao_atual_no_saldo.
          // If "menos o valor da segunda linha" means literally subtracting the positive number shown in "Valor" column, regardless of type:
          // This would be: newProgressiveBalance = prevVisualRowTx.progressiveBalance - currentTxAmount; (This seems too simple and likely incorrect for accounting)

          // Sticking to the accounting logic: Saldo_Antes_Tx = Saldo_Depois_Tx_Anterior -/+ Efeito_Tx_Atual
          // Saldo_Visual[i] (Saldo ANTES Tx_i)
          // Saldo_Visual[i-1] (Saldo DEPOIS Tx_i-1)
          // Tx_i is older than Tx_i-1.
          // Balance_before_Tx_i = Balance_after_Tx_i - (effect of Tx_i)
          // The `progressiveBalance` from map is Balance_after_Tx_i.
          // So `transactionsWithProgressiveBalance[i].progressiveBalance` is already Balance_after_Tx_i.
          // The request is: "na segunda linha apresentaria o saldo da primeira linha menos o valor da segunda linha"
          // Saldo_Linha_2 = Saldo_Linha_1 - Valor_Linha_2
          // This means `transactionsWithProgressiveBalance[i].progressiveBalance` should be `transactionsWithProgressiveBalance[i-1].progressiveBalance` adjusted.

      } else { // All Accounts
          if (currentVisualRowTx.transaction_type === 'income') newProgressiveBalance -= currentTxAmount;
          else if (currentVisualRowTx.transaction_type === 'expense') newProgressiveBalance += currentTxAmount;
          // Transfers are neutral, no change to newProgressiveBalance from prevVisualRowTx.progressiveBalance
      }
       transactionsWithProgressiveBalance[i].progressiveBalance = newProgressiveBalance;
       transactionsWithProgressiveBalance[i].progressiveBalanceCurrency = prevVisualRowTx.progressiveBalanceCurrency;
    }
  }

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
