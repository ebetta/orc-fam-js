
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, CalendarDays } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatCurrencyForAxis = (value) => {
  if (value === 0) return 'R$0';
  if (Math.abs(value) >= 1000000) {
    return `R$${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `R$${(value / 1000).toFixed(0)}K`;
  }
  return `R$${value.toFixed(0)}`;
};

const CustomTooltipContent = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const value = payload[0].value;
    return (
      <div className="bg-background/90 backdrop-blur-sm p-3 border border-border rounded-lg shadow-lg">
        <p className="text-sm font-medium text-foreground mb-1">{label}</p>
        <p className="text-lg font-bold text-red-600">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
        </p>
        <p className="text-xs text-muted-foreground">Total de despesas</p>
      </div>
    );
  }
  return null;
};

export default function MonthlyExpensesChart({ transactions, isLoading }) {
  const [period, setPeriod] = useState('6');

  const timePeriods = [
    { value: '6', label: 'Últimos 6 Meses' },
    { value: '12', label: 'Últimos 12 Meses' },
  ];

  const chartData = useMemo(() => {
    if (isLoading || !transactions?.length) return [];

    const numberOfMonths = parseInt(period);
    const today = new Date();
    const data = [];

    for (let i = numberOfMonths - 1; i >= 0; i--) {
      const targetDate = subMonths(today, i);
      const monthStart = startOfMonth(targetDate);
      const monthEnd = endOfMonth(targetDate);

      const monthlyExpenses = transactions
        .filter((t) => {
          if (t.transaction_type !== 'expense') return false;
          try {
            const txDate = new Date(t.transaction_date.replace(/-/g, '/'));
            return isWithinInterval(txDate, { start: monthStart, end: monthEnd });
          } catch {
            return false;
          }
        })
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

      data.push({
        month: format(targetDate, 'MMM/yy', { locale: ptBR }),
        despesas: monthlyExpenses,
      });
    }

    return data;
  }, [transactions, period, isLoading]);

  // Highlight the current (last) month bar
  const maxValue = Math.max(...chartData.map((d) => d.despesas), 0);

  return (
    <Card className="shadow-lg border-0 h-full flex flex-col">
      <CardHeader className="border-b bg-gray-50 flex flex-row items-center justify-between py-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-red-500" />
          Despesas Mensais
        </CardTitle>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px] h-9 text-xs">
            <SelectValue placeholder="Selecione o período" />
          </SelectTrigger>
          <SelectContent>
            {timePeriods.map((tp) => (
              <SelectItem key={tp.value} value={tp.value} className="text-xs">
                {tp.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>

      <CardContent className="p-4 flex-grow">
        {isLoading ? (
          <div className="space-y-3 h-full flex flex-col justify-center">
            <Skeleton className="h-6 w-1/2 mx-auto" />
            <Skeleton className="h-[200px] w-full" />
            <div className="flex justify-around">
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 w-10" />
            </div>
          </div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatCurrencyForAxis}
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={70}
              />
              <Tooltip content={<CustomTooltipContent />} cursor={{ fill: 'rgba(239,68,68,0.08)' }} />
              <Bar dataKey="despesas" name="Despesas" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {chartData.map((entry, index) => {
                  const isLastMonth = index === chartData.length - 1;
                  const isHighest = entry.despesas === maxValue && maxValue > 0;
                  let color = '#fca5a5'; // light red default
                  if (isLastMonth) color = '#ef4444'; // current month
                  else if (isHighest) color = '#dc2626'; // highest month
                  return <Cell key={`cell-${index}`} fill={color} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <CalendarDays className="w-12 h-12 text-gray-300 mb-3" />
            <h3 className="text-md font-medium text-gray-700">Sem despesas no período</h3>
            <p className="text-xs text-gray-500">
              Adicione transações de despesa para visualizar o gráfico.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
