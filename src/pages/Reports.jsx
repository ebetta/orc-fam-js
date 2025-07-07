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
import { startOfMonth, endOfMonth } from "date-fns";

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
      
      const budgetsWithSpent = budgetsData.map(budget => {
        const budgetStartDate = new Date(budget.start_date);
        const budgetEndDate = new Date(budget.end_date);
        const spent_amount = transactionsData
          .filter(t => 
            t.transaction_type === 'expense' &&
            t.tag_id === budget.tag_id && // UUID comparison
            new Date(t.transaction_date) >= budgetStartDate &&
            new Date(t.transaction_date) <= budgetEndDate
          )
          .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
        return { ...budget, spent_amount };
      });
      setAllBudgets(budgetsWithSpent);

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

  const filteredBudgets = useMemo(() => {
     if (isLoading) return [];
     const selectedTagIds = Object.keys(filters.selectedTags).filter(id => filters.selectedTags[id]);

     return allBudgets.filter(b => selectedTagIds.includes(b.tag_id));

  }, [allBudgets, filters.selectedTags, isLoading]);

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
              budgets={filteredBudgets}
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