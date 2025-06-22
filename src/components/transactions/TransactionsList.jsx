
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Edit, 
  Trash2, 
  MoreVertical, 
  ArrowUpRight, 
  ArrowDownRight, 
  ArrowLeftRight,
  ArrowRight,
  TrendingUp,
  Inbox,
  ChevronLeft, // New import for pagination
  ChevronRight, // New import for pagination
  ChevronsLeft, // New import for pagination
  ChevronsRight // New import for pagination
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrencyWithSymbol, convertCurrency, getCurrencyExchangeRate } from "../utils/CurrencyConverter";

const getTransactionTypeDetails = (type) => {
  switch (type) {
    case 'income':
      return { label: 'Receita', icon: ArrowUpRight, color: 'text-green-600', bgColor: 'bg-green-50', valuePrefix: '+' };
    case 'expense':
      return { label: 'Despesa', icon: ArrowDownRight, color: 'text-red-600', bgColor: 'bg-red-50', valuePrefix: '-' };
    case 'transfer':
      return { label: 'Transferência', icon: ArrowLeftRight, color: 'text-blue-600', bgColor: 'bg-blue-50', valuePrefix: '' };
    default:
      return { label: type, icon: TrendingUp, color: 'text-gray-600', bgColor: 'bg-gray-50', valuePrefix: '' };
  }
};

export default function TransactionsList({ 
  transactions, // This prop now represents the transactions for the current page
  accounts, 
  tags, 
  isLoading, 
  onEditTransaction, 
  onDeleteTransaction,
  filters,
  // Pagination properties
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange
}) {

  const getAccountName = (accountId) => accounts.find(acc => acc.id === accountId)?.name || "N/A";
  const getAccountCurrency = (accountId) => accounts.find(acc => acc.id === accountId)?.currency || "BRL";
  const getTagName = (tagId) => tags.find(tag => tag.id === tagId)?.name || "N/A";

  const calculateProgressiveBalances = React.useCallback(async (sortedTransactions, selectedAccountId) => {
    if (!sortedTransactions.length) {
      return sortedTransactions.map(t => ({ ...t, balance: null }));
    }

    // Optimization: Pre-fetch all needed exchange rates
    // This ensures all necessary rates are available before calculations begin,
    // reducing redundant API calls within the loops.
    const currenciesToFetch = new Set();
    accounts.forEach(acc => {
      if (acc.currency && acc.currency !== 'BRL') currenciesToFetch.add(acc.currency);
    });
    sortedTransactions.forEach(t => {
      const sourceCurrency = accounts.find(acc => acc.id === t.account_id)?.currency;
      if (sourceCurrency && sourceCurrency !== 'BRL') currenciesToFetch.add(sourceCurrency);
      if (t.transaction_type === 'transfer' && t.destination_account_id) {
          const destCurrency = accounts.find(acc => acc.id === t.destination_account_id)?.currency;
          if (destCurrency && destCurrency !== 'BRL') currenciesToFetch.add(destCurrency);
      }
    });
    if (currenciesToFetch.size > 0) {
      await Promise.all(
        Array.from(currenciesToFetch).map(curr => getCurrencyExchangeRate(curr, 'BRL'))
      );
    }
    // End Optimization

    // Important Note: When `transactions` prop is already paginated (as per new props),
    // `sortedTransactions` will only contain transactions for the current page.
    // The progressive balance calculated here will be accurate relative to the
    // `current_balance` (or `totalBalanceInBRL`) as a starting point,
    // and then reflect changes *within this specific page*.
    // For a true "running balance" across all pages, the parent component
    // would need to calculate balances on the full dataset first, then paginate.

    if (selectedAccountId === "all") {
      let totalBalanceInBRL = 0;
      // Calculate the current total balance of all active accounts
      for (const account of accounts.filter(acc => acc.is_active !== false)) {
        const balance = account.current_balance || account.initial_balance || 0;
        const currency = account.currency || 'BRL';
        totalBalanceInBRL += await convertCurrency(balance, currency, 'BRL');
      }

      const transactionsWithBalance = [];
      // `runningBalance` represents the total balance *after* all transactions (on this page and future ones)
      let runningBalance = totalBalanceInBRL; // This is the overall current balance

      // Iterate through transactions from newest to oldest within the current page
      for (let i = 0; i < sortedTransactions.length; i++) {
        const transaction = sortedTransactions[i];
        
        // The balance displayed for the current transaction is the `runningBalance`
        // *after* this transaction and all newer ones (on this page) have occurred.
        transactionsWithBalance.push({ ...transaction, balance: runningBalance, balanceCurrency: 'BRL' });

        // Calculate the reversal effect of the *current* transaction to get the balance *before* it.
        // This will be the running balance for the next (older) transaction in the list.
        const currentTransactionAmount = parseFloat(transaction.amount || 0);
        const currentAccountCurrency = accounts.find(acc => acc.id === transaction.account_id)?.currency || 'BRL';
        
        let balanceChangeForReversal = 0; 

        if (transaction.transaction_type === 'income') {
            balanceChangeForReversal = -(await convertCurrency(currentTransactionAmount, currentAccountCurrency, 'BRL'));
        } else if (transaction.transaction_type === 'expense') {
            balanceChangeForReversal = await convertCurrency(currentTransactionAmount, currentAccountCurrency, 'BRL');
        }
        // For transfers in the "all" view, their net effect on the total portfolio balance is usually zero.
        // So, transfers don't cause a change in the runningBalance for the 'all' view.
        
        runningBalance += balanceChangeForReversal;
      }
      return transactionsWithBalance;

    } else { // For a specific selectedAccountId
      const selectedAccount = accounts.find(acc => acc.id === selectedAccountId);
      if (!selectedAccount) return sortedTransactions.map(t => ({ ...t, balance: null }));

      const accountCurrency = selectedAccount.currency || 'BRL';
      
      // Starting point: the current balance of the selected account
      let currentBalanceInAccountCurrency = selectedAccount.current_balance || selectedAccount.initial_balance || 0;
      let runningBalanceInBRL = await convertCurrency(currentBalanceInAccountCurrency, accountCurrency, 'BRL');
      
      const transactionsWithBalance = [];

      // Iterate through transactions from newest to oldest within the current page
      for (let i = 0; i < sortedTransactions.length; i++) {
        const transaction = sortedTransactions[i];
        
        transactionsWithBalance.push({ 
          ...transaction, 
          balance: runningBalanceInBRL, 
          balanceCurrency: 'BRL' // Balance is always in BRL for display
        });

        const transactionAmount = parseFloat(transaction.amount || 0);
        let balanceChangeToReverseInBRL = 0;

        // Case 1: The selected account is the source of the transaction
        if (transaction.account_id === selectedAccountId) {
            const sourceCurrency = accounts.find(acc => acc.id === transaction.account_id)?.currency || 'BRL';
            const amountInBRL = await convertCurrency(transactionAmount, sourceCurrency, 'BRL');

            if (transaction.transaction_type === 'income') {
                balanceChangeToReverseInBRL = -amountInBRL; 
            } else if (transaction.transaction_type === 'expense') {
                balanceChangeToReverseInBRL = amountInBRL; 
            } else if (transaction.transaction_type === 'transfer') {
                balanceChangeToReverseInBRL = amountInBRL; 
            }
        }
        // Case 2: The selected account is the destination of a transfer transaction
        else if (transaction.destination_account_id === selectedAccountId && transaction.transaction_type === 'transfer') {
            const sourceCurrency = accounts.find(acc => acc.id === transaction.account_id)?.currency || 'BRL';
            const amountInBRL = await convertCurrency(transactionAmount, sourceCurrency, 'BRL');
            balanceChangeToReverseInBRL = -amountInBRL;
        }
        
        runningBalanceInBRL += balanceChangeToReverseInBRL;
      }
      return transactionsWithBalance;
    }
  }, [accounts]);

  // Sort transactions by date (newest first)
  // This will sort only the transactions provided for the current page
  const sortedTransactions = React.useMemo(() => {
    return [...transactions].sort((a, b) => {
      const dateA = parseISO(a.transaction_date);
      const dateB = parseISO(b.transaction_date);
      return dateB - dateA; // Newest first
    });
  }, [transactions]);

  const [transactionsWithBalances, setTransactionsWithBalances] = React.useState([]);
  const [isCalculatingBalances, setIsCalculatingBalances] = React.useState(false);

  React.useEffect(() => {
    const processBalances = async () => {
      setIsCalculatingBalances(true);
      try {
        // `sortedTransactions` here refers to the transactions on the *current page*
        const processed = await calculateProgressiveBalances(sortedTransactions, filters?.accountId || "all");
        setTransactionsWithBalances(processed);
      } catch (error) {
        console.error('Erro ao calcular saldos:', error);
        setTransactionsWithBalances(sortedTransactions.map(t => ({ ...t, balance: null })));
      }
      setIsCalculatingBalances(false);
    };

    // Only calculate if not loading (initial fetch) and there are transactions on the current page
    // And only if the balance column is supposed to be shown (to avoid unnecessary calculations)
    if (!isLoading && transactions.length > 0 && filters?.tagId === "all" && currentPage === 1) {
      processBalances();
    } else {
      // If no transactions on current page or loading, or if balance column is hidden, clear balances
      setTransactionsWithBalances(sortedTransactions.map(t => ({ ...t, balance: null })));
    }
  }, [sortedTransactions, filters?.accountId, isLoading, calculateProgressiveBalances, transactions.length, filters?.tagId, currentPage]);

  // Determinar se deve mostrar a coluna de saldo
  // Ocultar quando uma tag específica for selecionada (diferente de "all") OU quando não estiver na primeira página
  const shouldShowBalanceColumn = filters?.tagId === "all" && currentPage === 1;

  // Componente de Paginação
  const PaginationComponent = () => {
    if (totalPages <= 1) return null; // Only show pagination if there's more than one page

    const getPageNumbers = () => {
      const pages = [];
      const maxVisiblePages = 5; // e.g., 1 ... 3 4 5 ... 10
      
      if (totalPages <= maxVisiblePages) {
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        if (currentPage <= 3) {
          for (let i = 1; i <= 4; i++) { // Show 1, 2, 3, 4
            pages.push(i);
          }
          pages.push('...');
          pages.push(totalPages);
        } else if (currentPage >= totalPages - 2) {
          pages.push(1);
          pages.push('...');
          for (let i = totalPages - 3; i <= totalPages; i++) { // Show total-3, total-2, total-1, total
            pages.push(i);
          }
        } else {
          pages.push(1);
          pages.push('...');
          for (let i = currentPage - 1; i <= currentPage + 1; i++) { // Show currentPage-1, currentPage, currentPage+1
            pages.push(i);
          }
          pages.push('...');
          pages.push(totalPages);
        }
      }
      
      return pages;
    };

    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    return (
      <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
        <div className="text-sm text-gray-600">
          Exibindo {startItem} a {endItem} de {totalItems} transações
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            className="h-8 w-8 p-0"
            aria-label="Primeira página"
          >
            <ChevronsLeft className="w-4 h-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="h-8 w-8 p-0"
            aria-label="Página anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          {getPageNumbers().map((page, index) => (
            <React.Fragment key={index}>
              {page === '...' ? (
                <span className="px-2 text-gray-400">...</span>
              ) : (
                <Button
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => onPageChange(page)}
                  className="h-8 w-8 p-0"
                  aria-label={`Página ${page}`}
                >
                  {page}
                </Button>
              )}
            </React.Fragment>
          ))}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="h-8 w-8 p-0"
            aria-label="Próxima página"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            className="h-8 w-8 p-0"
            aria-label="Última página"
          >
            <ChevronsRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card className="shadow-lg border-0">
        <CardHeader className="border-b bg-gray-50">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            Histórico de Transações
            <div className="text-xs text-blue-600 flex items-center gap-1 ml-2">
              <div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin" />
              Carregando transações...
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Descrição / Tipo</TableHead>
                <TableHead>Valor</TableHead>
                {shouldShowBalanceColumn && <TableHead>Saldo (BRL)</TableHead>}
                <TableHead>Conta / Tag</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right pr-4">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(itemsPerPage || 5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Skeleton className="w-8 h-8 rounded-md" />
                      <Skeleton className="h-5 w-32" />
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  {shouldShowBalanceColumn && <TableCell><Skeleton className="h-5 w-24" /></TableCell>}
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto rounded-md" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  }

  // Check totalItems for global empty state, as transactions might be empty for current page
  if (totalItems === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-20 bg-white shadow-lg rounded-xl border"
      >
        <Inbox className="w-16 h-16 text-gray-300 mx-auto mb-6" />
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          Nenhuma transação encontrada
        </h3>
        <p className="text-gray-600 text-lg">
          Suas transações aparecerão aqui assim que forem adicionadas ou ajuste seus filtros.
        </p>
      </motion.div>
    );
  }

  return (
    <Card className="shadow-lg border-0">
      <CardHeader className="border-b bg-gray-50">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
          Histórico de Transações
          {isCalculatingBalances && (
            <div className="text-xs text-blue-600 flex items-center gap-1 ml-2">
              <div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin" />
              Calculando saldos...
            </div>
          )}
          <span className="text-sm font-normal text-gray-500 ml-2">
            (Clique na linha para editar)
          </span>
          {filters?.tagId === "all" && currentPage > 1 && (
            <span className="text-xs text-blue-600 ml-2">
              Saldo disponível apenas na primeira página
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Descrição / Tipo</TableHead>
              <TableHead>Valor</TableHead>
              {shouldShowBalanceColumn && <TableHead>Saldo (BRL)</TableHead>}
              <TableHead>Conta / Tag</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right pr-4">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence>
              {transactionsWithBalances.map(transaction => {
                const typeDetails = getTransactionTypeDetails(transaction.transaction_type);
                const IconComponent = typeDetails.icon;
                const transactionAccountCurrency = getAccountCurrency(transaction.account_id);
                
                const handleRowClick = (e) => {
                  // Não executar se o clique foi no botão de ação ou em um de seus filhos
                  if (e.target.closest('.action-button')) {
                    return;
                  }
                  onEditTransaction(transaction);
                };
                
                return (
                  <motion.tr 
                    key={transaction.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={handleRowClick}
                  >
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${typeDetails.bgColor}`}>
                          <IconComponent className={`w-4 h-4 ${typeDetails.color}`} />
                        </div>
                        <div>
                          <span className="font-medium text-gray-900">{transaction.description}</span>
                          <Badge variant="outline" className={`text-xs ml-0 mt-1 block w-fit ${typeDetails.color} border-current`}>{typeDetails.label}</Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className={`font-semibold ${typeDetails.color}`}>
                      {typeDetails.valuePrefix}{formatCurrencyWithSymbol(transaction.amount, transactionAccountCurrency)}
                    </TableCell>
                    {shouldShowBalanceColumn && (
                      <TableCell className={`font-semibold ${transaction.balance !== null && transaction.balance < 0 ? 'text-red-600' : 'text-blue-700'}`}>
                        {transaction.balance !== null 
                          ? formatCurrencyWithSymbol(transaction.balance, 'BRL')
                          : (isCalculatingBalances ? '...' : '-') // Show '...' while balances are being calculated
                        }
                      </TableCell>
                    )}
                    <TableCell>
                      <div>
                        <span className="text-sm text-gray-800 block">{getAccountName(transaction.account_id)}</span>
                        {transaction.transaction_type === 'transfer' && transaction.destination_account_id && (
                            <span className="text-xs text-gray-500 block">
                                <ArrowRight className="inline w-3 h-3 mr-1" /> {getAccountName(transaction.destination_account_id)}
                            </span>
                        )}
                        {transaction.tag_id && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            {getTagName(transaction.tag_id)}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {format(parseISO(transaction.transaction_date), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 action-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteTransaction(transaction.id);
                        }}
                        title="Excluir transação"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </TableBody>
        </Table>
        <PaginationComponent />
      </CardContent>
    </Card>
  );
}
