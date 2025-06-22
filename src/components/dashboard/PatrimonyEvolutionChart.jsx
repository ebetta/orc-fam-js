
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, CalendarDays } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { convertCurrency } from '../utils/CurrencyConverter';

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
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-lg font-bold" style={{ color: value < 0 ? '#dc2626' : payload[0].color }}>
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
        </p>
      </div>
    );
  }
  return null;
};

export default function PatrimonyEvolutionChart({ accounts, transactions, isLoading }) {
  const [period, setPeriod] = useState("6m");
  const [chartData, setChartData] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const timePeriods = [
    { value: "3m", label: "Últimos 3 Meses" },
    { value: "6m", label: "Últimos 6 Meses" },
    { value: "12m", label: "Último Ano" },
  ];

  useEffect(() => {
    const calculatePatrimonyEvolution = async () => {
      if (isLoading || !accounts.length) {
        setChartData([]);
        return;
      }

      setIsProcessing(true);
      const numberOfMonths = parseInt(period);
      const data = [];
      const today = new Date();

      try {
        // Processar mês por mês
        for (let i = numberOfMonths - 1; i >= 0; i--) {
          const targetMonthDate = subMonths(today, i);
          const monthStart = startOfMonth(targetMonthDate);
          const monthEnd = endOfMonth(targetMonthDate);
          
          let monthNetWorthInBRL = 0;

          // Processar cada conta individualmente para conversão adequada
          for (const account of accounts) {
            if (account.is_active === false) continue;

            const accountCurrency = account.currency || 'BRL';
            let accountBalanceAtMonthEnd = parseFloat(account.initial_balance || 0);
            
            // Aplicar todas as transações até o final do mês
            const accountTransactions = transactions.filter(t => {
              // Usar .replace para tratar a data como local e evitar problemas de fuso horário
              const transactionDate = new Date(t.transaction_date.replace(/-/g, '/'));
              return transactionDate <= monthEnd && 
                     (t.account_id === account.id || t.destination_account_id === account.id);
            });

            accountTransactions.forEach(t => {
              const amount = parseFloat(t.amount || 0);
              if (t.account_id === account.id) {
                if (t.transaction_type === 'income') accountBalanceAtMonthEnd += amount;
                else if (t.transaction_type === 'expense') accountBalanceAtMonthEnd -= amount;
                else if (t.transaction_type === 'transfer') accountBalanceAtMonthEnd -= amount;
              }
              if (t.destination_account_id === account.id) {
                if (t.transaction_type === 'transfer') accountBalanceAtMonthEnd += amount;
              }
            });

            // Converter o saldo da conta para BRL
            const accountBalanceInBRL = await convertCurrency(
              accountBalanceAtMonthEnd, 
              accountCurrency, 
              'BRL'
            );
            
            monthNetWorthInBRL += accountBalanceInBRL;

            // Pequena pausa para não sobrecarregar as conversões
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          
          data.push({
            month: format(monthStart, "MMM/yy", { locale: ptBR }),
            patrimonio: monthNetWorthInBRL,
          });

          // Pausa entre meses para distribuir o processamento
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        setChartData(data);
      } catch (error) {
        console.error('Erro ao calcular evolução do patrimônio:', error);
        setChartData([]);
      }
      
      setIsProcessing(false);
    };

    calculatePatrimonyEvolution();
  }, [accounts, transactions, period, isLoading]);

  const isChartLoading = isLoading || isProcessing;

  return (
    <Card className="shadow-lg border-0 h-full flex flex-col">
      <CardHeader className="border-b bg-gray-50 flex flex-row items-center justify-between py-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-600" />
          Evolução do Patrimônio
          {isProcessing && (
            <div className="text-xs text-blue-600 flex items-center gap-1 ml-2">
              <div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin" />
              Convertendo...
            </div>
          )}
        </CardTitle>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px] h-9 text-xs">
            <SelectValue placeholder="Selecione o período" />
          </SelectTrigger>
          <SelectContent>
            {timePeriods.map(tp => (
              <SelectItem key={tp.value} value={tp.value} className="text-xs">
                {tp.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="p-4 flex-grow">
        {isChartLoading ? (
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
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
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
                domain={['auto', 'auto']}
              />
              <Tooltip content={<CustomTooltipContent />} cursor={{ stroke: '#4ade80', strokeWidth: 1, strokeDasharray: '3 3' }} />
              <Legend wrapperStyle={{fontSize: "12px"}} />
              <Line 
                type="monotone" 
                dataKey="patrimonio" 
                stroke="#16a34a"
                strokeWidth={2} 
                dot={{ r: 4, fill: "#16a34a", strokeWidth: 0 }}
                activeDot={{ r: 6, fill: "#16a34a", stroke: '#dcfce7', strokeWidth: 2 }}
                name="Patrimônio (BRL)"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <CalendarDays className="w-12 h-12 text-gray-300 mb-3" />
            <h3 className="text-md font-medium text-gray-700">Dados insuficientes</h3>
            <p className="text-xs text-gray-500">
              Adicione transações para ver a evolução do patrimônio.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
