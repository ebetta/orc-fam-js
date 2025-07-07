import React, { useState, useEffect, useMemo, useCallback } from "react";
// import { Tag } from "@/api/entities"; // Removed
// import { Transaction } from "@/api/entities"; // Removed
// import { Budget } from "@/api/entities"; // Removed
import { supabase } from "@/lib/supabaseClient"; // Added
import { motion } from "framer-motion";

import ReportsHeader from "../components/reports/ReportsHeader";
import ReportFilters from "../components/reports/ReportFilters";
import ExpensesByTagReport from "../components/reports/ExpensesByTagReport";
import BudgetReport from "../components/reports/BudgetReport";
import { startOfMonth, endOfMonth, parseISO, isWithinInterval, max, min, startOfYear, endOfYear, startOfQuarter, endOfQuarter, differenceInCalendarMonths, differenceInCalendarWeeks, differenceInCalendarYears } from "date-fns";

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

export default function ReportsPage() {
  const [allTags, setAllTags] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]);
  const [allBudgets, setAllBudgets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showExpensesReport, setShowExpensesReport] = useState(false);
  const [showBudgetReport, setShowBudgetReport] = useState(false);

  const [filters, setFilters] = useState({
    period: {
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    },
    selectedTags: {}, // e.g., { tagId1: true, tagId2: false }
    reportType: 'expenses_by_tag', // expenses_by_tag, budget
  });

  const calculateSpentAmountForPeriod = useCallback((budget, transactionsInPeriod, allTags) => {
    if (!budget.tag_id) return 0; // budget.tag_id é o ID da tag específica do orçamento.

    // Encontrar todas as tags filhas (e a própria tag) que pertencem à tag do orçamento.
    // Isso é necessário porque uma transação pode estar em uma sub-tag, mas ainda deve contar para o orçamento da tag pai.
    const relevantTagIds = new Set();
    const budgetTag = allTags.find(t => t.id === budget.tag_id);

    if (budgetTag) {
      relevantTagIds.add(budgetTag.id); // Adiciona a própria tag do orçamento

      // Função para encontrar todas as tags filhas recursivamente
      const findChildTags = (parentId) => {
        allTags.forEach(tag => {
          if (tag.parent_tag_id === parentId) {
            relevantTagIds.add(tag.id);
            findChildTags(tag.id); // Recursão para encontrar netas, etc.
          }
        });
      };

      findChildTags(budgetTag.id); // Encontra todas as tags filhas da tag do orçamento
    } else {
      // Se a tag do orçamento não for encontrada, não podemos calcular os gastos.
      // Isso pode indicar um problema de dados ou uma tag inativa.
      return 0;
    }

    return transactionsInPeriod
      .filter(t => t.transaction_type === 'expense' && relevantTagIds.has(t.tag_id)) // Verifica se a transação pertence a qualquer uma das tags relevantes (principal ou filhas)
      .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [tagsResponse, transactionsResponse, budgetsResponse] = await Promise.all([
        supabase.from('tags').select('*'),
        supabase.from('transactions').select('*'),
        supabase.from('budgets').select('*'),
      ]);

      if (tagsResponse.error) throw tagsResponse.error;
      if (transactionsResponse.error) throw transactionsResponse.error;
      if (budgetsResponse.error) throw budgetsResponse.error;

      const tagsData = tagsResponse.data || [];
      const transactionsData = transactionsResponse.data || [];
      const budgetsData = budgetsResponse.data || [];

      setAllTags(tagsData);
      setAllTransactions(transactionsData);

      const initialSelectedTags = {};
      tagsData.forEach(tag => {
        initialSelectedTags[tag.id] = true;
      });
      setFilters(prev => ({ ...prev, selectedTags: initialSelectedTags }));
      
      setAllBudgets(budgetsData);

    } catch (error) {
      console.error("Error loading report data:", error.message);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredTransactions = useMemo(() => {
    if (isLoading) return [];
    const selectedTagIds = Object.keys(filters.selectedTags).filter(id => filters.selectedTags[id]);
    
    return allTransactions.filter(t => {
      const transactionDate = new Date(t.transaction_date);
      const isAfterStart = !filters.period.from || transactionDate >= filters.period.from;
      const isBeforeEnd = !filters.period.to || transactionDate <= filters.period.to;
      const isTagSelected = selectedTagIds.includes(t.tag_id);
      
      return isAfterStart && isBeforeEnd && isTagSelected;
    });
  }, [allTransactions, filters, isLoading]);

  const [groupedBudgetsForAccordion, setGroupedBudgetsForAccordion] = useState([]);
  const [summaryTotals, setSummaryTotals] = useState({ orcado: 0, gasto: 0, disponivel: 0 });

  // Efeito principal para filtrar e agrupar orçamentos baseado no período selecionado
  useEffect(() => {
    if (isLoading) return;

    // 1. Determinar o intervalo de datas do filtro
    let periodStart, periodEnd;
    const today = new Date();

    // Use filters.period.from and filters.period.to directly
    periodStart = filters.period.from;
    periodEnd = filters.period.to;

    // 2. Filtrar transações para corresponder ao período do filtro
    const transactionsForPeriod = periodStart && periodEnd
        ? allTransactions.filter(t => {
            const transactionDate = parseISO(t.transaction_date);
            return isWithinInterval(transactionDate, { start: periodStart, end: periodEnd });
        })
        : allTransactions;

    // 3. Filtrar orçamentos que são relevantes para o período do filtro
    const relevantBudgets = periodStart && periodEnd
      ? allBudgets.filter(budget => {
          const budgetStart = parseISO(budget.start_date);
          const budgetEnd = parseISO(budget.end_date);
          return budgetStart <= periodEnd && budgetEnd >= periodStart;
        })
      : allBudgets;

    // 4. Calcular o 'gasto' e 'orçado' para cada orçamento relevante usando apenas as transações do período
    const budgetsWithCalculations = relevantBudgets.map(budget => {
      const periodsInFilter = getNumberOfPeriods(budget, periodStart, periodEnd);
      const totalBudgetedForPeriod = (parseFloat(budget.amount) || 0) * periodsInFilter;
      
      return {
        ...budget,
        spent_amount: calculateSpentAmountForPeriod(budget, transactionsForPeriod, allTags), // Pass allTags
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
    if (!allTags.length || !budgetsWithCalculations.length) {
      setGroupedBudgetsForAccordion([]);
      return;
    }

    const activeExpenseTags = allTags.filter(t => t.is_active !== false && (t.tag_type === 'expense' || t.tag_type === 'both'));

    // Mapa de tags pelo ID primário do Supabase (coluna 'id')
    const tagMapById = Object.fromEntries(activeExpenseTags.map(t => [t.id, t]));

    const getRootTagForBudget = (budgetTagId) => { // budgetTagId é o `budget.tag_id` que contém o UUID da tag
      let currentTag = tagMapById[budgetTagId];

      if (!currentTag) { 
        return {
          id: `unmapped_budget_tag_${budgetTagId}`,
          name: 'Orçamentos (Tag do Orçamento não encontrada no mapa de tags)',
          color: '#9ca3af',
          isRoot: true
        };
      }
      
      let rootTag = currentTag;
      while (rootTag.parent_tag_id && tagMapById[rootTag.parent_tag_id]) {
        const parent = tagMapById[rootTag.parent_tag_id];
        if (parent.tag_type === 'income' || parent.is_active === false) break;
        rootTag = parent;
      }
      return { ...rootTag, isRoot: true };
    };

    const groups = {};

    budgetsWithCalculations.forEach(budget => {
      if (!budget.tag_id) {
          return; // Orçamentos sem tag_id não podem ser agrupados.
      }

      const rootTag = getRootTagForBudget(budget.tag_id);

      if (!groups[rootTag.id]) {
        groups[rootTag.id] = { 
          parentTag: rootTag, 
          budgets: [], 
          groupTotalOrcado: 0, 
          groupTotalGasto: 0 
        };
      }
      
      const budgetSpecificTagDetails = tagMapById[budget.tag_id];
      groups[rootTag.id].budgets.push({
        ...budget,
        tagName: budgetSpecificTagDetails?.name || 'Tag do Orçamento Desconhecida',
        tagColor: budgetSpecificTagDetails?.color || '#cccccc'
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

  }, [allBudgets, allTransactions, allTags, isLoading, filters.period, calculateSpentAmountForPeriod]);

  const handleGenerateReport = () => {
    if (filters.reportType === 'expenses_by_tag') {
      setShowExpensesReport(true);
      setShowBudgetReport(false); // Ensure only one report is shown at a time
    } else if (filters.reportType === 'budget') {
      setShowBudgetReport(true);
      setShowExpensesReport(false); // Ensure only one report is shown at a time
    }
  };

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto min-h-screen flex flex-col">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <ReportsHeader />
      </motion.div>
      
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="flex-grow">
        <ReportFilters
          allTags={allTags}
          filters={filters}
          onFiltersChange={setFilters}
          onGenerateReport={handleGenerateReport}
          isLoading={isLoading}
        />
      </motion.div>

      {/* Popup para Relatório de Despesas */}
      {showExpensesReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex justify-center items-center p-4 overflow-auto">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-auto">
            <ExpensesByTagReport
              transactions={filteredTransactions}
              tags={allTags}
              isLoading={isLoading}
              onClose={() => setShowExpensesReport(false)}
              isPopup={true}
            />
          </div>
        </div>
      )}

      {/* Popup para Relatório de Orçamento */}
      {showBudgetReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex justify-center items-center p-4 overflow-auto">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-auto">
            <BudgetReport
              groupedBudgets={groupedBudgetsForAccordion}
              summaryTotals={summaryTotals}
              tags={allTags}
              isLoading={isLoading}
              onClose={() => setShowBudgetReport(false)}
              isPopup={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}