
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
        // Obter todas as conversões de moeda necessárias de uma vez pode ser otimizado depois,
        // mas vamos manter a lógica por conta para simplicidade agora.

        // Mapear todas as transações com datas normalizadas para facilitar comparação
        const normalizedTransactions = transactions.map(t => ({
          ...t,
          normalizedDate: new Date(t.transaction_date.replace(/-/g, '/'))
        }));

        // Para cada mês no período (do passado para o presente)
        // A lógica regressiva é eficiente se calcularmos o ponto inicial (hoje)
        // e formos voltando no tempo? 
        // Na verdade, para plotar o gráfico, precisamos do valor em N pontos no tempo.
        // Ponto 1: Fim do mês X (Ex: 01/Jan a 31/Jan). 
        // Saldo em 31/Jan = Saldo Atual (Hoje) - Transações entre (31/Jan e Hoje).
        // Se Hoje é 15/Fev. 
        // Saldo 31/Jan = Saldo 15/Fev - (Tx de 01/Fev a 15/Fev).

        // Vamos iterar pelos meses desejados.
        for (let i = numberOfMonths - 1; i >= 0; i--) {
          const targetMonthDate = subMonths(today, i);
          const monthEnd = endOfMonth(targetMonthDate);

          let monthNetWorthInBRL = 0;

          for (const account of accounts) {
            if (account.is_active === false) continue;

            const accountCurrency = account.currency || 'BRL';

            // PONTO DE PARTIDA: Saldo Atual da Conta (Database/Dashboard)
            let currentBalance = parseFloat(account.current_balance);
            if (isNaN(currentBalance)) {
              currentBalance = parseFloat(account.initial_balance) || 0;
            }

            let historicalBalance = currentBalance;

            // Lógica Regressiva: Remover transações que aconteceram DEPOIS do monthEnd até HOJE/Fim dos tempos.
            // Ou seja, filtrar transações onde data > monthEnd.
            // Para cada uma dessas transações, desfazer o efeito.

            const transactionsAfterPeriod = normalizedTransactions.filter(t => {
              return t.normalizedDate > monthEnd &&
                (t.account_id === account.id || t.destination_account_id === account.id);
            });

            transactionsAfterPeriod.forEach(t => {
              const amount = parseFloat(t.amount || 0);

              // Se é cartão de crédito, o saldo geralmente é positivo na UI mas representa dívida?
              // No DB, users costumam guardar como positivo (valor da fatura) ou negativo?
              // Baseado no NetWorthCard: "Credit cards are liabilities, so their absolute value should always be subtracted"
              // E no código anterior, parecia tratar saldo como valor nominal.
              // Vamos assumir que 'historicalBalance' segue a mesma convenção do 'currentBalance'.

              // Logica de Desfazer (Inverse Operation):
              // Se foi Income (recebeu): Saldo era menor -> Subtrair
              // Se foi Expense (gastou): Saldo era maior -> Somar

              if (account.account_type === 'credit_card') {
                // Cartão de Crédito é tricky. Geralmente Saldo aumenta com Expense e diminui com Pagamento (Transfer/Income).
                // Se o currentBalance é 1000 (dívida), e gastou 100 hoje (expense). Ontem devia 900.
                // Undo Expense: 1000 - 100 = 900. (Expense diminui o saldo devedor na volta)
                // Se pagou 500 hoje (Income/Transfer). Ontem devia 1500.
                // Undo Payment: 1000 + 500 = 1500.

                if (t.account_id === account.id) {
                  if (t.transaction_type === 'expense') {
                    // Forward: +Dívida. Backward: -Dívida.
                    historicalBalance -= amount;
                  } else if (t.transaction_type === 'income') { // Pagamento/Estorno
                    // Forward: -Dívida. Backward: +Dívida.
                    historicalBalance += amount;
                  } else if (t.transaction_type === 'transfer') { // Saque?
                    // Se for 'transfer' saindo do cartão (saque cartão credito?) -> Aumenta divida
                    // Forward: +Divida. Backward: -Divida.
                    historicalBalance -= amount;
                  }
                } else if (t.destination_account_id === account.id) {
                  // Transferencia entrando (Pagamento de fatura vindo de outra conta)
                  // Forward: -Divida. Backward: +Divida.
                  historicalBalance += amount;
                }

              } else {
                // Contas Comuns (Checking, Investment, etc)
                if (t.account_id === account.id) {
                  if (t.transaction_type === 'income') {
                    // Forward: += amount. Backward: -= amount
                    historicalBalance -= amount;
                  } else if (t.transaction_type === 'expense') {
                    // Forward: -= amount. Backward: += amount
                    historicalBalance += amount;
                  } else if (t.transaction_type === 'transfer') {
                    // Transferencia saindo
                    // Forward: -= amount. Backward: += amount
                    historicalBalance += amount;
                  }
                } else if (t.destination_account_id === account.id) {
                  // Transferencia entrando
                  // Forward: += amount. Backward: -= amount
                  historicalBalance -= amount;
                }
              }
            });

            // Converter o saldo histórico calculado para BRL
            const accountBalanceInBRL = await convertCurrency(
              historicalBalance,
              accountCurrency,
              'BRL'
            );

            // Add to Net Worth
            if (account.account_type === 'credit_card') {
              // Subtrair dívida do patrimônio
              monthNetWorthInBRL -= Math.abs(accountBalanceInBRL);
            } else {
              monthNetWorthInBRL += accountBalanceInBRL;
            }

            // Pequena pausa para UI responsiva
            await new Promise(resolve => setTimeout(resolve, 5));
          }

          data.push({
            month: format(monthEnd, "MMM/yy", { locale: ptBR }), // Usar monthEnd para ser fiel à data
            patrimonio: monthNetWorthInBRL,
          });

          // Pausa entre meses
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        setChartData(data);
      } catch (error) {
        console.error('Erro ao calcular evolução do patrimônio (Regressivo):', error);
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
              <Legend wrapperStyle={{ fontSize: "12px" }} />
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
