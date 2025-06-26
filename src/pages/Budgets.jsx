
import React, { useState, useEffect, useCallback } from "react";
// import { Budget } from "@/api/entities"; // Removed
// import { Tag } from "@/api/entities"; // Removed
// import { Transaction } from "@/api/entities"; // Removed
import { supabase } from "@/lib/supabaseClient"; // Added
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
    if (!budget.tag_id_base44) return 0; // Alterado para tag_id_base44

    return transactionsInPeriod
      .filter(t => t.transaction_type === 'expense' && t.tag_id_base44 === budget.tag_id_base44) // Alterado para tag_id_base44 (assumindo que transactions também usa)
      .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
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

      const [budgetsResponse, tagsResponse, transactionsResponse] = await Promise.all([
        supabase.from('budgets').select('*').order('updated_at', { ascending: false }),
        supabase.from('tags').select('*'),
        supabase.from('transactions').select('*')
      ]);

      if (budgetsResponse.error) throw budgetsResponse.error;
      if (tagsResponse.error) throw tagsResponse.error;
      if (transactionsResponse.error) throw transactionsResponse.error;
      
      setBudgets((budgetsResponse.data || []).filter(b => b.is_active !== false));
      setTags((tagsResponse.data || []).filter(t => t.is_active !== false && (t.tag_type === 'expense' || t.tag_type === 'both')));
      setTransactions(transactionsResponse.data || []);

    } catch (error) {
      console.error("Erro ao carregar dados de orçamentos:", error.message);
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

    // Mapa de tags pelo ID primário do Supabase (coluna 'id')
    // Este será o único mapa necessário para tags.
    const tagMapById = Object.fromEntries(activeExpenseTags.map(t => [t.id, t]));

    const getRootTagForBudget = (budgetTagId) => { // budgetTagId é o `budget.tag_id_base44` que contém o UUID da tag
      // 1. Encontrar a tag específica do orçamento usando o ID fornecido pelo orçamento.
      // Este ID (budget.tag_id_base44) é esperado ser o UUID da tag (tags.id).
      let currentTag = tagMapById[budgetTagId];

      if (!currentTag) { 
        // Se o budget.tag_id_base44 não corresponder a nenhum tags.id conhecido.
        return {
          id: `unmapped_budget_tag_${budgetTagId}`,
          name: 'Orçamentos (Tag do Orçamento não encontrada no mapa de tags)',
          color: '#9ca3af',
          isRoot: true
        };
      }
      
      // currentTag é a tag do Supabase que corresponde ao budget.tag_id_base44 (que é um tags.id).
      // A lógica de subida na hierarquia usa o campo 'parent_tag_id_base44' (que contém o 'id' UUID do pai).
      let rootTag = currentTag;
      while (rootTag.parent_tag_id_base44 && tagMapById[rootTag.parent_tag_id_base44]) {
        const parent = tagMapById[rootTag.parent_tag_id_base44];
        // Não subir para pais que são de 'income' ou inativos.
        if (parent.tag_type === 'income' || parent.is_active === false) break;
        rootTag = parent;
      }
      return { ...rootTag, isRoot: true };
    };

    const groups = {};

    budgetsWithCalculations.forEach(budget => {
      // budget.tag_id_base44 é o ID (UUID) que o orçamento usa para referenciar uma tag na tabela 'tags'.
      if (!budget.tag_id_base44) {
          return; // Orçamentos sem tag_id_base44 não podem ser agrupados.
      }

      const rootTag = getRootTagForBudget(budget.tag_id_base44);

      // Agrupar pelo 'id' (UUID) da rootTag encontrada.
      if (!groups[rootTag.id]) {
        groups[rootTag.id] = { 
          parentTag: rootTag, 
          budgets: [], 
          groupTotalOrcado: 0, 
          groupTotalGasto: 0 
        };
      }
      
      // Detalhes da tag específica do orçamento (usando budget.tag_id_base44 para encontrar a tag em tagMapById)
      const budgetSpecificTagDetails = tagMapById[budget.tag_id_base44];
      groups[rootTag.id].budgets.push({
        ...budget,
        // Usar o nome e cor da tag específica do orçamento.
        tagName: budgetSpecificTagDetails?.name || 'Tag do Orçamento Desconhecida', // Deveria ser encontrada se budget.tag_id_base44 é um UUID válido em tagMapById
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

  }, [budgets, transactions, tags, isLoading, filters.period, calculateSpentAmountForPeriod]);


  const handleFormSubmit = async (budgetData) => {
    try {
      const dataToSave = { ...budgetData }; // Ensure budgetData from form matches table columns
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      if (editingBudget) {
        const { error } = await supabase
          .from('budgets')
          .update(dataToSave)
          .eq('id', editingBudget.id);
        if (error) throw error;
        toast({
          title: "Orçamento Atualizado!",
          description: `O orçamento "${budgetData.name}" foi atualizado.`,
          className: "bg-green-100 text-green-800 border-green-300",
        });
      } else {
        // spent_amount is not a field in the budgets table, it's calculated
        const budgetPayload = { ...dataToSave, user_id: user.id };
        // console.log("Payload para criar orçamento:", JSON.stringify(budgetPayload, null, 2)); // Log removido

        try {
          const { error } = await supabase
            .from('budgets')
            .insert([budgetPayload]);

          if (error) {
            // console.error("Erro detalhado do Supabase ao criar orçamento:", JSON.stringify(error, null, 2)); // Log removido
            throw error;
          }
          toast({
            title: "Orçamento Criado!",
            description: `O orçamento "${budgetData.name}" foi criado.`,
            className: "bg-green-100 text-green-800 border-green-300",
          });
        } catch (e) {
          // console.error("Exceção ao tentar criar orçamento:", e); // Log pode ser mantido ou removido dependendo da preferência
          throw e;
        }
      }
      setShowForm(false);
      setEditingBudget(null);
      loadInitialData();
    } catch (error) {
      console.error("Erro ao salvar orçamento:", error.message);
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
      const budgetToDelete = budgets.find(b => b.id === budgetId);
      const { error } = await supabase
        .from('budgets')
        .delete()
        .eq('id', budgetId);
      if (error) throw error;
      toast({
        title: "Orçamento Excluído!",
        description: `O orçamento "${budgetToDelete?.name}" foi excluído.`,
      });
      loadInitialData();
    } catch (error) {
      console.error("Erro ao excluir orçamento:", error.message);
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
