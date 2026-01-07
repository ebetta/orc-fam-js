import React, { useState, useEffect, useMemo, useCallback } from "react";
// import { Tag } from "@/api/entities"; // Removed
// import { Transaction } from "@/api/entities"; // Removed
// import { Budget } from "@/api/entities"; // Removed
import { supabase } from "@/lib/supabaseClient"; // Added
import { motion } from "framer-motion";
import { FileDown, Printer, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

import ReportsHeader from "../components/reports/ReportsHeader";
import ReportFilters from "../components/reports/ReportFilters";
import ExpensesByTagReport from "../components/reports/ExpensesByTagReport";
import BudgetReport from "../components/reports/BudgetReport";
import { startOfMonth, endOfMonth, parseISO, isWithinInterval, max, min, startOfYear, endOfYear, startOfQuarter, endOfQuarter, differenceInCalendarMonths, differenceInCalendarWeeks, differenceInCalendarYears, format } from "date-fns";

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
        supabase.from('transactions').select('*').order('transaction_date', { ascending: false }).limit(5000),
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
      // Use string comparison for dates to avoid timezone issues
      const transactionDateStr = t.transaction_date;

      let isAfterStart = true;
      if (filters.period.from) {
        const fromStr = format(filters.period.from, 'yyyy-MM-dd');
        isAfterStart = transactionDateStr >= fromStr;
      }

      let isBeforeEnd = true;
      if (filters.period.to) {
        const toStr = format(filters.period.to, 'yyyy-MM-dd');
        isBeforeEnd = transactionDateStr <= toStr;
      }

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

    // Use filters.period.from and filters.period.to directly
    periodStart = filters.period.from;
    periodEnd = filters.period.to;

    // 2. Filtrar transações para corresponder ao período do filtro
    const transactionsForPeriod = periodStart && periodEnd
      ? allTransactions.filter(t => {
        const startStr = format(periodStart, 'yyyy-MM-dd');
        const endStr = format(periodEnd, 'yyyy-MM-dd');
        return t.transaction_date >= startStr && t.transaction_date <= endStr;
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

    // 4. Preparar lista unificada de orçamentos (Reais + Virtuais)
    const allBudgetItems = [];

    if (allTags.length) {
      const parentTagIds = new Set(allTags.map(t => t.parent_tag_id).filter(Boolean));
      const activeExpenseTags = allTags.filter(t =>
        t.is_active !== false &&
        t.tag_type === 'expense' &&
        (t.parent_tag_id || !parentTagIds.has(t.id))
      );

      activeExpenseTags.forEach(tag => {
        // Encontrar orçamentos existentes para esta tag no período
        const tagBudgets = relevantBudgets.filter(b => b.tag_id === tag.id);

        if (tagBudgets.length > 0) {
          // Adicionar orçamentos reais
          tagBudgets.forEach(budget => {
            const periodsInFilter = getNumberOfPeriods(budget, periodStart, periodEnd);
            const totalBudgetedForPeriod = (parseFloat(budget.amount) || 0) * periodsInFilter;

            allBudgetItems.push({
              ...budget,
              tagName: tag.name,
              tagColor: tag.color,
              spent_amount: calculateSpentAmountForPeriod(budget, transactionsForPeriod, allTags),
              total_budgeted_for_period: totalBudgetedForPeriod,
              isVirtual: false
            });
          });
        } else {
          // Adicionar orçamento virtual (placeholder para a tag)
          const virtualBudget = {
            id: `virtual-${tag.id}`,
            tag_id: tag.id,
            amount: 0,
            start_date: periodStart ? format(periodStart, 'yyyy-MM-dd') : null,
            end_date: periodEnd ? format(periodEnd, 'yyyy-MM-dd') : null,
            period: 'monthly',
            tagName: tag.name,
            tagColor: tag.color,
            isVirtual: true,
            is_active: true
          };

          allBudgetItems.push({
            ...virtualBudget,
            spent_amount: calculateSpentAmountForPeriod({ tag_id: tag.id }, transactionsForPeriod, allTags),
            total_budgeted_for_period: 0
          });
        }
      });
    }

    // 5. Calcular os totais para o cabeçalho
    const totalOrcado = allBudgetItems.reduce((sum, b) => sum + (b.total_budgeted_for_period || 0), 0);
    const totalGasto = allBudgetItems.reduce((sum, b) => sum + (parseFloat(b.spent_amount) || 0), 0);
    setSummaryTotals({
      orcado: totalOrcado,
      gasto: totalGasto,
      disponivel: totalOrcado - totalGasto,
    });

    // 6. Agrupar os orçamentos para o Accordion
    if (!allBudgetItems.length) {
      setGroupedBudgetsForAccordion([]);
      return;
    }

    // Mapa de tags pelo ID
    const tagMapById = Object.fromEntries(allTags.map(t => [t.id, t]));

    const getRootTagForBudget = (budgetTagId) => {
      let currentTag = tagMapById[budgetTagId];
      if (!currentTag) {
        return {
          id: `unmapped_budget_tag_${budgetTagId}`,
          name: 'Tags Não Mapeadas',
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

    allBudgetItems.forEach(item => {
      const rootTag = getRootTagForBudget(item.tag_id);

      if (!groups[rootTag.id]) {
        groups[rootTag.id] = {
          parentTag: rootTag,
          budgets: [],
          groupTotalOrcado: 0,
          groupTotalGasto: 0
        };
      }

      groups[rootTag.id].budgets.push(item);
      groups[rootTag.id].groupTotalOrcado += item.total_budgeted_for_period || 0;
      groups[rootTag.id].groupTotalGasto += parseFloat(item.spent_amount || 0);
    });

    const processedGroups = Object.values(groups).map(group => ({
      ...group,
      groupTotalDisponivel: group.groupTotalOrcado - group.groupTotalGasto
    })).sort((a, b) => {
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
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] bg-white rounded-lg shadow-xl flex flex-col">
            {/* Header fixo com botões */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50 rounded-t-lg flex-shrink-0">
              <span className="font-semibold text-gray-700">Ações do Relatório</span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => {
                  const reportContent = document.getElementById('expenses-report-content');
                  if (reportContent) {
                    const event = new CustomEvent('exportPDF');
                    reportContent.dispatchEvent(event);
                  }
                }} title="Salvar como PDF">
                  <FileDown className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => {
                  const reportContent = document.getElementById('expenses-report-content');
                  if (reportContent) {
                    const event = new CustomEvent('printReport');
                    reportContent.dispatchEvent(event);
                  }
                }} title="Imprimir relatório">
                  <Printer className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setShowExpensesReport(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>
            {/* Conteúdo com scroll */}
            <div className="overflow-auto flex-grow">
              <ExpensesByTagReport
                transactions={filteredTransactions}
                tags={allTags}
                isLoading={isLoading}
                onClose={() => setShowExpensesReport(false)}
                isPopup={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* Popup para Relatório de Orçamento */}
      {showBudgetReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] bg-white rounded-lg shadow-xl flex flex-col">
            {/* Header fixo com botões */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50 rounded-t-lg flex-shrink-0">
              <span className="font-semibold text-gray-700">Ações do Relatório</span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => {
                  const reportContent = document.getElementById('budget-report-content');
                  if (reportContent) {
                    const event = new CustomEvent('exportPDF');
                    reportContent.dispatchEvent(event);
                  }
                }} title="Salvar como PDF">
                  <FileDown className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => {
                  const reportContent = document.getElementById('budget-report-content');
                  if (reportContent) {
                    const event = new CustomEvent('printReport');
                    reportContent.dispatchEvent(event);
                  }
                }} title="Imprimir relatório">
                  <Printer className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setShowBudgetReport(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>
            {/* Conteúdo com scroll */}
            <div className="overflow-auto flex-grow">
              <BudgetReport
                groupedBudgets={groupedBudgetsForAccordion}
                summaryTotals={summaryTotals}
                tags={allTags}
                isLoading={isLoading}
                onClose={() => setShowBudgetReport(false)}
                isPopup={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}