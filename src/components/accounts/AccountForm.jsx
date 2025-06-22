import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { X, Save, CreditCard } from "lucide-react";

const accountTypes = [
  { value: "checking", label: "Conta Corrente" },
  { value: "savings", label: "Poupança" },
  { value: "credit_card", label: "Cartão de Crédito" },
  { value: "investment", label: "Investimentos" },
  { value: "cash", label: "Dinheiro" }
];

export default function AccountForm({ account, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: account?.name || "",
    bank: account?.bank || "",
    account_number: account?.account_number || "",
    account_type: account?.account_type || "checking",
    initial_balance: account?.initial_balance || 0,
    currency: account?.currency || "BRL",
    is_active: account?.is_active !== false
  });
  
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await onSave(formData);
    } catch (error) {
      console.error("Erro ao salvar conta:", error);
    }
    
    setIsLoading(false);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Card className="shadow-xl border-0">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CreditCard className="w-6 h-6 text-blue-600" />
            </div>
            {account ? "Editar Conta" : "Nova Conta"}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Nome da Conta *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Ex: Conta Corrente Banco do Brasil"
                required
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account_type" className="text-sm font-medium">
                Tipo de Conta *
              </Label>
              <Select
                value={formData.account_type}
                onValueChange={(value) => handleInputChange("account_type", value)}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {accountTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bank" className="text-sm font-medium">
                Banco / Instituição
              </Label>
              <Input
                id="bank"
                value={formData.bank}
                onChange={(e) => handleInputChange("bank", e.target.value)}
                placeholder="Ex: Banco do Brasil, Nubank"
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account_number" className="text-sm font-medium">
                Número da Conta
              </Label>
              <Input
                id="account_number"
                value={formData.account_number}
                onChange={(e) => handleInputChange("account_number", e.target.value)}
                placeholder="Ex: 12345-6"
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="initial_balance" className="text-sm font-medium">
                Saldo Inicial *
              </Label>
              <Input
                id="initial_balance"
                type="number"
                step="0.01"
                value={formData.initial_balance}
                onChange={(e) => handleInputChange("initial_balance", parseFloat(e.target.value) || 0)}
                placeholder="0,00"
                required
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency" className="text-sm font-medium">
                Moeda
              </Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => handleInputChange("currency", value)}
              >
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">Real (BRL)</SelectItem>
                  <SelectItem value="USD">Dólar (USD)</SelectItem>
                  <SelectItem value="EUR">Euro (EUR)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <Label htmlFor="is_active" className="text-sm font-medium">
                Conta Ativa
              </Label>
              <p className="text-xs text-gray-600 mt-1">
                Contas inativas não aparecem nos cálculos principais
              </p>
            </div>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => handleInputChange("is_active", checked)}
            />
          </div>

          <div className="flex justify-end gap-4 pt-6 border-t">
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
              className="h-12 px-8 bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {account ? "Atualizar" : "Criar"} Conta
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}