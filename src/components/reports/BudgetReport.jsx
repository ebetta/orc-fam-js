
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Target, Inbox, X, Printer } from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { Button } from '@/components/ui/button';

const formatCurrency = (amount) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);

const getProgressColor = (percentage) => {
  if (percentage > 100) return 'var(--tw-color-red-500)';
  if (percentage >= 80) return 'var(--tw-color-yellow-500)';
  return 'var(--tw-color-green-500)';
};

export default function BudgetReport({ budgets, tags, isLoading, onClose, isPopup = false }) {
     const reportData = React.useMemo(() => {
        return budgets.map(b => {
            const tag = tags.find(t => t.id === b.tag_id);
            const orcado = b.amount || 0;
            const gasto = b.spent_amount || 0;
            const disponivel = orcado - gasto;
            const percentual = orcado > 0 ? (gasto / orcado) * 100 : 0;
            return {
                ...b,
                tagName: tag?.name || 'Tag Desconhecida',
                tagColor: tag?.color || '#A1A1AA',
                orcado,
                gasto,
                disponivel,
                percentual
            }
        }).sort((a, b) => b.gasto - a.gasto);
    }, [budgets, tags]);

    const totals = reportData.reduce((acc, curr) => {
        acc.orcado += curr.orcado;
        acc.gasto += curr.gasto;
        acc.disponivel += curr.disponivel;
        return acc;
    }, { orcado: 0, gasto: 0, disponivel: 0 });

    const handlePrint = () => {
        const printContent = document.getElementById('budget-report-content');
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Relatório de Orçamento</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f5f5f5; font-weight: bold; }
                        .header { text-align: center; margin-bottom: 20px; }
                        .tag-color { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 8px; }
                        .text-right { text-align: right; }
                        .text-center { text-align: center; }
                        .footer { background-color: #f5f5f5; font-weight: bold; }
                        .progress-bar { width: 100%; height: 6px; background-color: #e5e7eb; border-radius: 3px; margin-top: 4px; overflow: hidden; }
                        .progress-fill { height: 100%; transition: width 0.3s ease; }
                        .green { background-color: #10b981; }
                        .yellow { background-color: #f59e0b; }
                        .red { background-color: #ef4444; }
                        .text-red { color: #ef4444; }
                        .text-green { color: #10b981; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Relatório de Orçamento</h1>
                        <p>Gerado em: ${new Date().toLocaleDateString('pt-BR')}</p>
                    </div>
                    ${printContent.innerHTML.replace(/<Progress[^>]*\/>/g, (match) => {
                        // Substituir componente Progress por HTML simples para impressão
                        return '<div class="progress-bar"><div class="progress-fill green" style="width: 50%;"></div></div>';
                    })}
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
        printWindow.close();
    };

    return (
        <Card className={`shadow-lg border-0 ${isPopup ? 'bg-white' : ''}`}>
            <CardHeader className="border-b bg-gray-50">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-orange-600"/>
                        Relatório de Orçamento
                    </CardTitle>
                    {isPopup && (
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" onClick={handlePrint} title="Imprimir relatório">
                                <Printer className="w-5 h-5" />
                            </Button>
                            {onClose && (
                                <Button variant="ghost" size="icon" onClick={onClose}>
                                    <X className="w-5 h-5" />
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-0" id="budget-report-content">
                 {isLoading ? (
                    <div className="p-6 space-y-2">
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-6 w-5/6" />
                    </div>
                ) : reportData.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Orçamento (Tag)</TableHead>
                                <TableHead className="text-right">Orçado</TableHead>
                                <TableHead className="text-right">Gasto</TableHead>
                                <TableHead className="text-right">Disponível</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportData.map(item => (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        <div className="font-medium flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full tag-color" style={{backgroundColor: item.tagColor}}></span>
                                            {item.tagName}
                                        </div>
                                        <Progress value={Math.min(item.percentual, 100)} className="h-1.5 mt-1" style={{'--progress-background': getProgressColor(item.percentual)}} />
                                    </TableCell>
                                    <TableCell className="text-right">{formatCurrency(item.orcado)}</TableCell>
                                    <TableCell className={`text-right ${item.gasto > item.orcado ? 'text-red-600 font-medium' : ''}`}>{formatCurrency(item.gasto)}</TableCell>
                                    <TableCell className={`text-right ${item.disponivel < 0 ? 'text-red-600 font-medium' : 'text-green-600'}`}>{formatCurrency(item.disponivel)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow className="bg-gray-50 hover:bg-gray-50 footer">
                                <TableCell className="font-bold">Total Geral</TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(totals.orcado)}</TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(totals.gasto)}</TableCell>
                                <TableCell className={`text-right font-bold ${totals.disponivel < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(totals.disponivel)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                ) : (
                     <div className="text-center py-12 px-6">
                        <Inbox className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-800">Nenhum dado encontrado</h3>
                        <p className="text-gray-500 text-sm">Nenhum orçamento encontrado para as tags selecionadas.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
