
import React, { useState, useEffect, useCallback, useMemo } from "react";
// import { Transaction } from "@/api/entities"; // Removed
// import { Account } from "@/api/entities"; // Removed
// import { Tag } from "@/api/entities"; // Removed
import { supabase } from "@/lib/supabaseClient"; // Added
import { motion } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";

// ADICIONAR ESTE IMPORT
import { convertCurrency } from "../components/utils/CurrencyConverter";

import TransactionsHeader from "../components/transactions/TransactionsHeader";
import TransactionForm from "../components/transactions/TransactionForm";
import TransactionsList from "../components/transactions/TransactionsList";
import PeriodSummary from "../components/transactions/PeriodSummary";
import AccountBalancesSummary from "../components/transactions/AccountBalancesSummary"; // <<< ADICIONAR IMPORT

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

  const transactionsWithBalances = transactionsToDisplay.map(t => ({ ...t }));

  const firstTxInView = transactionsWithBalances[0];
  let balanceAfterFirstTx = 0;
  let currencyForBalance = 'BRL'; // Default para BRL quando todas as contas

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
    // MODIFICAÇÃO PRINCIPAL AQUI
    let totalInitialBalanceInBRL = 0;
    for (const acc of accounts) {
      const initialBalance = parseFloat(acc.initial_balance || 0);
      if (acc.currency === 'BRL') {
        totalInitialBalanceInBRL += initialBalance;
      } else {
        // Usa a data atual para a cotação do saldo inicial, pois não é histórico de transação
        // Passar null como data usará a cotação mais recente.
        const convertedBalance = await convertCurrency(initialBalance, acc.currency, 'BRL', null);
        totalInitialBalanceInBRL += convertedBalance;
      }
    }
    balanceAfterFirstTx = totalInitialBalanceInBRL;
    currencyForBalance = 'BRL'; // Já é BRL

    for (const t of allTransactionsChronological) {
      const amount = parseFloat(t.amount);
      // Garantir que account_id em 't' seja o ID da conta de origem da transação
      const accountForTransaction = accounts.find(a => a.id === t.account_id);
      const transactionCurrency = accountForTransaction?.currency || 'BRL';

      let amountInBRL = amount;

      if (transactionCurrency !== 'BRL') {
        // Para o impacto da transação no saldo total em BRL, converter o valor da transação para BRL
        // usando a data da transação.
        amountInBRL = await convertCurrency(amount, transactionCurrency, 'BRL', t.transaction_date);
      }

      if (t.transaction_type === "income") balanceAfterFirstTx += amountInBRL;
      else if (t.transaction_type === "expense") balanceAfterFirstTx -= amountInBRL;
      // Transferências internas entre contas monitoradas não alteram o saldo total em BRL
      // (valor sai de uma conta em BRL e entra em outra em BRL, ou moedas diferentes que se anulam quando convertidas)
      // Esta lógica assume que ambas as contas de uma transferência são parte do sistema.
      // Se uma transferência é para uma conta externa, ela se comporta como uma despesa.
      // A lógica atual não distingue transferências internas de externas explicitamente aqui.
      // Para "All accounts", uma transferência entre duas contas suas é neutra para o patrimônio total.
      if (t.id === firstTxInView.id) break;
    }
  }
  transactionsWithBalances[0].progressiveBalance = balanceAfterFirstTx;
  transactionsWithBalances[0].progressiveBalanceCurrency = currencyForBalance; // Será BRL para "all accounts"

  for (let i = 1; i < transactionsWithBalances.length; i++) {
    const prevTx = transactionsWithBalances[i-1];
    const currentTx = transactionsWithBalances[i];
    let saldoLinhaAnterior = prevTx.progressiveBalance; // Este já estará em BRL se currencyForBalance for BRL
    let efeitoInversoTxAnterior = 0;
    const amountPrevTx = parseFloat(prevTx.amount);
    // prevTx.currency é a moeda da transação (da conta de origem)
    const prevTxCurrency = prevTx.currency; // Adicionado em transactionsForDisplay

    let amountPrevTxInCalculatedCurrency = amountPrevTx;

    if (currencyForBalance === 'BRL' && prevTxCurrency !== 'BRL') {
      // Se o saldo progressivo é BRL, o efeito da transação anterior também deve ser BRL
      // A conversão deve usar a data da transação anterior
      amountPrevTxInCalculatedCurrency = await convertCurrency(amountPrevTx, prevTxCurrency, 'BRL', prevTx.transaction_date);
    } else if (currencyForBalance !== 'BRL' && prevTxCurrency !== currencyForBalance) {
      // Cenário mais complexo: saldo progressivo numa moeda X, transação numa moeda Y.
      // Para simplificar, isso não deveria acontecer se a conta específica for selecionada,
      // pois prevTxCurrency deveria ser igual a currencyForBalance.
      // Se estamos em "all accounts", currencyForBalance é BRL, e este caso é tratado acima.
      // Este console.log é para pegar casos inesperados.
      console.warn("Caso de moeda não tratado no cálculo regressivo:", currencyForBalance, prevTxCurrency);
    }


    if (filters.accountId !== "all") {
      const selectedId = filters.accountId;
      if (prevTx.account_id === selectedId) {
        if (prevTx.transaction_type === 'income') efeitoInversoTxAnterior = -amountPrevTxInCalculatedCurrency;
        else if (prevTx.transaction_type === 'expense') efeitoInversoTxAnterior = +amountPrevTxInCalculatedCurrency;
        else if (prevTx.transaction_type === 'transfer') efeitoInversoTxAnterior = +amountPrevTxInCalculatedCurrency;
      } else if (prevTx.destination_account_id === selectedId && prevTx.transaction_type === 'transfer') {
        efeitoInversoTxAnterior = -amountPrevTxInCalculatedCurrency;
      }
    } else { // Todas as Contas (currencyForBalance é BRL)
      if (prevTx.transaction_type === 'income') efeitoInversoTxAnterior = -amountPrevTxInCalculatedCurrency;
      else if (prevTx.transaction_type === 'expense') efeitoInversoTxAnterior = +amountPrevTxInCalculatedCurrency;
      // Transferências internas são neutras para o saldo total em BRL.
    }
    currentTx.progressiveBalance = saldoLinhaAnterior + efeitoInversoTxAnterior;
    currentTx.progressiveBalanceCurrency = prevTx.progressiveBalanceCurrency; // Mantém BRL
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

  const [isLoading, setIsLoading] = useState(true); // Loading inicial de dados
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const { toast } = useToast();

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
    const urlParams = new URLSearchParams(window.location.search);
    const accountIdFromUrl = urlParams.get('accountId');
    const tagIdFromUrl = urlParams.get('tagId');
    const periodFromUrl = urlParams.get('periodFrom'); // Adicionado
    const periodToUrl = urlParams.get('periodTo'); // Adicionado
    
    if (accountIdFromUrl || tagIdFromUrl || periodFromUrl || periodToUrl) { // Adicionado periodFromUrl e periodToUrl
      setFilters(prev => ({
        ...prev,
        accountId: accountIdFromUrl || prev.accountId,
        tagId: tagIdFromUrl || prev.tagId,
        period: { // Adicionado
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

      const transactionDateStr = transaction.transaction_date.split('T')[0];
      const transactionDate = new Date(transactionDateStr + "T00:00:00"); // Normalize to start of day in local timezone

      let periodMatch = true;
      if (filters.period.from) {
          const fromDateStr = filters.period.from.split('T')[0];
          const fromDate = new Date(fromDateStr + "T00:00:00");
          periodMatch = periodMatch && transactionDate >= fromDate;
      }
      if (filters.period.to) {
          const toDateStr = filters.period.to.split('T')[0];
          const toDate = new Date(toDateStr + "T00:00:00");
          periodMatch = periodMatch && transactionDate <= toDate;
      }

      const searchTermMatch = filters.searchTerm === "" ||
        transaction.description.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        (accounts.find(a => a.id === transaction.account_id)?.name.toLowerCase().includes(filters.searchTerm.toLowerCase())) ||
        (tags.find(t => t.id === transaction.tag_id)?.name.toLowerCase().includes(filters.searchTerm.toLowerCase()));

      return typeMatch && accountMatch && tagMatch && periodMatch && searchTermMatch;
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
    if (transactionsForDisplay.length > 0 && accounts.length > 0 && !isLoading) { // Adicionado !isLoading
      setIsCalculatingBalances(true);
      calculateProgressiveBalances(transactionsForDisplay, transactions, accounts, filters)
        .then(result => {
          setProcessedTransactions(result);
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
    } else if (transactionsForDisplay.length === 0 && !isLoading) { // Adicionado !isLoading
      setProcessedTransactions([]);
      setIsCalculatingBalances(false); // Garantir que pare de calcular se não houver transações
    }
  }, [transactionsForDisplay, transactions, accounts, filters, isLoading]); // Adicionado isLoading

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
          transactionsCount={totalItems}
        />
      </motion.div>

      {/* Card de Saldos das Contas */}
      {accounts && accounts.length > 0 && !isLoading && ( // Adicionado !isLoading para evitar renderização prematura
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }} // Pequeno delay para escalonar a aparição
        >
          <AccountBalancesSummary accounts={accounts} />
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
