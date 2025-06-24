
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { TrendingDown, ShoppingCart, Filter, Check, ChevronsUpDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { startOfMonth, endOfMonth, subMonths, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const LOCAL_STORAGE_KEY = 'financeApp_selectedParentTags';

export default function ExpensesChart({ transactions, tags, isLoading }) {
  const [selectedPeriod, setSelectedPeriod] = useState("current_month");
  const [selectedParentTags, setSelectedParentTags] = useState({});
  const [parentTagsFilterOpen, setParentTagsFilterOpen] = useState(false);
  
  const periodOptions = [
    { value: "current_month", label: "Mês Atual" },
    { value: "last_month", label: "Mês Anterior" },
    { value: "two_months_ago", label: "Mês Retrasado" }
  ];

  // Identificar e inicializar tags pai quando as tags carregarem
  useEffect(() => {
    if (tags && tags.length > 0) {
      const savedSelectionJSON = localStorage.getItem(LOCAL_STORAGE_KEY);
      let initialSelection;
      
      if (savedSelectionJSON) {
        try {
          initialSelection = JSON.parse(savedSelectionJSON);
        } catch (e) {
            console.error("Erro ao ler seleção de tags do localStorage, redefinindo para o padrão.", e);
            // Se houver erro na leitura, o `initialSelection` continuará nulo
            // e a lógica abaixo criará o padrão.
        }
      }

      // Se não houver seleção salva ou se a leitura falhar, criar a seleção padrão (todas marcadas)
      if (!initialSelection) {
        const parentTags = tags.filter(tag => !tag.parent_tag_id_base44);
        initialSelection = {};
        parentTags.forEach(tag => {
          initialSelection[tag.id] = true; // Todas selecionadas por padrão
        });
      }
      
      setSelectedParentTags(initialSelection);
    }
  }, [tags]);

  // Salvar a seleção no localStorage sempre que ela for alterada
  useEffect(() => {
    // Evita salvar o estado inicial vazio antes das tags carregarem
    if (Object.keys(selectedParentTags).length > 0) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(selectedParentTags));
    }
  }, [selectedParentTags]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  const getPeriodDates = (period) => {
    const today = new Date();
    let targetDate;
    
    switch (period) {
      case "last_month":
        targetDate = subMonths(today, 1);
        break;
      case "two_months_ago":
        targetDate = subMonths(today, 2);
        break;
      default: // current_month
        targetDate = today;
    }
    
    return {
      start: startOfMonth(targetDate),
      end: endOfMonth(targetDate),
      monthName: format(targetDate, "MMMM 'de' yyyy", { locale: ptBR })
    };
  };

  const getChartData = () => {
    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      console.log("ExpensesChart: Nenhuma transação disponível");
      return [];
    }

    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      console.log("ExpensesChart: Nenhuma tag disponível");
      return [];
    }

    const { start, end } = getPeriodDates(selectedPeriod);
    
    console.log(`ExpensesChart: Período selecionado: ${selectedPeriod}`);
    console.log(`ExpensesChart: Filtrando transações entre ${start.toISOString()} e ${end.toISOString()}`);

    // Filtrar transações de despesa do período selecionado
    const expenseTransactions = transactions.filter(t => {
      // Usar .replace para tratar a data como local e evitar problemas de fuso horário
      const transactionDate = new Date(t.transaction_date.replace(/-/g, '/'));

      const isExpense = t.transaction_type === 'expense';
      const isInPeriod = transactionDate >= start && transactionDate <= end;
      
      return isExpense && isInPeriod;
    });

    console.log(`ExpensesChart: ${expenseTransactions.length} transações de despesa encontradas no período.`);

    // Criar mapa de tags para fácil acesso
    const tagMap = Object.fromEntries(tags.map(tag => [tag.id, tag]));
    
    // Criar mapa de tags pai
    const parentTagMap = {};
    const parentTags = tags.filter(tag => !tag.parent_tag_id_base44);
    
    parentTags.forEach(parentTag => {
      parentTagMap[parentTag.id] = {
        id: parentTag.id,
        name: parentTag.name,
        color: parentTag.color || '#6B7280',
        total: 0,
        count: 0
      };
    });

    // Adicionar categoria para tags sem pai ou tags pai não encontradas
    parentTagMap['others'] = {
      id: 'others',
      name: 'Outras',
      color: '#9CA3AF',
      total: 0,
      count: 0
    };

    // Agrupar transações por tag pai
    expenseTransactions.forEach(transaction => {
      const tagId = transaction.tag_id_base44;
      const amount = parseFloat(transaction.amount || 0);
      
      if (tagId && tagMap[tagId]) {
        const tag = tagMap[tagId];
        let parentTagId;
        
        if (tag.parent_tag_id_base44) {
          // É uma tag filha, encontrar o pai
          parentTagId = tag.parent_tag_id_base44;
        } else {
          // É uma tag pai
          parentTagId = tag.id;
        }
        
        if (parentTagMap[parentTagId]) {
          parentTagMap[parentTagId].total += amount;
          parentTagMap[parentTagId].count += 1;
          console.log(`ExpensesChart: ✅ Adicionado à tag pai "${parentTagMap[parentTagId].name}": ${amount}`);
        } else {
          // Tag pai não encontrada, adicionar a "Outras"
          parentTagMap['others'].total += amount;
          parentTagMap['others'].count += 1;
          console.log(`ExpensesChart: ⚠️ Tag pai não encontrada, adicionado a 'Outras': ${amount}`);
        }
      } else {
        // Transação sem tag ou tag não encontrada
        parentTagMap['others'].total += amount;
        parentTagMap['others'].count += 1;
        console.log(`ExpensesChart: ⚠️ Transação sem tag, adicionado a 'Outras': ${amount}`);
      }
    });

    console.log("ExpensesChart: Resumo por tag pai:", parentTagMap);

    // Filtrar apenas tags pai selecionadas e converter para array
    const result = Object.values(parentTagMap)
      .filter(item => {
        if (item.id === 'others') {
          return item.total > 0; // Mostrar "Outras" apenas se houver valores
        }
        return item.total > 0 && selectedParentTags[item.id]; // Mostrar apenas selecionadas
      })
      .sort((a, b) => b.total - a.total)
      .map(item => ({
        name: item.name,
        value: item.total,
        count: item.count,
        fill: item.color
      }));

    console.log("ExpensesChart: Dados finais do gráfico (tags pai selecionadas):", result);
    return result;
  };

  const chartData = getChartData();
  const totalExpenses = chartData.reduce((sum, item) => sum + item.value, 0);
  const { monthName } = getPeriodDates(selectedPeriod);

  // Obter lista de tags pai para o filtro
  const parentTags = tags ? tags.filter(tag => !tag.parent_tag_id_base44).sort((a, b) => a.name.localeCompare(b.name)) : [];
  const selectedCount = Object.values(selectedParentTags).filter(Boolean).length;

  const handleParentTagToggle = (tagId, checked) => {
    setSelectedParentTags(prev => ({
      ...prev,
      [tagId]: checked
    }));
  };

  const handleSelectAllParentTags = (selectAll) => {
    const newSelection = {};
    parentTags.forEach(tag => {
      newSelection[tag.id] = selectAll;
    });
    setSelectedParentTags(newSelection);
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const percentage = totalExpenses > 0 ? ((data.value / totalExpenses) * 100).toFixed(1) : 0;
      
      return (
        <div className="bg-background/90 backdrop-blur-sm p-3 border border-border rounded-lg shadow-lg">
          <p className="font-medium text-foreground">{data.payload.name}</p>
          <p className="text-xs text-muted-foreground">
            {data.payload.count} transaç{data.payload.count !== 1 ? 'ões' : 'ão'}
          </p>
          <p className="font-bold text-primary">{formatCurrency(data.value)}</p>
          <p className="text-xs text-muted-foreground">{percentage}% do total</p>
        </div>
      );
    }
    return null;
  };

  const CustomLegend = ({ payload }) => {
    return (
      <div className="max-h-48 overflow-y-auto pr-2 space-y-1.5 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        {payload.map((entry, index) => {
          const dataItem = chartData.find(item => item.name === entry.value);
          if (!dataItem) return null;

          const percentage = totalExpenses > 0 ? ((dataItem.value / totalExpenses) * 100).toFixed(1) : 0;

          return (
            <div key={index} className="flex items-center justify-between gap-2 text-xs bg-gray-50 p-2 rounded">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div 
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: entry.color }}
                />
                <span className="font-medium text-muted-foreground truncate">{entry.value}</span>
                <span className="text-gray-400 text-[10px]">({dataItem.count})</span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
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
      <CardHeader className="border-b bg-gray-50 py-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-red-600" />
          Despesas por Tags Pai
        </CardTitle>
        <div className="flex gap-2">
          <Popover open={parentTagsFilterOpen} onOpenChange={setParentTagsFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs gap-2"
              >
                <Filter className="w-4 h-4" />
                Tags ({selectedCount})
                <ChevronsUpDown className="w-3 h-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0">
              <div className="p-3 border-b">
                <div className="flex justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSelectAllParentTags(true)}
                    className="h-8 px-2 text-xs"
                  >
                    Todas
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSelectAllParentTags(false)}
                    className="h-8 px-2 text-xs"
                  >
                    Nenhuma
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-48">
                <div className="p-3 space-y-2">
                  {parentTags.map(tag => (
                    <div key={tag.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`parent-tag-${tag.id}`}
                        checked={!!selectedParentTags[tag.id]}
                        onCheckedChange={(checked) => handleParentTagToggle(tag.id, checked)}
                      />
                      <label
                        htmlFor={`parent-tag-${tag.id}`}
                        className="flex items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                      >
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: tag.color || '#ccc' }}
                        />
                        {tag.name}
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[160px] h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map(option => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
              <p className="text-xs text-muted-foreground">Total de Despesas</p>
              <h3 className="text-lg font-bold text-foreground">
                {formatCurrency(totalExpenses)}
              </h3>
              <p className="text-xs text-muted-foreground">{monthName}</p>
            </div>
            <div className="flex-grow w-full flex items-center gap-4">
              <div className="w-2/5 flex-shrink-0">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      labelLine={false}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-3/5 flex-grow min-w-0">
                <CustomLegend payload={chartData.map(item => ({ value: item.name, color: item.fill }))} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <TrendingDown className="w-10 h-10 text-gray-300 mb-3" />
            <h3 className="text-md font-medium text-gray-700">Nenhuma despesa encontrada</h3>
            <p className="text-xs text-gray-500">
              Não há despesas registradas para {monthName.toLowerCase()} ou nenhuma tag pai foi selecionada.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
