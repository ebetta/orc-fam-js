import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingDown, Inbox, X, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

const formatCurrency = (amount) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);

export default function ExpensesByTagReport({ transactions, tags, isLoading, onClose, isPopup = false }) {
    const reportData = React.useMemo(() => {
        const expenseTransactions = transactions.filter(t => t.transaction_type === 'expense');
        const dataByTag = {};

        expenseTransactions.forEach(t => {
            const tag = tags.find(tag => tag.id === t.tag_id);
            const tagName = tag ? tag.name : 'Sem Tag';
            const tagColor = tag ? tag.color : '#A1A1AA';

            if (!dataByTag[tagName]) {
                dataByTag[tagName] = { total: 0, count: 0, color: tagColor };
            }
            dataByTag[tagName].total += parseFloat(t.amount || 0);
            dataByTag[tagName].count++;
        });

        return Object.entries(dataByTag)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.total - a.total);
    }, [transactions, tags]);

    const totalExpenses = reportData.reduce((sum, item) => sum + item.total, 0);

    const handlePrint = () => {
        const printContent = document.getElementById('expenses-report-content');
        const originalContent = document.body.innerHTML;
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Relatório de Despesas por Tags</title>
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
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Relatório de Despesas por Tags</h1>
                        <p>Gerado em: ${new Date().toLocaleDateString('pt-BR')}</p>
                    </div>
                    ${printContent.innerHTML}
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
                        <TrendingDown className="w-5 h-5 text-red-600"/>
                        Despesas por Tags
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
            <CardContent className="p-0" id="expenses-report-content">
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
                                <TableHead>Tag</TableHead>
                                <TableHead className="text-center">Qtd.</TableHead>
                                <TableHead className="text-right">Total Gasto</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportData.map(item => (
                                <TableRow key={item.name}>
                                    <TableCell className="font-medium flex items-center gap-2">
                                       <span className="w-2.5 h-2.5 rounded-full tag-color" style={{backgroundColor: item.color}}></span>
                                       {item.name}
                                    </TableCell>
                                    <TableCell className="text-center">{item.count}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow className="bg-gray-50 hover:bg-gray-50 footer">
                                <TableCell colSpan={2} className="font-bold">Total Geral</TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(totalExpenses)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                ) : (
                    <div className="text-center py-12 px-6">
                        <Inbox className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-800">Nenhum dado encontrado</h3>
                        <p className="text-gray-500 text-sm">Nenhuma despesa encontrada para os filtros selecionados.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}