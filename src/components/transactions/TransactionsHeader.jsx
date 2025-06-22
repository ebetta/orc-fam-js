
import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, TrendingUp, Filter, CalendarIcon, Search, Check, ChevronsUpDown } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

export default function TransactionsHeader({
  onAddTransaction,
  accounts,
  tags,
  filters,
  onFiltersChange,
  transactionsCount
}) {
  const [dateRange, setDateRange] = useState({
    from: filters.period.from ? new Date(filters.period.from) : undefined,
    to: filters.period.to ? new Date(filters.period.to) : undefined,
  });
  const [tagSearchOpen, setTagSearchOpen] = useState(false);
  const [tagSearchValue, setTagSearchValue] = useState("");

  // Sincroniza o estado interno do seletor de data com os filtros do componente pai.
  // Isso é essencial para quando os filtros são definidos por parâmetros de URL.
  React.useEffect(() => {
    // A questão é que new Date('YYYY-MM-DD') interpreta a data como meia-noite UTC.
    // Quando exibida em um fuso horário local, ela pode mudar para o dia anterior.
    // Substituir hífens por barras faz o navegador tratar a data como local.
    setDateRange({
      from: filters.period.from ? new Date(filters.period.from.replace(/-/g, '/')) : undefined,
      to: filters.period.to ? new Date(filters.period.to.replace(/-/g, '/')) : undefined,
    });
  }, [filters.period.from, filters.period.to]);


  const handleDateRangeChange = (range) => {
    setDateRange(range);
    onFiltersChange(prev => ({ ...prev, period: { 
        from: range?.from ? format(range.from, "yyyy-MM-dd") : null,
        to: range?.to ? format(range.to, "yyyy-MM-dd") : null
    }}));
  };

  const setPresetPeriod = (period) => {
    let from, to;
    const today = new Date();
    switch (period) {
      case "this_month":
        from = startOfMonth(today);
        to = endOfMonth(today);
        break;
      case "last_month":
        const lastMonthStart = startOfMonth(subMonths(today, 1));
        from = lastMonthStart;
        to = endOfMonth(lastMonthStart);
        break;
      default:
        from = undefined;
        to = undefined;
    }
    handleDateRangeChange({ from, to });
  };

  // Filtrar tags baseado na busca
  const filteredTags = tags.filter(tag =>
    tag.name.toLowerCase().includes(tagSearchValue.toLowerCase())
  );

  // Encontrar a tag selecionada para exibição
  const selectedTag = tags.find(tag => tag.id === filters.tagId);

  // Resetar valor de busca quando uma tag for selecionada
  React.useEffect(() => {
    if (filters.tagId !== "all" && selectedTag) {
      setTagSearchValue(selectedTag.name);
    } else if (filters.tagId === "all") {
      setTagSearchValue("");
    }
  }, [filters.tagId, selectedTag]);

  return (
    <Card className="bg-gradient-to-r from-indigo-500 to-indigo-700 border-0 shadow-xl">
      <CardContent className="p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
          <div className="text-white">
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <TrendingUp className="w-8 h-8" />
              Minhas Transações
            </h1>
            <p className="text-indigo-100 text-lg">
              Acompanhe suas receitas, despesas e transferências
            </p>
             <p className="text-indigo-200 text-sm mt-1">
              {transactionsCount} transaç{transactionsCount !== 1 ? 'ões' : 'ão'} encontrada{transactionsCount !== 1 ? 's' : ''}
            </p>
          </div>
          
          <Button 
            onClick={onAddTransaction}
            size="lg" 
            className="bg-white text-indigo-700 hover:bg-indigo-50 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nova Transação
          </Button>
        </div>
        
        {/* Filtros */}
        <div className="space-y-4">
            <div className="relative">
                 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                 <Input 
                    placeholder="Buscar por descrição, conta, tag..."
                    value={filters.searchTerm}
                    onChange={(e) => onFiltersChange(prev => ({...prev, searchTerm: e.target.value}))}
                    className="pl-10 h-12 bg-white bg-opacity-20 text-white placeholder-indigo-100 border-indigo-400 focus:bg-opacity-30"
                />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Select
                    value={filters.type}
                    onValueChange={(value) => onFiltersChange(prev => ({...prev, type: value}))}
                >
                    <SelectTrigger className="h-12 bg-white bg-opacity-20 text-white border-indigo-400 data-[placeholder]:text-indigo-100">
                        <SelectValue placeholder="Tipo de Transação" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos os Tipos</SelectItem>
                        <SelectItem value="income">Receitas</SelectItem>
                        <SelectItem value="expense">Despesas</SelectItem>
                        <SelectItem value="transfer">Transferências</SelectItem>
                    </SelectContent>
                </Select>

                <Select
                    value={filters.accountId}
                    onValueChange={(value) => onFiltersChange(prev => ({...prev, accountId: value}))}
                >
                    <SelectTrigger className="h-12 bg-white bg-opacity-20 text-white border-indigo-400 data-[placeholder]:text-indigo-100">
                        <SelectValue placeholder="Todas as Contas" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas as Contas</SelectItem>
                        {accounts.map(acc => (
                            <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Popover open={tagSearchOpen} onOpenChange={setTagSearchOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={tagSearchOpen}
                            className="h-12 w-full justify-between bg-white bg-opacity-20 text-white border-indigo-400 hover:bg-opacity-30 hover:text-white font-normal data-[placeholder]:text-indigo-100"
                        >
                            {selectedTag ? selectedTag.name : "Todas as Tags"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                            <CommandInput
                                placeholder="Buscar tag..."
                                value={tagSearchValue}
                                onValueChange={setTagSearchValue}
                            />
                            <CommandList>
                                <CommandEmpty>Nenhuma tag encontrada.</CommandEmpty>
                                <CommandGroup>
                                    <CommandItem
                                        key="all-tags"
                                        value="todas as tags"
                                        onSelect={() => {
                                            onFiltersChange(prev => ({ ...prev, tagId: "all" }));
                                            setTagSearchValue("");
                                            setTagSearchOpen(false);
                                        }}
                                    >
                                        <Check
                                            className={`mr-2 h-4 w-4 ${filters.tagId === "all" ? "opacity-100" : "opacity-0"}`}
                                        />
                                        Todas as Tags
                                    </CommandItem>
                                    {filteredTags.map((tag) => (
                                        <CommandItem
                                            key={tag.id}
                                            value={tag.name}
                                            onSelect={(currentValue) => {
                                                const selectedTagObj = filteredTags.find(
                                                    t => t.name.toLowerCase() === currentValue.toLowerCase()
                                                );
                                                onFiltersChange(prev => ({ 
                                                    ...prev, 
                                                    tagId: selectedTagObj ? selectedTagObj.id : "all" 
                                                }));
                                                setTagSearchValue(selectedTagObj ? selectedTagObj.name : "");
                                                setTagSearchOpen(false);
                                            }}
                                        >
                                            <Check
                                                className={`mr-2 h-4 w-4 ${filters.tagId === tag.id ? "opacity-100" : "opacity-0"}`}
                                            />
                                            <div 
                                                className="w-3 h-3 rounded-sm mr-2" 
                                                style={{ backgroundColor: tag.color || '#6B7280' }}
                                            />
                                            {tag.name}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>

                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            className="h-12 w-full justify-start text-left font-normal bg-white bg-opacity-20 text-white border-indigo-400 hover:bg-opacity-30 hover:text-white"
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateRange?.from ? (
                                dateRange.to ? (
                                    <>
                                        {format(dateRange.from, "dd/MM/yy")} - {format(dateRange.to, "dd/MM/yy")}
                                    </>
                                ) : (
                                    format(dateRange.from, "dd/MM/yy")
                                )
                            ) : (
                                <span className="text-indigo-100">Período</span>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                         <div className="p-2 space-x-1">
                            <Button variant="ghost" size="sm" onClick={() => setPresetPeriod("this_month")}>Este Mês</Button>
                            <Button variant="ghost" size="sm" onClick={() => setPresetPeriod("last_month")}>Mês Passado</Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDateRangeChange({})}>Limpar</Button>
                        </div>
                        <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={dateRange?.from}
                            selected={dateRange}
                            onSelect={handleDateRangeChange}
                            numberOfMonths={2}
                        />
                    </PopoverContent>
                </Popover>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
