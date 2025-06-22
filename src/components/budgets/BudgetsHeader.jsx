
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Target, Filter, TrendingUp, TrendingDown, DollarSign } from "lucide-react";

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(amount || 0);
};

export default function BudgetsHeader({
  onAddBudget,
  tags,
  filters,
  onFiltersChange,
  budgetsCount,
  summaryTotals // Receber os totais
}) {
  return (
    <Card className="bg-gradient-to-r from-orange-500 to-orange-700 border-0 shadow-xl">
      <CardContent className="p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
          <div className="text-white">
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <Target className="w-8 h-8" />
              Meus Orçamentos
            </h1>
            <p className="text-orange-100 text-lg">
              Planeje seus gastos e acompanhe seu progresso. {budgetsCount} orçamento{budgetsCount !== 1 ? 's' : ''} ativo{budgetsCount !== 1 ? 's' : ''}.
            </p>
          </div>
          
          <Button 
            onClick={onAddBudget}
            size="lg" 
            className="bg-white text-orange-700 hover:bg-orange-50 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            <Plus className="w-5 h-5 mr-2" />
            Novo Orçamento
          </Button>
        </div>

        {/* Totais do Período */}
        {summaryTotals && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 p-4 bg-white bg-opacity-10 rounded-lg">
            <div className="text-center">
              <p className="text-sm text-orange-200 flex items-center justify-center gap-1"><TrendingUp className="w-4 h-4"/> Orçado no Período</p>
              <p className="text-xl font-bold text-white">{formatCurrency(summaryTotals.orcado)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-orange-200 flex items-center justify-center gap-1"><TrendingDown className="w-4 h-4"/> Gasto no Período</p>
              <p className="text-xl font-bold text-white">
                {formatCurrency(summaryTotals.gasto)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-orange-200 flex items-center justify-center gap-1"><DollarSign className="w-4 h-4"/> Disponível no Período</p>
              <p className={`text-xl font-bold ${summaryTotals.disponivel < 0 ? 'text-red-300' : 'text-green-300'}`}>
                {formatCurrency(summaryTotals.disponivel)}
              </p>
            </div>
          </div>
        )}
        
        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
                value={filters.period}
                onValueChange={(value) => onFiltersChange(prev => ({...prev, period: value}))}
            >
                <SelectTrigger className="h-12 bg-white bg-opacity-20 text-white border-orange-400 data-[placeholder]:text-orange-100">
                    <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="current_month">Mês Atual</SelectItem>
                    <SelectItem value="last_month">Mês Anterior</SelectItem>
                    <SelectItem value="two_months_ago">Mês Retrasado</SelectItem>
                    <SelectItem value="current_quarter">Trimestre Atual</SelectItem>
                    <SelectItem value="this_year">Este Ano</SelectItem>
                    <SelectItem value="all">Todos os Períodos</SelectItem>
                </SelectContent>
            </Select>

            <Select
                value={filters.tagId}
                onValueChange={(value) => onFiltersChange(prev => ({...prev, tagId: value}))}
            >
                <SelectTrigger className="h-12 bg-white bg-opacity-20 text-white border-orange-400 data-[placeholder]:text-orange-100">
                    <SelectValue placeholder="Todas as Tags" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todas as Tags</SelectItem>
                    {tags.map(tag => (
                        <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select
                value={filters.status}
                onValueChange={(value) => onFiltersChange(prev => ({...prev, status: value}))}
            >
                <SelectTrigger className="h-12 bg-white bg-opacity-20 text-white border-orange-400 data-[placeholder]:text-orange-100">
                    <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="active">Ativos</SelectItem>
                    <SelectItem value="exceeded">Excedidos</SelectItem>
                    <SelectItem value="near_limit">Próx. do Limite</SelectItem>
                </SelectContent>
            </Select>
        </div>
      </CardContent>
    </Card>
  );
}
