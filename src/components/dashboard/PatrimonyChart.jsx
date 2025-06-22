import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"; // Removida a legenda daqui
import { TrendingUp, Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

const accountTypeConfig = {
  checking: {
    label: "Conta Corrente",
    color: "#3B82F6" // blue-500
  },
  savings: {
    label: "Poupança",
    color: "#10B981" // green-500
  },
  credit_card: {
    label: "Cartão de Crédito",
    color: "#8B5CF6" // purple-500
  },
  investment: {
    label: "Investimentos",
    color: "#F59E0B" // amber-500
  },
  cash: {
    label: "Dinheiro",
    color: "#6B7280" // gray-500
  }
};

export default function PatrimonyChart({ accounts, isLoading }) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  const getChartData = () => {
    const activeAccounts = accounts.filter(acc => acc.is_active !== false);
    const groupedByType = {};

    activeAccounts.forEach(account => {
      const balance = account.current_balance || account.initial_balance || 0;
      const type = account.account_type || 'cash';
      
      if (!groupedByType[type]) {
        groupedByType[type] = {
          type,
          total: 0,
          count: 0,
          label: accountTypeConfig[type]?.label || type,
          color: accountTypeConfig[type]?.color || '#6B7280'
        };
      }
      
      groupedByType[type].total += balance;
      groupedByType[type].count += 1;
    });

    return Object.values(groupedByType)
      .filter(item => item.total > 0) // Apenas tipos de conta com saldo positivo
      .map(item => ({
        name: item.label,
        value: item.total,
        count: item.count,
        fill: item.color
      }));
  };

  const chartData = getChartData();
  const totalPatrimony = chartData.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const percentage = totalPatrimony > 0 ? ((data.value / totalPatrimony) * 100).toFixed(1) : 0;
      
      return (
        <div className="bg-background/90 backdrop-blur-sm p-3 border border-border rounded-lg shadow-lg">
          <p className="font-medium text-foreground">{data.payload.name}</p>
          <p className="text-xs text-muted-foreground">
            {data.payload.count} conta{data.payload.count !== 1 ? 's' : ''}
          </p>
          <p className="font-bold text-primary">{formatCurrency(data.value)}</p>
          <p className="text-xs text-muted-foreground">{percentage}% do total</p>
        </div>
      );
    }
    return null;
  };

  const CustomLegend = ({ payload }) => {
    // Ordenar payload pela ordem definida em accountTypeConfig, se possível
    const orderedPayload = payload.sort((a, b) => {
        const orderA = Object.keys(accountTypeConfig).indexOf(Object.keys(accountTypeConfig).find(key => accountTypeConfig[key].label === a.value));
        const orderB = Object.keys(accountTypeConfig).indexOf(Object.keys(accountTypeConfig).find(key => accountTypeConfig[key].label === b.value));
        return orderA - orderB;
    });

    return (
      <div className="space-y-1.5">
        {orderedPayload.map((entry, index) => {
          const dataItem = chartData.find(item => item.name === entry.value);
          if (!dataItem) return null;

          const percentage = totalPatrimony > 0 ? ((dataItem.value / totalPatrimony) * 100).toFixed(1) : 0;

          return (
            <div key={index} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <div 
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: entry.color }}
                />
                <span className="font-medium text-muted-foreground truncate max-w-[100px]">{entry.value}</span>
                <span className="text-gray-400">({dataItem.count})</span>
              </div>
              <div className="flex items-center gap-2">
                 <span className="font-semibold text-foreground">{formatCurrency(dataItem.value)}</span>
                 <span className="text-gray-400 text-[10px]">({percentage}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };


  return (
    <Card className="bg-card text-card-foreground shadow-lg border-0 h-full flex flex-col">
      <CardHeader className="border-b bg-gray-50 py-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Wallet className="w-5 h-5 text-blue-600" />
          Distribuição do Patrimônio
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-4 flex-grow flex flex-col justify-center">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-1/2 mx-auto" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-32 w-32 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            </div>
          </div>
        ) : chartData.length > 0 ? (
          <div className="flex flex-col items-center h-full">
            <div className="text-center mb-3">
              <p className="text-xs text-muted-foreground">Patrimônio Total Distribuído</p>
              <h3 className="text-lg font-bold text-foreground">
                {formatCurrency(totalPatrimony)}
              </h3>
            </div>
            <div className="flex-grow w-full flex items-center gap-4">
              <div className="w-2/5 flex-shrink-0"> {/* Gráfico ocupa 40% */}
                <ResponsiveContainer width="100%" height={180}> {/* Altura reduzida */}
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45} // Ajustado
                      outerRadius={80} // Ajustado
                      paddingAngle={2}
                      dataKey="value"
                      labelLine={false}
                      // label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-3/5 flex-grow min-w-0"> {/* Legenda ocupa 60% */}
                <CustomLegend payload={chartData.map(item => ({ value: item.name, color: item.fill }))} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <TrendingUp className="w-10 h-10 text-gray-300 mb-3" />
            <h3 className="text-md font-medium text-gray-700">Nenhuma conta com saldo positivo</h3>
            <p className="text-xs text-gray-500">
              Adicione contas com saldo para ver a distribuição.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}