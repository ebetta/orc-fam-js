import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, XCircle, AlertTriangle, Download } from "lucide-react";
import { format } from "date-fns";
import TagSelector from "./TagSelector";

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(amount);
};

const getStatusIcon = (status) => {
  switch (status) {
    case 'imported':
      return <CheckCircle className="w-4 h-4 text-green-600" />;
    case 'skipped':
      return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
    case 'error':
      return <XCircle className="w-4 h-4 text-red-600" />;
    default:
      return null;
  }
};

const getStatusColor = (status) => {
  switch (status) {
    case 'imported':
      return 'bg-green-100 text-green-800';
    case 'skipped':
      return 'bg-yellow-100 text-yellow-800';
    case 'error':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export default function ImportResultsModal({ results, isOpen, onClose, tags, onTagChange }) {
  if (!results) return null;

  const downloadLog = () => {
    const logContent = [
      'Relatório de Importação - ' + new Date().toLocaleDateString('pt-BR'),
      '='.repeat(50),
      `Total de transações: ${results.total}`,
      `Importadas: ${results.imported}`,
      `Ignoradas: ${results.skipped}`,
      `Erros: ${results.errors}`,
      '',
      'Detalhes:',
      '-'.repeat(30)
    ];

    results.details.forEach((detail, index) => {
      logContent.push(`${index + 1}. ${detail.description}`);
      logContent.push(`   Data: ${detail.date}`);
      logContent.push(`   Valor: ${formatCurrency(detail.amount)}`);
      logContent.push(`   Status: ${detail.status.toUpperCase()}`);
      logContent.push(`   Motivo: ${detail.reason}`);
      logContent.push('');
    });

    const blob = new Blob([logContent.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `importacao_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] bg-card text-card-foreground flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Resultado da Importação
          </DialogTitle>
        </DialogHeader>

        {/* Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-800">{results.total}</div>
            <div className="text-sm text-gray-600">Total</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-800">{results.imported}</div>
            <div className="text-sm text-green-600">Importadas</div>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-800">{results.skipped}</div>
            <div className="text-sm text-yellow-600">Ignoradas</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-800">{results.errors}</div>
            <div className="text-sm text-red-600">Erros</div>
          </div>
        </div>

        <Separator />

        {/* Detalhes */}
        <div className="flex-1 mt-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Detalhes das Transações</h3>
                <Button variant="outline" size="sm" onClick={downloadLog}>
                  <Download className="w-4 h-4 mr-2" />
                  Baixar Log
                </Button>
            </div>

            <div className="space-y-3 pr-4">
                {results.details.map((detail, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    {getStatusIcon(detail.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900 truncate">
                          {detail.description}
                          </span>
                          <Badge className={getStatusColor(detail.status)}>
                          {detail.status === 'imported' ? 'Importada' : 
                              detail.status === 'skipped' ? 'Ignorada' : 'Erro'}
                          </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>{detail.date}</span>
                          <span className="font-medium">{formatCurrency(detail.amount)}</span>
                          <span className="text-xs truncate">{detail.reason}</span>
                      </div>
                    </div>
                    {detail.status === 'imported' && (
                      <div className="w-48">
                        <TagSelector 
                          tags={tags} 
                          selectedTagId={detail.tagId} 
                          onTagChange={(tagId) => onTagChange(detail.transactionId, tagId)} 
                        />
                      </div>
                    )}
                </div>
                ))}
            </div>
        </div>


        {/* Ações */}
        <div className="flex justify-end gap-3 pt-4 border-t mt-4">
          <Button variant="outline" onClick={downloadLog}>
            <Download className="w-4 h-4 mr-2" />
            Baixar Log Completo
          </Button>
          <Button onClick={onClose} className="bg-indigo-600 hover:bg-indigo-700">
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}