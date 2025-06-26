
import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, MoreVertical, Tag as TagIconLucide, AlertTriangle, TrendingUp, TrendingDown, Target } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns"; // Adicionar import para formatação de datas

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(amount || 0);
};

const getProgressColor = (percentage) => {
  if (percentage > 100) return 'var(--tw-color-red-500)';
  if (percentage >= 80) return 'var(--tw-color-yellow-500)';
  if (percentage >= 50) return 'var(--tw-color-blue-500)';
  return 'var(--tw-color-green-500)';
};


export default function BudgetsList({ 
  groupedBudgets, 
  isLoading, 
  onEditBudget, 
  onDeleteBudget,
  currentPeriodFilter // Novo prop para receber o filtro de período atual
}) {
  const navigate = useNavigate();

  const handleSpentAmountClick = (tagId) => {
    if (!tagId) return;
    
    let periodParams = '';
    
    // Construir parâmetros de período baseado no filtro atual da tela de orçamentos
    if (currentPeriodFilter && currentPeriodFilter !== 'all') {
      const today = new Date();
      let periodStart, periodEnd;
      
      switch (currentPeriodFilter) {
        case "current_month":
          periodStart = new Date(today.getFullYear(), today.getMonth(), 1);
          periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          break;
        case "last_month":
          const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          periodStart = lastMonth;
          periodEnd = new Date(today.getFullYear(), today.getMonth(), 0);
          break;
        case "two_months_ago":
          const twoMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, 1);
          periodStart = twoMonthsAgo;
          periodEnd = new Date(today.getFullYear(), today.getMonth() - 1, 0);
          break;
        case "current_quarter":
          const quarter = Math.floor(today.getMonth() / 3);
          periodStart = new Date(today.getFullYear(), quarter * 3, 1);
          periodEnd = new Date(today.getFullYear(), quarter * 3 + 3, 0);
          break;
        case "this_year":
          periodStart = new Date(today.getFullYear(), 0, 1);
          periodEnd = new Date(today.getFullYear(), 11, 31);
          break;
      }
      
      if (periodStart && periodEnd) {
        const fromDate = format(periodStart, 'yyyy-MM-dd');
        const toDate = format(periodEnd, 'yyyy-MM-dd');
        periodParams = `&periodFrom=${fromDate}&periodTo=${toDate}`;
      }
    }
    
    const url = `${createPageUrl('Transactions')}?tagId=${tagId}${periodParams}`;
    navigate(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => (
          <div key={i} className="bg-white p-4 rounded-lg shadow">
            <Skeleton className="h-8 w-3/4 mb-3" />
            <Skeleton className="h-6 w-full mb-1" />
            <Skeleton className="h-6 w-5/6" />
          </div>
        ))}
      </div>
    );
  }

  if (groupedBudgets.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-20 bg-white shadow-lg rounded-xl border"
      >
        <Target className="w-16 h-16 text-gray-300 mx-auto mb-6" />
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          Nenhum orçamento para exibir
        </h3>
        <p className="text-gray-600 text-lg">
          Crie orçamentos para começar a planejar seus gastos por categoria.
        </p>
      </motion.div>
    );
  }

  return (
    <Accordion type="multiple" className="w-full space-y-4">
      {groupedBudgets.map((group, groupIndex) => {
        const groupPercentage = group.groupTotalOrcado > 0 ? (group.groupTotalGasto / group.groupTotalOrcado) * 100 : 0;
        const progressColor = getProgressColor(groupPercentage);

        return (
          <AccordionItem value={`group-${group.parentTag.id || groupIndex}`} key={group.parentTag.id || groupIndex} className="bg-white shadow-lg rounded-xl border overflow-hidden">
            <AccordionTrigger className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex-1 mr-4">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between w-full gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div 
                      className="w-3 h-6 rounded-sm shrink-0" 
                      style={{ backgroundColor: group.parentTag.color || '#A1A1AA' }} 
                    />
                    <h3 className="text-lg font-semibold text-gray-800 text-left">{group.parentTag.name}</h3>
                    <Badge variant="outline">{group.budgets.length} orçamento{group.budgets.length !== 1 ? 's' : ''}</Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-sm w-full md:w-auto mt-3 md:mt-0">
                    <div className="text-left md:text-right">
                      <span className="text-gray-500 block">Orçado</span>
                      <span className="font-medium text-gray-800">{formatCurrency(group.groupTotalOrcado)}</span>
                    </div>
                    <div className="text-left md:text-right">
                      <span className="text-gray-500 block">Gasto</span>
                      <span className="font-medium text-gray-800">
                        {formatCurrency(group.groupTotalGasto)}
                      </span>
                    </div>
                    <div className="text-left md:text-right col-span-2 md:col-span-1">
                      <span className="text-gray-500 block">Disponível</span>
                      <span className={`font-medium ${group.groupTotalDisponivel < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(group.groupTotalDisponivel)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="w-full mt-3">
                  <Progress value={Math.min(groupPercentage, 100)} className="h-2" style={{ '--progress-background': progressColor }} />
                  <div className="flex justify-between text-xs mt-1">
                      <span style={{color: progressColor}} className="font-medium">
                          {groupPercentage.toFixed(1)}% do total orçado para esta categoria
                      </span>
                      {groupPercentage > 100 && <AlertTriangle className="inline w-3.5 h-3.5 ml-1 text-red-500" />}
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="border-t bg-gray-50/50">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Tag Específica</TableHead>
                    <TableHead className="text-right">Orçado</TableHead>
                    <TableHead className="text-right">Gasto</TableHead>
                    <TableHead className="text-right">Disponível</TableHead>
                    <TableHead className="w-[150px]">Progresso</TableHead>
                    <TableHead className="text-right pr-6 w-[80px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.budgets
                    .slice() // Create a shallow copy to avoid mutating the original array
                    .sort((a, b) => (b.total_budgeted_for_period ?? b.amount ?? 0) - (a.total_budgeted_for_period ?? a.amount ?? 0))
                    .map(budget => {
                    const individualSpent = budget.spent_amount || 0;
                    const individualTotal = budget.total_budgeted_for_period ?? budget.amount ?? 0;
                    const individualPercentage = individualTotal > 0 ? (individualSpent / individualTotal) * 100 : 0;
                    const individualDisponivel = individualTotal - individualSpent;
                    const individualProgressColor = getProgressColor(individualPercentage);

                    return (
                      <TableRow key={budget.id} className="hover:bg-gray-100">
                        <TableCell className="pl-6">
                          <div className="flex items-center gap-1.5 text-sm">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{backgroundColor: budget.tagColor}} />
                            {budget.tagName}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(individualTotal)}</TableCell>
                        <TableCell 
                          className="text-right font-medium hover:underline cursor-pointer text-blue-600"
                          onClick={() => handleSpentAmountClick(budget.tag_id)}
                          title="Ver transações desta tag no período selecionado"
                        >
                          {formatCurrency(individualSpent)}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${individualDisponivel < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(individualDisponivel)}
                        </TableCell>
                        <TableCell>
                          <Progress value={Math.min(individualPercentage,100)} className="h-1.5" style={{'--progress-background': individualProgressColor}} />
                          <span className="text-xs" style={{color: individualProgressColor}}>{individualPercentage.toFixed(0)}%</span>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onEditBudget(budget)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => onDeleteBudget(budget.id)} className="text-red-600 hover:!text-red-600 hover:!bg-red-50">
                                <Trash2 className="w-4 h-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
