
import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  Wallet,
  PiggyBank,
  TrendingUp,
  Banknote,
  Edit,
  Trash2, // Added Trash2 icon for delete
  MoreVertical
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrencyWithSymbol } from "../utils/CurrencyConverter";

const accountTypeConfig = {
  checking: {
    label: "Conta Corrente",
    icon: Wallet,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200"
  },
  savings: {
    label: "Poupança",
    icon: PiggyBank,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200"
  },
  credit_card: {
    label: "Cartão de Crédito",
    icon: CreditCard,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200"
  },
  investment: {
    label: "Investimentos",
    icon: TrendingUp,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200"
  },
  cash: {
    label: "Dinheiro",
    icon: Banknote,
    color: "text-gray-600",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200"
  }
};

export default function AccountsGrid({ accounts, isLoading, onEditAccount, onDeleteAccount }) { // Added onDeleteAccount prop
  const formatCurrency = (amount, currency = 'BRL') => {
    return formatCurrencyWithSymbol(amount, currency);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <Card key={i} className="shadow-lg">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <div>
                    <Skeleton className="h-4 w-24 mb-1" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton className="w-8 h-8 rounded-lg" />
              </div>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-4 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-20"
      >
        <CreditCard className="w-16 h-16 text-gray-300 mx-auto mb-6" />
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          Nenhuma conta encontrada
        </h3>
        <p className="text-gray-600 text-lg">
          Comece adicionando suas contas financeiras
        </p>
      </motion.div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {accounts.map((account, index) => {
        const config = accountTypeConfig[account.account_type] || accountTypeConfig.checking;
        // Use current_balance instead of initial_balance
        const balance = account.current_balance || 0;
        const currency = account.currency || 'BRL';

        return (
          <motion.div
            key={account.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          >
            <Card className={`shadow-lg border-2 ${config.borderColor} hover:shadow-xl transition-all duration-300 hover:scale-[1.02] overflow-hidden`}>
              <div className={`h-1 ${config.bgColor.replace('bg-', 'bg-gradient-to-r from-').replace('-50', '-400 to-' + config.bgColor.split('-')[1] + '-600')}`} />

              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl ${config.bgColor}`}>
                      <config.icon className={`w-6 h-6 ${config.color}`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{account.name}</h3>
                      <div className="flex gap-2">
                        <Badge variant="outline" className={`${config.color} border-current`}>
                          {config.label}
                        </Badge>
                        {currency !== 'BRL' && (
                          <Badge variant="secondary" className="text-xs">
                            {currency}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEditAccount(account)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDeleteAccount(account.id)} className="text-red-600 hover:!text-red-600 hover:!bg-red-50">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="space-y-4">
                  <div>
                    <p className={`text-3xl font-bold ${balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                      {formatCurrency(balance, currency)}
                    </p>
                    {/* Changed "Saldo Inicial" to "Saldo Atual" */}
                    <p className="text-gray-600 text-sm">Saldo Atual</p>
                  </div>

                  {account.bank && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Banco:</span>
                      <span className="font-medium">{account.bank}</span>
                    </div>
                  )}

                  {account.account_number && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Número:</span>
                      <span className="font-mono">****{account.account_number.slice(-4)}</span>
                    </div>
                  )}

                  <div className={`p-3 rounded-lg ${config.bgColor} border ${config.borderColor}`}>
                    <div className="flex items-center justify-between text-sm">
                      <span className={`font-medium ${config.color}`}>
                        Status da conta
                      </span>
                      <Badge variant={account.is_active !== false ? "default" : "secondary"}>
                        {account.is_active !== false ? "Ativa" : "Inativa"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
