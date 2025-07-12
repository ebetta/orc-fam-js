
import React, { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Target, Inbox, X, Printer, FileDown } from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const formatCurrency = (amount) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);

const getProgressColor = (percentage) => {
  if (percentage > 100) return 'var(--tw-color-red-500)';
  if (percentage >= 80) return 'var(--tw-color-yellow-500)';
  return 'var(--tw-color-green-500)';
};

export default function BudgetReport({ groupedBudgets, summaryTotals, tags, isLoading, onClose, isPopup = false }) {
    const reportRef = useRef();
    const footerRef = useRef();

    const handleExportPDF = async () => {
        const input = reportRef.current;
        const buttons = input.querySelector('.report-buttons');
        if (buttons) buttons.style.display = 'none';

        const pdf = new jsPDF('p', 'px', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const margin = 40;
        let y = margin; // Posição vertical inicial

        const addImageToPdf = (canvas, pdf, yPos) => {
            const imgData = canvas.toDataURL('image/png');
            const imgWidth = pdfWidth - (margin * 2);
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            if (yPos + imgHeight > pdfHeight - margin) {
                pdf.addPage();
                yPos = margin;
            }
            pdf.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
            return yPos + imgHeight;
        };

        // Adiciona o cabeçalho do relatório
        const headerElement = input.querySelector('.report-header-for-pdf');
        if (headerElement) {
            const canvas = await html2canvas(headerElement, { scale: 2, useCORS: true });
            y = addImageToPdf(canvas, pdf, y);
        }

        // Adiciona a tabela de cabeçalho
        const tableHeaderElement = input.querySelector('table > thead');
        if (tableHeaderElement) {
            const canvas = await html2canvas(tableHeaderElement, { scale: 2, useCORS: true });
            y = addImageToPdf(canvas, pdf, y);
        }

        const groupElements = input.querySelectorAll('.budget-group');
        for (const groupEl of groupElements) {
            const canvas = await html2canvas(groupEl, { scale: 2, useCORS: true });
            const groupImgHeight = (canvas.height * (pdfWidth - margin * 2)) / canvas.width;

            if (y + groupImgHeight > pdfHeight - margin) {
                pdf.addPage();
                y = margin;
                 // Readiciona o cabeçalho da tabela na nova página
                if (tableHeaderElement) {
                    const headerCanvas = await html2canvas(tableHeaderElement, { scale: 2, useCORS: true });
                    y = addImageToPdf(headerCanvas, pdf, y);
                }
            }
            y = addImageToPdf(canvas, pdf, y);
        }

        // Adiciona o rodapé da tabela
        const footerElement = footerRef.current;
        if (footerElement) {
            const canvas = await html2canvas(footerElement, { scale: 2, useCORS: true });
            y = addImageToPdf(canvas, pdf, y);
        }

        if (buttons) buttons.style.display = 'flex';
        const now = new Date();
        const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
        pdf.save(`relatorio_orcamento_${timestamp}.pdf`);
    };

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
        <div ref={reportRef}>
            <Card className={`shadow-lg border-0 ${isPopup ? 'bg-white' : ''}`}>
                <CardHeader className="border-b bg-gray-50 report-header-for-pdf">
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Target className="w-5 h-5 text-orange-600"/>
                            Relatório de Orçamento
                        </CardTitle>
                        {isPopup && (
                            <div className="flex items-center gap-2 report-buttons">
                                <Button variant="ghost" size="icon" onClick={handleExportPDF} title="Salvar como PDF">
                                    <FileDown className="w-5 h-5" />
                                </Button>
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
                    ) : groupedBudgets.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Orçamento (Tag)</TableHead>
                                    <TableHead className="text-right">Orçado</TableHead>
                                    <TableHead className="text-right">Gasto</TableHead>
                                    <TableHead className="text-right">Disponível</TableHead>
                                </TableRow>
                            </TableHeader>
                            {groupedBudgets.map(group => (
                                <TableBody key={group.parentTag.id} className="budget-group">
                                    <TableRow className="bg-gray-100 hover:bg-gray-100">
                                        <TableCell colSpan="1" className="font-bold text-gray-700">
                                            <div className="flex items-center gap-2">
                                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: group.parentTag.color }}></span>
                                                {group.parentTag.name}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-gray-700">{formatCurrency(group.groupTotalOrcado)}</TableCell>
                                        <TableCell className="text-right font-bold text-gray-700">{formatCurrency(group.groupTotalGasto)}</TableCell>
                                        <TableCell className={`text-right font-bold ${group.groupTotalDisponivel < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(group.groupTotalDisponivel)}</TableCell>
                                    </TableRow>
                                    {group.budgets.map(item => {
                                        const orcado = item.total_budgeted_for_period || 0;
                                        const gasto = item.spent_amount || 0;
                                        const disponivel = orcado - gasto;
                                        const percentual = orcado > 0 ? (gasto / orcado) * 100 : 0;

                                        return (
                                            <TableRow key={item.id}>
                                                <TableCell className="pl-8">
                                                    <div className="font-medium flex items-center gap-2">
                                                        <span className="w-2.5 h-2.5 rounded-full tag-color" style={{ backgroundColor: item.tagColor }}></span>
                                                        {item.tagName}
                                                    </div>
                                                    <Progress value={Math.min(percentual, 100)} className="h-1.5 mt-1" style={{ '--progress-background': getProgressColor(percentual) }} />
                                                </TableCell>
                                                <TableCell className="text-right">{formatCurrency(orcado)}</TableCell>
                                                <TableCell className={`text-right ${gasto > orcado ? 'text-red-600 font-medium' : ''}`}>{formatCurrency(gasto)}</TableCell>
                                                <TableCell className={`text-right ${disponivel < 0 ? 'text-red-600 font-medium' : 'text-green-600'}`}>{formatCurrency(disponivel)}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            ))}
                            <TableFooter ref={footerRef}>
                                <TableRow className="bg-gray-50 hover:bg-gray-50 footer">
                                    <TableCell className="font-bold">Total Geral</TableCell>
                                    <TableCell className="text-right font-bold">{formatCurrency(summaryTotals.orcado)}</TableCell>
                                    <TableCell className="text-right font-bold">{formatCurrency(summaryTotals.gasto)}</TableCell>
                                    <TableCell className={`text-right font-bold ${summaryTotals.disponivel < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(summaryTotals.disponivel)}</TableCell>
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
        </div>
    );
}
