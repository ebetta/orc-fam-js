import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart } from "lucide-react";

export default function ReportsHeader() {
  return (
    <Card className="bg-gradient-to-r from-teal-500 to-teal-700 border-0 shadow-xl">
      <CardContent className="p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="text-white">
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <BarChart className="w-8 h-8" />
              Relatórios
            </h1>
            <p className="text-teal-100 text-lg">
              Analise suas finanças com relatórios detalhados e personalizados
            </p>
            <p className="text-teal-200 text-sm mt-1">
              Configure os filtros e gere relatórios de despesas e orçamentos
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}