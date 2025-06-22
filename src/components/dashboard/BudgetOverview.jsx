import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Target, Plus, ArrowRight, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

export default function BudgetOverview({ budgets, isLoading }) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  const activeBudgets = budgets.filter(budget => budget.is_active !== false);
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const currentMonthBudgets = activeBudgets.filter(budget => {
    const startDate = new Date(budget.start_date);
    const endDate = new Date(budget.end_date);
    return startDate <= currentDate && endDate >= currentDate;
  });

  const getBudgetStatus = (budget) => {
    const spent = budget.spent_amount || 0;
    const total = budget.amount;
    const percentage = (spent / total) * 100;

    if (percentage >= 100) return { status: 'exceeded', color: 'text-red-600', bgColor: 'bg-red-500' };
    if (percentage >= 80) return { status: 'warning', color: 'text-yellow-600', bgColor: 'bg-yellow-500' };
    return { status: 'good', color: 'text-green-600', bgColor: 'bg-green-500' };
  };

  return (
    <Card className="shadow-lg border-0">
      <CardHeader className="border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-orange-600" />
            Orçamentos
          </CardTitle>
          <Link to={createPageUrl("Budgets")}>
            <Button variant="outline" size="sm" className="gap-2">
              Ver todos
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>
        ) : currentMonthBudgets.length > 0 ? (
          <div className="space-y-6">
            {currentMonthBudgets.slice(0, 4).map((budget, index) => {
              const { status, color, bgColor } = getBudgetStatus(budget);
              const spent = budget.spent_amount || 0;
              const percentage = Math.min((spent / budget.amount) * 100, 100);
              
              return (
                <motion.div
                  key={budget.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">{budget.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-gray-600">
                          {formatCurrency(spent)} de {formatCurrency(budget.amount)}
                        </span>
                        {status === 'exceeded' && (
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                    </div>
                    <div className={`text-sm font-medium ${color}`}>
                      {percentage.toFixed(0)}%
                    </div>
                  </div>
                  
                  <Progress 
                    value={percentage} 
                    className="h-2"
                    style={{
                      '--progress-background': status === 'exceeded' 
                        ? '#ef4444' 
                        : status === 'warning' 
                        ? '#f59e0b' 
                        : '#10b981'
                    }}
                  />
                  
                  {status === 'exceeded' && (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Orçamento excedido em {formatCurrency(spent - budget.amount)}
                    </p>
                  )}
                </motion.div>
              );
            })}
            
            {currentMonthBudgets.length > 4 && (
              <div className="text-center pt-2">
                <Link to={createPageUrl("Budgets")}>
                  <Button variant="ghost" size="sm" className="text-blue-600">
                    Ver mais {currentMonthBudgets.length - 4} orçamento{currentMonthBudgets.length - 4 !== 1 ? 's' : ''}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8"
          >
            <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhum orçamento ativo
            </h3>
            <p className="text-gray-600 mb-6 text-sm">
              Crie orçamentos para acompanhar seus gastos mensais
            </p>
            <Link to={createPageUrl("Budgets")}>
              <Button className="bg-orange-600 hover:bg-orange-700">
                <Plus className="w-4 h-4 mr-2" />
                Criar orçamento
              </Button>
            </Link>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}