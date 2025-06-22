
import React, { useState, useEffect, useCallback } from "react";
import { Budget } from "@/api/entities";
import { Tag } from "@/api/entities";
import { Transaction } from "@/api/entities";
import { motion } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import {
  startOfMonth, endOfMonth, subMonths, parseISO, isWithinInterval,
  max, min, startOfYear, endOfYear, startOfQuarter, endOfQuarter,
  differenceInCalendarMonths, differenceInCalendarWeeks, differenceInCalendarYears
} from "date-fns";


import BudgetsHeader from "../components/budgets/BudgetsHeader";
import BudgetForm from "../components/budgets/BudgetForm";
import BudgetsList from "../components/budgets/BudgetsList";

// Helper para calcular o número de períodos de um orçamento dentro do filtro
const getNumberOfPeriods = (budget, filterStart, filterEnd) => {
    if (!filterStart || !filterEnd) return 1; // Para o filtro "Todos os períodos"

    // Intersecção entre o período do orçamento e o período do filtro
    const budgetStart = max([parseISO(budget.start_date), filterStart]);
    const budgetEnd = min([parseISO(budget.end_date), filterEnd]);

    if (budgetEnd < budgetStart) return 0; // Orçamento fora do período do filtro

    switch (budget.period) {
        case 'monthly':
            return differenceInCalendarMonths(budgetEnd, budgetStart) + 1;
        case 'weekly':
            return differenceInCalendarWeeks(budgetEnd, budgetStart, { weekStartsOn: 1 }) + 1;
        case 'yearly':
            return differenceInCalendarYears(budgetEnd, budgetStart) + 1;
        default:
            return 1;
    }
};

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState([]);
  const [tags, setTags] = useState([]);
  const [transactions, setTransactions] = useState([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const { toast } = useToast();

  const [filters, setFilters] = useState({
    period: "current_month",
    tagId: "all",
    status: "all", 
  });

  const [groupedBudgetsForAccordion, setGroupedBudgetsForAccordion] = useState([]);
  const [summaryTotals, setSummaryTotals] = useState({ orcado: 0, gasto: 0, disponivel: 0 });

  const calculateSpentAmountForPeriod = useCallback((budget, transactionsInPeriod) => {
    if (!budget.tag_id) return 0;

    return transactionsInPeriod
      .filter(t => t.transaction_type === 'expense' && t.tag_id === budget.tag_id)
      .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
  }, []);

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [budgetsData, tagsData, transactionsData] = await Promise.all([
        Budget.list("-updated_date"),
        Tag.list(),
        Transaction.list()
      ]);
      
      setBudgets(budgetsData.filter(b => b.is_active !== false)); // No spent amount calculation here
      setTags(tagsData.filter(t => t.is_active !== false && (t.tag_type === 'expense' || t.tag_type === 'both')));
      setTransactions(transactionsData);

    } catch (error) {
      console.error("Erro ao carregar dados de orçamentos:", error);
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
  
  // Efeito principal para filtrar e agrupar orçamentos baseado no período selecionado
  useEffect(() => {
    if (isLoading) return;

    // 1. Determinar o intervalo de datas do filtro
    let periodStart, periodEnd;
    const today = new Date();

    switch (filters.period) {
        case "current_month":
            periodStart = startOfMonth(today);
            periodEnd = endOfMonth(today);
            break;
        case "last_month":
            const lastMonth = subMonths(today, 1);
            periodStart = startOfMonth(lastMonth);
            periodEnd = endOfMonth(lastMonth);
            break;
        case "two_months_ago":
            const twoMonthsAgo = subMonths(today, 2);
            periodStart = startOfMonth(twoMonthsAgo);
            periodEnd = endOfMonth(twoMonthsAgo);
            break;
        case "current_quarter":
            periodStart = startOfQuarter(today);
            periodEnd = endOfQuarter(today);
            break;
        case "this_year":
            periodStart = startOfYear(today);
            periodEnd = endOfYear(today);
            break;
        case "all":
        default:
          break; 
    }

    // 2. Filtrar transações para corresponder ao período do filtro
    const transactionsForPeriod = periodStart && periodEnd
        ? transactions.filter(t => {
            const transactionDate = parseISO(t.transaction_date);
            return isWithinInterval(transactionDate, { start: periodStart, end: periodEnd });
        })
        : transactions;

    // 3. Filtrar orçamentos que são relevantes para o período do filtro
    const relevantBudgets = periodStart && periodEnd
      ? budgets.filter(budget => {
          const budgetStart = parseISO(budget.start_date);
          const budgetEnd = parseISO(budget.end_date);
          return budgetStart <= periodEnd && budgetEnd >= periodStart;
        })
      : budgets;

    // 4. Calcular o 'gasto' e 'orçado' para cada orçamento relevante usando apenas as transações do período
    const budgetsWithCalculations = relevantBudgets.map(budget => {
      const periodsInFilter = getNumberOfPeriods(budget, periodStart, periodEnd);
      const totalBudgetedForPeriod = (parseFloat(budget.amount) || 0) * periodsInFilter;
      
      return {
        ...budget,
        spent_amount: calculateSpentAmountForPeriod(budget, transactionsForPeriod),
        total_budgeted_for_period: totalBudgetedForPeriod,
      }
    });

    // 5. Calcular os totais para o cabeçalho usando os orçamentos e gastos calculados
    const totalOrcado = budgetsWithCalculations.reduce((sum, b) => sum + (b.total_budgeted_for_period || 0), 0);
    const totalGasto = budgetsWithCalculations.reduce((sum, b) => sum + (parseFloat(b.spent_amount) || 0), 0);
    setSummaryTotals({
        orcado: totalOrcado,
        gasto: totalGasto,
        disponivel: totalOrcado - totalGasto,
    });

    // 6. Agrupar os orçamentos calculados para o Accordion
    if (!tags.length || !budgetsWithCalculations.length) {
      setGroupedBudgetsForAccordion([]);
      return;
    }

    const activeExpenseTags = tags.filter(t => t.is_active !== false && (t.tag_type === 'expense' || t.tag_type === 'both'));
    const tagMap = Object.fromEntries(activeExpenseTags.map(t => [t.id, t]));

    const getRootTagForBudget = (budgetTagId) => {
      let currentTag = tagMap[budgetTagId];
      if (!currentTag) { 
        return { id: `no_valid_tag_for_${budgetTagId}`, name: 'Orçamentos (Tag Inválida/Não Agrupável)', color: '#9ca3af', isRoot: true };
      }
      
      let rootTag = currentTag;
      while (rootTag.parent_tag_id && tagMap[rootTag.parent_tag_id]) {
        const parent = tagMap[rootTag.parent_tag_id];
        if (parent.tag_type === 'income' || parent.is_active === false) break;
        rootTag = parent;
      }
      return { ...rootTag, isRoot: true };
    };

    const groups = {};

    budgetsWithCalculations.forEach(budget => {
      if (!budget.tag_id) return; 

      const rootTag = getRootTagForBudget(budget.tag_id);

      if (!groups[rootTag.id]) {
        groups[rootTag.id] = { 
          parentTag: rootTag, 
          budgets: [], 
          groupTotalOrcado: 0, 
          groupTotalGasto: 0 
        };
      }
      
      const budgetTagDetails = tagMap[budget.tag_id];
      groups[rootTag.id].budgets.push({
        ...budget,
        tagName: budgetTagDetails?.name || 'Tag Original Desconhecida',
        tagColor: budgetTagDetails?.color || '#cccccc'
      });
      groups[rootTag.id].groupTotalOrcado += budget.total_budgeted_for_period || 0;
      groups[rootTag.id].groupTotalGasto += parseFloat(budget.spent_amount || 0);
    });

    const processedGroups = Object.values(groups).map(group => ({
      ...group,
      groupTotalDisponivel: group.groupTotalOrcado - group.groupTotalGasto
    })).sort((a,b) => {
      if (b.groupTotalGasto !== a.groupTotalGasto) {
        return b.groupTotalGasto - a.groupTotalGasto;
      }
      return b.groupTotalOrcado - a.groupTotalOrcado;
    });

    setGroupedBudgetsForAccordion(processedGroups);

  }, [budgets, transactions, tags, isLoading, filters.period, calculateSpentAmountForPeriod]);


  const handleFormSubmit = async (budgetData) => {
    try {
      const dataToSave = { ...budgetData };

      if (editingBudget) {
        await Budget.update(editingBudget.id, dataToSave);
        toast({
          title: "Orçamento Atualizado!",
          description: `O orçamento "${budgetData.name}" foi atualizado.`,
          className: "bg-green-100 text-green-800 border-green-300",
        });
      } else {
        await Budget.create({...dataToSave, spent_amount: 0}); // Garante que spent_amount é 0 ao criar
        toast({
          title: "Orçamento Criado!",
          description: `O orçamento "${budgetData.name}" foi criado.`,
          className: "bg-green-100 text-green-800 border-green-300",
        });
      }
      setShowForm(false);
      setEditingBudget(null);
      loadInitialData(); // Recarrega e re-calcula spent_amounts e agrupamentos
    } catch (error) {
      console.error("Erro ao salvar orçamento:", error);
      toast({
        title: "Erro ao salvar orçamento",
        description: "Não foi possível salvar. Verifique os dados e tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleEditBudget = (budget) => {
    setEditingBudget(budget);
    setShowForm(true);
  };

  const handleDeleteBudget = async (budgetId) => {
     try {
      const budgetToDelete = budgets.find(b => b.id === budgetId); // Encontra na lista original
      await Budget.delete(budgetId);
      toast({
        title: "Orçamento Excluído!",
        description: `O orçamento "${budgetToDelete?.name}" foi excluído.`,
      });
      loadInitialData(); // Recarrega e re-calcula
    } catch (error) {
      console.error("Erro ao excluir orçamento:", error);
      toast({
        title: "Erro ao excluir orçamento",
        variant: "destructive",
      });
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingBudget(null);
  };
  
  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <BudgetsHeader
          onAddBudget={() => { setEditingBudget(null); setShowForm(true); }}
          tags={tags} // tags filtradas para despesa/ambos e ativas
          filters={filters}
          onFiltersChange={setFilters}
          budgetsCount={budgets.length} // Contagem de orçamentos ativos individuais
          summaryTotals={summaryTotals} // Passar os totais para o header
        />
      </motion.div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-40 flex justify-center items-center p-4 overflow-auto"
          onClick={handleCancelForm} 
        >
            <div onClick={e => e.stopPropagation()} className="w-full max-w-2xl">
                 <BudgetForm
                    budget={editingBudget}
                    tags={tags} // Passa as mesmas tags filtradas para o formulário
                    onSave={handleFormSubmit}
                    onCancel={handleCancelForm}
                />
            </div>
        </motion.div>
      )}
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <BudgetsList
          groupedBudgets={groupedBudgetsForAccordion}
          isLoading={isLoading}
          onEditBudget={handleEditBudget}
          onDeleteBudget={handleDeleteBudget}
          currentPeriodFilter={filters.period} // Passar o filtro de período atual
        />
      </motion.div>
    </div>
  );
}
