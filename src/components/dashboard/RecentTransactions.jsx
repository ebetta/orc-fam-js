import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  ArrowLeftRight,
  TrendingUp,
  Plus,
  ArrowRight
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";

export default function RecentTransactions({ transactions, isLoading }) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'income':
        return { icon: ArrowUpRight, color: 'text-green-600', bgColor: 'bg-green-50' };
      case 'expense':
        return { icon: ArrowDownRight, color: 'text-red-600', bgColor: 'bg-red-50' };
      case 'transfer':
        return { icon: ArrowLeftRight, color: 'text-blue-600', bgColor: 'bg-blue-50' };
      default:
        return { icon: ArrowUpRight, color: 'text-gray-600', bgColor: 'bg-gray-50' };
    }
  };

  const getTransactionTypeLabel = (type) => {
    switch (type) {
      case 'income': return 'Receita';
      case 'expense': return 'Despesa';
      case 'transfer': return 'Transferência';
      default: return type;
    }
  };

  return (
    <Card className="shadow-lg border-0">
      <CardHeader className="border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            Transações Recentes
          </CardTitle>
          <Link to={createPageUrl("Transactions")}>
            <Button variant="outline" size="sm" className="gap-2">
              Ver todas
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32 mb-1" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : transactions.length > 0 ? (
          <div className="space-y-4">
            {transactions.map((transaction, index) => {
              const { icon: Icon, color, bgColor } = getTransactionIcon(transaction.transaction_type);
              
              return (
                <motion.div
                  key={transaction.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  <div className={`p-2 rounded-lg ${bgColor}`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {transaction.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {getTransactionTypeLabel(transaction.transaction_type)}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {format(new Date(transaction.transaction_date), "dd 'de' MMM", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className={`font-semibold ${
                      transaction.transaction_type === 'income' 
                        ? 'text-green-600' 
                        : transaction.transaction_type === 'expense'
                        ? 'text-red-600'
                        : 'text-blue-600'
                    }`}>
                      {transaction.transaction_type === 'expense' ? '-' : '+'}
                      {formatCurrency(Math.abs(transaction.amount))}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhuma transação encontrada
            </h3>
            <p className="text-gray-600 mb-6">
              Comece registrando suas receitas e despesas
            </p>
            <Link to={createPageUrl("Transactions")}>
              <Button className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar transação
              </Button>
            </Link>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}