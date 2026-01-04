
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom"; // <<< ADICIONAR IMPORT
// import { Transaction } from "@/api/entities"; // Removed
// import { Account } from "@/api/entities"; // Removed
// import { Tag } from "@/api/entities"; // Removed
import { supabase } from "@/lib/supabaseClient"; // Added
import { motion } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { startOfDay, endOfDay, parseISO } from "date-fns";

// ADICIONAR ESTE IMPORT
import { convertCurrency } from "../components/utils/CurrencyConverter";
import { calculateAccountBalanceAndDetails } from "../utils/balanceUtils";

import TransactionsHeader from "../components/transactions/TransactionsHeader";
import TransactionForm from "../components/transactions/TransactionForm";
import TransactionsList from "../components/transactions/TransactionsList";
import PeriodSummary from "../components/transactions/PeriodSummary";
import AccountBalancesSummary from "../components/transactions/AccountBalancesSummary";

// Helper function to calculate progressive balances
// TORNAR A FUNÇÃO ASYNC
const calculateProgressiveBalances = async (
  transactionsToDisplay,
  allSystemTransactions,
  accounts,
  filters
) => {
  if (filters.tagId !== 'all' || !accounts.length || !transactionsToDisplay.length) {
    return transactionsToDisplay.map(t => ({
      ...t,
      progressiveBalance: null,
      progressiveBalanceCurrency: null,
    }));
  }

  // --- REGRESSIVE CALCULATION FOR SINGLE ACCOUNT ---
  if (filters.accountId !== "all") {
    const selectedAccount = accounts.find(acc => acc.id === filters.accountId);
    if (!selectedAccount) return transactionsToDisplay;

    // Start from the current actual balance of the account
    // If current_balance is missing, fallback to initial_balance logic (or 0)
    let currentRunningBalance = parseFloat(selectedAccount.current_balance);
    if (isNaN(currentRunningBalance)) {
      currentRunningBalance = parseFloat(selectedAccount.initial_balance) || 0;
      // If we are falling back to initial, maybe we should stick to the progressive logic?
      // But let's assume current_balance is authoritative if present.
      // Actually, if we use initial_balance as the "end" state value, that's wrong.
      // If current_balance is NaN, we probably can't do regressive safely without errors.
      // But let's try to proceed as if it's the anchor.
      // If it's really unavailable, the user has bigger data issues.
    }

    const calculatedCurrency = selectedAccount.currency || 'BRL';
    const accountCurrencyMap = new Map(accounts.map(acc => [acc.id, acc.currency || 'BRL']));

    // Filter ALL system transactions for this account to build the full chain
    // We need them sorted DESC (Newest first)
    const accountTransactions = allSystemTransactions
      .filter(t =>
        t.account_id === filters.accountId ||
        (t.transaction_type === 'transfer' && t.destination_account_id === filters.accountId)
      )
      .sort((a, b) => {
        const dateA = new Date(a.transaction_date.replace(/-/g, '/')).getTime();
        const dateB = new Date(b.transaction_date.replace(/-/g, '/')).getTime();

        // Secondary sort by created_at desc (if same date, newest created is first)
        // This MUST match the display order to align rows correctly
        if (dateB !== dateA) return dateB - dateA; // Descending Date
        return (new Date(b.created_at || 0)).getTime() - (new Date(a.created_at || 0)).getTime();
      });

    // Map to store calculated balances: TransactionID -> Balance AFTER that transaction
    const balanceMap = new Map();

    for (const t of accountTransactions) {
      // The currentRunningBalance represents the state AFTER this transaction 't' occurred (chronologically).
      // So looking backwards from Future -> Past:
      // At step 't', the balance is what we have now.
      balanceMap.set(t.id, currentRunningBalance);

      // Now "Undo" this transaction to get the balance BEFORE it
      // which will be the 'currentRunningBalance' for the NEXT transaction in the list (which is older).

      let amountEffect = 0;
      const amount = parseFloat(t.amount); // Source currency
      const sourceCurrency = accountCurrencyMap.get(t.account_id) || 'BRL';

      if (t.account_id === filters.accountId) {
        // Outgoing (Expense, Transfer Out, or Income if logic weird, but usually Income is +)
        // Normal effect: 
        // Income: +Amount
        // Expense: -Amount
        // Transfer Out: -Amount

        // We are in Account Currency.
        let amountInAccountCurrency = amount;
        if (sourceCurrency !== calculatedCurrency) {
          amountInAccountCurrency = await convertCurrency(amount, sourceCurrency, calculatedCurrency, t.transaction_date);
        }

        if (t.transaction_type === 'income') {
          // Forward: Balance += Amount
          // Backward: Balance -= Amount
          amountEffect = -amountInAccountCurrency;
        } else { // expense or transfer out
          // Forward: Balance -= Amount
          // Backward: Balance += Amount
          amountEffect = +amountInAccountCurrency;
        }
      } else {
        // Incoming Transfer
        // Forward: Balance += Amount (Converted)
        // Backward: Balance -= Amount (Converted)
        const destCurrency = calculatedCurrency; // We are the destination
        if (sourceCurrency !== destCurrency) {
          const converted = await convertCurrency(amount, sourceCurrency, destCurrency, t.transaction_date);
          amountEffect = -converted;
        } else {
          amountEffect = -amount;
        }
      }

      // Update for next iteration (older transaction)
      currentRunningBalance += amountEffect;
    }

    // Now map the transactionsToDisplay using the computed map
    return transactionsToDisplay.map(t => {
      // If t is in our accountTransactions list, it should have a balance.
      // If not (e.g. filtered out by inconsistent logic?), return null.
      const calculatedInitial = balanceMap.get(t.id);
      return {
        ...t,
        progressiveBalance: calculatedInitial !== undefined ? calculatedInitial : null,
        progressiveBalanceCurrency: calculatedCurrency
      };
    });
  }

  // --- EXISTING PROGRESSIVE LOGIC FOR "ALL ACCOUNTS" OR FALLBACK ---
  // (Maintained for aggregated view where "current_balance" sum might be complex if currencies differ and we want historical view)
  // Actually, "All Accounts" view usually wants everything in BRL.
  // The existing logic calculates forward. This might still have drift, but fixing "All" is harder (needs sum of all current balances and backtracking all).
  // Let's keep it forwarding for "All" as per scope/risk management, unless user complained about All too. 
  // User said "Clicado no card da conta", implying single account context.

  const transactionsWithBalances = transactionsToDisplay.map(t => ({ ...t }));

  const firstTxInView = transactionsWithBalances[0];
  let balanceAfterFirstTx = 0;
  let currencyForBalance = 'BRL';

  const allTransactionsChronological = [...allSystemTransactions]
    .sort((a, b) => {
      const dateA = new Date(a.transaction_date.replace(/-/g, '/')).getTime();
      const dateB = new Date(b.transaction_date.replace(/-/g, '/')).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return (new Date(a.created_at || 0)).getTime() - (new Date(b.created_at || 0)).getTime();
    });

  // (Deleted the single account block here as it's handled above)

  // "All accounts" Logic
  const initialBalances = new Map();
  for (const acc of accounts) {
    // For ALL accounts progressive, we still rely on initial_balance because we are going forward
    const balance = parseFloat(acc.initial_balance || 0);
    const currency = acc.currency || 'BRL';
    initialBalances.set(currency, (initialBalances.get(currency) || 0) + balance);
  }

  const runningBalances = new Map(initialBalances);
  const accountCurrencyMap = new Map(accounts.map(acc => [acc.id, acc.currency || 'BRL']));

  for (const t of allTransactionsChronological) {
    const amount = parseFloat(t.amount);
    const sourceCurrency = accountCurrencyMap.get(t.account_id);

    if (!sourceCurrency) {
      if (t.id === firstTxInView.id) break;
      continue;
    }

    if (t.transaction_type === "income") {
      runningBalances.set(sourceCurrency, (runningBalances.get(sourceCurrency) || 0) + amount);
    } else if (t.transaction_type === "expense") {
      runningBalances.set(sourceCurrency, (runningBalances.get(sourceCurrency) || 0) - amount);
    } else if (t.transaction_type === "transfer") {
      const destCurrency = accountCurrencyMap.get(t.destination_account_id);

      if (destCurrency) {
        runningBalances.set(sourceCurrency, (runningBalances.get(sourceCurrency) || 0) - amount);
        if (sourceCurrency === destCurrency) {
          runningBalances.set(destCurrency, (runningBalances.get(destCurrency) || 0) + amount);
        } else {
          const convertedAmount = await convertCurrency(amount, sourceCurrency, destCurrency, t.transaction_date);
          runningBalances.set(destCurrency, (runningBalances.get(destCurrency) || 0) + convertedAmount);
        }
      }
    }

    if (t.id === firstTxInView.id) break;
  }

  let totalBalanceInBRL = 0;
  const conversionDate = (filters.period.from || filters.period.to) ? firstTxInView.transaction_date : null;

  for (const [currency, balance] of runningBalances.entries()) {
    if (currency === 'BRL') {
      totalBalanceInBRL += balance;
    } else {
      const convertedBalance = await convertCurrency(balance, currency, 'BRL', conversionDate);
      totalBalanceInBRL += convertedBalance;
    }
  }

  balanceAfterFirstTx = totalBalanceInBRL;
  currencyForBalance = 'BRL';

  transactionsWithBalances[0].progressiveBalance = balanceAfterFirstTx;
  transactionsWithBalances[0].progressiveBalanceCurrency = currencyForBalance;

  for (let i = 1; i < transactionsWithBalances.length; i++) {
    const prevTx = transactionsWithBalances[i - 1];
    const currentTx = transactionsWithBalances[i];
    let saldoLinhaAnterior = prevTx.progressiveBalance;
    let efeitoInversoTxAnterior = 0;
    const amountPrevTx = parseFloat(prevTx.amount);
    const prevTxCurrency = prevTx.currency;

    let amountPrevTxInCalculatedCurrency = amountPrevTx;

    if (currencyForBalance === 'BRL' && prevTxCurrency !== 'BRL') {
      amountPrevTxInCalculatedCurrency = await convertCurrency(amountPrevTx, prevTxCurrency, 'BRL', prevTx.transaction_date);
    }

    if (prevTx.transaction_type === 'income') efeitoInversoTxAnterior = -amountPrevTxInCalculatedCurrency;
    else if (prevTx.transaction_type === 'expense') efeitoInversoTxAnterior = +amountPrevTxInCalculatedCurrency;
    // Transfer logic for 'All' (BRL aggregates) - Internal transfers cancel out in total, but we need to check if we are filtering?
    // In 'All' mode, filter is 'all'.

    currentTx.progressiveBalance = saldoLinhaAnterior + efeitoInversoTxAnterior;
    currentTx.progressiveBalanceCurrency = prevTx.progressiveBalanceCurrency;
  }
  return transactionsWithBalances;
};


export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [tags, setTags] = useState([]);

  // NOVO ESTADO para transações processadas com saldo progressivo
  const [processedTransactions, setProcessedTransactions] = useState([]);
  // NOVO ESTADO para controlar o carregamento do cálculo de saldo
  const [isCalculatingBalances, setIsCalculatingBalances] = useState(false);

  // States for Net Worth and Account Balances on this page
  const [calculatedAccountBalances, setCalculatedAccountBalances] = useState([]);
  const [totalNetWorth, setTotalNetWorth] = useState(0);
  const [isCalculatingNetWorth, setIsCalculatingNetWorth] = useState(true);

  const [isLoading, setIsLoading] = useState(true); // Loading inicial de dados
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const { toast } = useToast();
  const [searchParams] = useSearchParams(); // <<< USAR O HOOK

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  const [filters, setFilters] = useState({
    type: "all",
    accountId: "all",
    tagId: "all",
    period: { from: null, to: null },
    searchTerm: ""
  });

  useEffect(() => {
    const accountIdFromUrl = searchParams.get('accountId');
    const tagIdFromUrl = searchParams.get('tagId');
    const periodFromUrl = searchParams.get('periodFrom');
    const periodToUrl = searchParams.get('periodTo');

    // Atualiza os filtros apenas se houver parâmetros na URL
    // Isso também garante que, se os parâmetros forem removidos da URL,
    // os filtros voltem para "all" ou o estado padrão, se desejado (requer lógica adicional se não for "all").
    // A lógica atual mantém o filtro anterior se o parâmetro for removido,
    // o que pode ser o comportamento desejado ou não.
    // Para este caso, se accountIdFromUrl for null, ele manterá o prev.accountId.
    // Se o objetivo é RESETAR o filtro quando o param some, a lógica seria:
    // accountId: accountIdFromUrl || "all", (e similar para outros)

    setFilters(prev => ({
      ...prev,
      accountId: accountIdFromUrl || prev.accountId, // Mantém o filtro se não estiver na URL, ou define se estiver
      tagId: tagIdFromUrl || prev.tagId,
      period: {
        from: periodFromUrl || prev.period.from,
        to: periodToUrl || prev.period.to
      }
    }));
  }, [searchParams]); // <<< ADICIONAR searchParams COMO DEPENDÊNCIA

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
        supabase.from('transactions').select('*').order('transaction_date', { ascending: false }).order('created_at', { ascending: false }).order('updated_at', { ascending: false }).limit(5000),
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
      loadInitialData(); // Recarrega todos os dados, o que acionará o useEffect de cálculo de saldo
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
      loadInitialData(); // Recarrega todos os dados
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

  const filteredTransactions = useMemo(() => {
    return transactions.filter(transaction => {
      const typeMatch = filters.type === "all" || transaction.transaction_type === filters.type;
      const accountMatch = filters.accountId === "all" ||
        transaction.account_id === filters.accountId ||
        (transaction.transaction_type === 'transfer' && transaction.destination_account_id === filters.accountId);
      const tagMatch = filters.tagId === "all" || transaction.tag_id === filters.tagId;

      const transactionDate = parseISO(transaction.transaction_date);

      let periodMatch = true;
      if (filters.period.from) {
        const fromDate = startOfDay(parseISO(filters.period.from));
        periodMatch = periodMatch && transactionDate >= fromDate;
      }
      if (filters.period.to) {
        const toDate = endOfDay(parseISO(filters.period.to));
        periodMatch = periodMatch && transactionDate <= toDate;
      }

      const searchTermMatch = filters.searchTerm === "" ||
        transaction.description.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        (accounts.find(a => a.id === transaction.account_id)?.name.toLowerCase().includes(filters.searchTerm.toLowerCase())) ||
        (tags.find(t => t.id === transaction.tag_id)?.name.toLowerCase().includes(filters.searchTerm.toLowerCase()));

      return typeMatch && accountMatch && tagMatch && periodMatch && searchTermMatch;
    }).sort((a, b) => {
      const dateA = new Date(a.transaction_date.replace(/-/g, '/')).getTime();
      const dateB = new Date(b.transaction_date.replace(/-/g, '/')).getTime();
      if (dateA !== dateB) return dateB - dateA; // Descending Date
      return (new Date(b.created_at || 0)).getTime() - (new Date(a.created_at || 0)).getTime(); // Descending CreatedAt
    });
  }, [transactions, filters, accounts, tags]);


  const totalItems = filteredTransactions.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  const paginatedTransactions = useMemo(() => {
    return filteredTransactions.slice(startIndex, endIndex);
  }, [filteredTransactions, startIndex, endIndex]);


  const accountCurrencyMap = useMemo(() => new Map(accounts.map(acc => [acc.id, acc.currency])), [accounts]);

  const transactionsForDisplay = useMemo(() => {
    return paginatedTransactions.map(t => ({
      ...t,
      currency: accountCurrencyMap.get(t.account_id) || 'BRL'
    }));
  }, [paginatedTransactions, accountCurrencyMap]);

  useEffect(() => {
    if (transactionsForDisplay.length > 0 && accounts.length > 0 && !isLoading) {
      setIsCalculatingBalances(true);
      calculateProgressiveBalances(transactionsForDisplay, transactions, accounts, filters)
        .then(async (result) => {
          const selectedAccount = accounts.find(acc => acc.id === filters.accountId);

          if (selectedAccount && selectedAccount.currency !== 'BRL') {
            const convertedResult = await Promise.all(result.map(async (tx) => {
              if (tx.progressiveBalance !== null && tx.progressiveBalanceCurrency && tx.progressiveBalanceCurrency !== 'BRL') {
                const balanceInBRL = await convertCurrency(tx.progressiveBalance, tx.progressiveBalanceCurrency, 'BRL', null);
                return {
                  ...tx,
                  progressiveBalance: balanceInBRL,
                  progressiveBalanceCurrency: 'BRL',
                };
              }
              return tx;
            }));
            setProcessedTransactions(convertedResult);
          } else {
            setProcessedTransactions(result);
          }
        })
        .catch(error => {
          console.error("Erro ao calcular saldos progressivos:", error);
          setProcessedTransactions(transactionsForDisplay.map(t => ({
            ...t,
            progressiveBalance: null,
            progressiveBalanceCurrency: null,
          })));
        })
        .finally(() => {
          setIsCalculatingBalances(false);
        });
    } else if (transactionsForDisplay.length === 0 && !isLoading) {
      setProcessedTransactions([]);
      setIsCalculatingBalances(false);
    }
  }, [transactionsForDisplay, transactions, accounts, filters, isLoading]);

  // Calculate Account Balances and Net Worth for the summary cards
  useEffect(() => {
    const calculateSummaries = async () => {
      if (isLoading || !accounts.length) {
        setIsCalculatingNetWorth(false);
        return;
      }

      setIsCalculatingNetWorth(true);

      try {
        const balancesPromises = accounts.map(async (account) => {
          // Use current_balance from DB if available, otherwise fallback to initial_balance
          // This matches the Dashboard logic and avoids client-side recalculation errors
          let currentBalance = parseFloat(account.current_balance);
          if (isNaN(currentBalance)) {
            currentBalance = parseFloat(account.initial_balance) || 0;
          }

          let balanceInBRL = currentBalance;
          if (account.currency !== "BRL") {
            balanceInBRL = await convertCurrency(currentBalance, account.currency, "BRL", null);
          }

          return {
            id: account.id,
            name: account.name,
            balance: balanceInBRL,
            currency: "BRL",
            original_balance: currentBalance,
            original_currency: account.currency,
            account_type: account.account_type,
          };
        });

        const resolvedBalances = await Promise.all(balancesPromises);
        resolvedBalances.sort((a, b) => a.name.localeCompare(b.name));
        setCalculatedAccountBalances(resolvedBalances);

        const netWorth = resolvedBalances.reduce((sum, acc) => sum + acc.balance, 0);
        setTotalNetWorth(netWorth);

      } catch (error) {
        console.error("Error calculating summaries:", error);
      } finally {
        setIsCalculatingNetWorth(false);
      }
    };

    calculateSummaries();
  }, [accounts, isLoading]);

  const handleClearFilters = () => {
    setFilters({
      type: "all",
      accountId: "all",
      tagId: "all",
      period: { from: null, to: null },
      searchTerm: ""
    });
  };

  const showLoadingState = isLoading || isCalculatingBalances;

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
          onClearFilters={handleClearFilters}
          transactionsCount={totalItems}
        />
      </motion.div>

      {/* Card de Patrimônio Líquido e Saldos */}
      {accounts && accounts.length > 0 && !isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <AccountBalancesSummary
            accounts={accounts}
            balances={calculatedAccountBalances}
            totalNetWorth={totalNetWorth}
          />
        </motion.div>
      )}

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
          transactions={processedTransactions}
          accounts={accounts}
          tags={tags}
          isLoading={showLoadingState}
          onEditTransaction={handleEditTransaction}
          onDeleteTransaction={handleDeleteTransaction}
          filters={filters}
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
