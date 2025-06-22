
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { X, Save, TrendingUp, CalendarIcon as CalendarIconLucide, Check, ChevronsUpDown } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { formatCurrencyWithSymbol } from "../utils/CurrencyConverter"; // Added import
import { format, parseISO } from "date-fns";

const transactionTypes = [
  { value: "income", label: "Receita" },
  { value: "expense", label: "Despesa" },
  { value: "transfer", label: "Transferência" }
];

export default function TransactionForm({ transaction, accounts, tags, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    description: transaction?.description || "",
    amount: transaction?.amount || 0,
    transaction_type: transaction?.transaction_type || "expense",
    account_id: transaction?.account_id || "",
    destination_account_id: transaction?.destination_account_id || null,
    tag_id: transaction?.tag_id || null,
    transaction_date: transaction?.transaction_date ? format(parseISO(transaction.transaction_date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
    notes: transaction?.notes || ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [tagSearchValue, setTagSearchValue] = useState("");

  useEffect(() => {
    // Reset form if transaction prop changes or for new transaction
    setFormData({
      description: transaction?.description || "",
      amount: transaction?.amount || 0,
      transaction_type: transaction?.transaction_type || "expense",
      account_id: transaction?.account_id || (accounts.length > 0 ? accounts[0].id : ""),
      destination_account_id: transaction?.destination_account_id || null,
      tag_id: transaction?.tag_id || null,
      transaction_date: transaction?.transaction_date ? format(parseISO(transaction.transaction_date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      notes: transaction?.notes || ""
    });
    // Se estiver editando uma transação com tag, e a tag existir na lista `tags`,
    // definir o `tagSearchValue` para o nome da tag para exibição correta no combobox.
    if (transaction?.tag_id) {
        const currentTag = tags.find(t => t.id === transaction.tag_id);
        if (currentTag) {
            setTagSearchValue(currentTag.name);
        } else {
             setTagSearchValue(""); // Tag não encontrada ou nula
        }
    } else {
        setTagSearchValue("");
    }
  }, [transaction, accounts, tags]);


  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const dataToSave = {
      ...formData,
      amount: parseFloat(formData.amount),
      // Se for transferencia e nao tiver destination_account_id, ou se nao for transferencia, seta null
      destination_account_id: formData.transaction_type === 'transfer' && formData.destination_account_id ? formData.destination_account_id : null,
      tag_id: formData.tag_id || null
    };
    try {
      await onSave(dataToSave);
    } catch (error) {
      console.error("Erro ao salvar transação:", error);
    }
    setIsLoading(false);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const handleDateChange = (date) => {
    handleInputChange("transaction_date", format(date, "yyyy-MM-dd"));
  };

  const availableDestinationAccounts = accounts.filter(acc => acc.id !== formData.account_id);
  const selectedAccount = accounts.find(acc => acc.id === formData.account_id);
  const selectedAccountCurrency = selectedAccount?.currency || 'BRL';

  const filteredTags = tags.filter(tag => 
    tag.name.toLowerCase().includes(tagSearchValue.toLowerCase())
  );
  
  const selectedTag = tags.find(t => t.id === formData.tag_id);

  return (
    <Card className="shadow-xl border-0 max-h-[90vh] flex flex-col">
      <CardHeader className="bg-gradient-to-r from-indigo-50 to-indigo-100 border-b sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-indigo-600" />
            </div>
            {transaction ? "Editar Transação" : "Nova Transação"}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-8 overflow-y-auto flex-grow">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Descrição *
            </Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Ex: Supermercado, Salário"
              required
              className="h-12"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-sm font-medium">
                Valor * {selectedAccountCurrency !== 'BRL' && (
                  <span className="text-sm text-gray-500">({selectedAccountCurrency})</span>
                )}
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => handleInputChange("amount", e.target.value)}
                placeholder={selectedAccountCurrency === 'USD' ? '0.00' : selectedAccountCurrency === 'EUR' ? '0,00' : '0,00'}
                required
                className="h-12"
              />
              {selectedAccountCurrency !== 'BRL' && (
                <p className="text-xs text-gray-500">
                  Valor será convertido para BRL nos cálculos gerais usando a cotação atual
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="transaction_date" className="text-sm font-medium">
                Data *
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-12 w-full justify-start text-left font-normal"
                  >
                    <CalendarIconLucide className="mr-2 h-4 w-4" />
                    {formData.transaction_date ? format(parseISO(formData.transaction_date), "dd/MM/yyyy") : <span>Escolha uma data</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.transaction_date ? parseISO(formData.transaction_date) : undefined}
                    onSelect={handleDateChange}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="transaction_type" className="text-sm font-medium">
                Tipo *
              </Label>
              <Select
                value={formData.transaction_type}
                onValueChange={(value) => handleInputChange("transaction_type", value)}
              >
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {transactionTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="account_id" className="text-sm font-medium">
                Conta {formData.transaction_type === 'transfer' ? 'de Origem' : ''} *
              </Label>
              <Select
                value={formData.account_id}
                onValueChange={(value) => handleInputChange("account_id", value)}
                required
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name} ({acc.bank}) {acc.currency !== 'BRL' && `- ${acc.currency}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {formData.transaction_type === "transfer" && (
            <div className="space-y-2">
              <Label htmlFor="destination_account_id" className="text-sm font-medium">
                Conta de Destino *
              </Label>
              <Select
                value={formData.destination_account_id || ""}
                onValueChange={(value) => handleInputChange("destination_account_id", value)}
                required={formData.transaction_type === "transfer"}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Selecione a conta de destino" />
                </SelectTrigger>
                <SelectContent>
                  {availableDestinationAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name} ({acc.bank}) {acc.currency !== 'BRL' && `- ${acc.currency}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.destination_account_id && (
                <p className="text-xs text-gray-500">
                  Nota: Se as contas têm moedas diferentes, a conversão será aplicada automaticamente
                </p>
              )}
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="tag_id" className="text-sm font-medium">
              Tag (Opcional)
            </Label>
            <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={tagPopoverOpen}
                  className="w-full justify-between h-12 font-normal"
                >
                  {selectedTag ? selectedTag.name : "Selecione uma tag..."}
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
                        key="no-tag"
                        value=""
                        onSelect={() => {
                          handleInputChange("tag_id", null);
                          setTagSearchValue(""); // Limpa busca para exibir o placeholder
                          setTagPopoverOpen(false);
                        }}
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${!formData.tag_id ? "opacity-100" : "opacity-0"}`}
                        />
                        Nenhuma tag
                      </CommandItem>
                      {filteredTags.map((tag) => (
                        <CommandItem
                          key={tag.id}
                          value={tag.name} // O valor do CommandItem é usado para a busca interna do Command
                          onSelect={(currentValue) => { // currentValue é o tag.name
                            const selected = tags.find(t => t.name.toLowerCase() === currentValue.toLowerCase());
                            handleInputChange("tag_id", selected ? selected.id : null);
                            setTagSearchValue(selected ? selected.name : ""); // Atualiza texto de busca para o nome completo
                            setTagPopoverOpen(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${formData.tag_id === tag.id ? "opacity-100" : "opacity-0"}`}
                          />
                          {tag.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium">
              Notas (Opcional)
            </Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              placeholder="Detalhes adicionais sobre a transação..."
              className="min-h-[80px]"
            />
          </div>

          <div className="flex justify-end gap-4 pt-6 border-t sticky bottom-0 bg-white py-6 z-10">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
              className="h-12 px-8"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="h-12 px-8 bg-indigo-600 hover:bg-indigo-700"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {transaction ? "Atualizar" : "Criar"} Transação
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
