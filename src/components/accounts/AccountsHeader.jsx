import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, CreditCard } from "lucide-react";

export default function AccountsHeader({ 
  onAddAccount, 
  filterType, 
  onFilterChange, 
  accountsCount 
}) {
  return (
    <Card className="bg-gradient-to-r from-blue-500 to-blue-700 border-0 shadow-xl">
      <CardContent className="p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="text-white">
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <CreditCard className="w-8 h-8" />
              Minhas Contas
            </h1>
            <p className="text-blue-100 text-lg">
              Gerencie todas as suas contas financeiras em um só lugar
            </p>
            <p className="text-blue-200 text-sm mt-1">
              {accountsCount} conta{accountsCount !== 1 ? 's' : ''} cadastrada{accountsCount !== 1 ? 's' : ''}
            </p>
          </div>
          
          <Button 
            onClick={onAddAccount}
            size="lg" 
            className="bg-white text-blue-700 hover:bg-blue-50 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nova Conta
          </Button>
        </div>
        
        <div className="mt-6">
          <Tabs value={filterType} onValueChange={onFilterChange}>
            <TabsList className="bg-white bg-opacity-20 border-0">
              <TabsTrigger 
                value="all" 
                className="text-white data-[state=active]:bg-white data-[state=active]:text-blue-700"
              >
                Todas
              </TabsTrigger>
              <TabsTrigger 
                value="checking"
                className="text-white data-[state=active]:bg-white data-[state=active]:text-blue-700"
              >
                Corrente
              </TabsTrigger>
              <TabsTrigger 
                value="savings"
                className="text-white data-[state=active]:bg-white data-[state=active]:text-blue-700"
              >
                Poupança
              </TabsTrigger>
              <TabsTrigger 
                value="credit_card"
                className="text-white data-[state=active]:bg-white data-[state=active]:text-blue-700"
              >
                Cartão
              </TabsTrigger>
              <TabsTrigger 
                value="investment"
                className="text-white data-[state=active]:bg-white data-[state=active]:text-blue-700"
              >
                Investimentos
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  );
}