import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, ArrowLeftRight, Calendar } from "lucide-react";
import { motion } from "framer-motion";

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(amount || 0);
};

export default function PeriodSummary({ transactions, filters }) {
  // Só mostrar se houver um período definido
  if (!filters.period.from || !filters.period.to) {
    return null;
  }

  // Calcular totais por tipo de transação
  const totals = transactions.reduce((acc, transaction) => {
    const amount = parseFloat(transaction.amount || 0);
    
    switch (transaction.transaction_type) {
      case 'income':
        acc.income += amount;
        break;
      case 'expense':
        acc.expense += amount;
        break;
      case 'transfer':
        acc.transfer += amount;
        break;
    }
    
    return acc;
  }, { income: 0, expense: 0, transfer: 0 });

  const balance = totals.income - totals.expense;
  const totalTransactions = transactions.length;

  // Formatar período para exibição
  const formatPeriod = () => {
    const fromDate = new Date(filters.period.from.replace(/-/g, '/'));
    const toDate = new Date(filters.period.to.replace(/-/g, '/'));
    
    return `${fromDate.toLocaleDateString('pt-BR')} - ${toDate.toLocaleDateString('pt-BR')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 shadow-md">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-800">
              Resumo do Período: {formatPeriod()}
            </h3>
            <span className="text-sm text-gray-500">
              ({totalTransactions} transaç{totalTransactions !== 1 ? 'ões' : 'ão'})
            </span>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-gray-600">Receitas</span>
              </div>
              <p className="text-xl font-bold text-green-600">
                {formatCurrency(totals.income)}
              </p>
            </div>

            <div className="bg-white rounded-lg p-4 border border-red-200">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-red-600" />
                <span className="text-sm font-medium text-gray-600">Despesas</span>
              </div>
              <p className="text-xl font-bold text-red-600">
                {formatCurrency(totals.expense)}
              </p>
            </div>

            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <ArrowLeftRight className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-600">Transferências</span>
              </div>
              <p className="text-xl font-bold text-blue-600">
                {formatCurrency(totals.transfer)}
              </p>
            </div>

            <div className={`bg-white rounded-lg p-4 border ${balance >= 0 ? 'border-green-200' : 'border-red-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className={`w-4 h-4 ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                <span className="text-sm font-medium text-gray-600">Saldo</span>
              </div>
              <p className={`text-xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(balance)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}