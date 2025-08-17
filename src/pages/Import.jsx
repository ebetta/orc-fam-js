import React, { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  FileSpreadsheet,
  Loader2
} from "lucide-react";

import ImportHeader from "../components/imports/ImportHeader";
import ImportResultsModal from "../components/imports/ImportResultsModal";

export default function ImportPage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [tags, setTags] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResults, setImportResults] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [uploadError, setUploadError] = useState("");

  React.useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const { data: accountsData, error: accountsError } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_active', true);

      if (accountsError) throw accountsError;

      const { data: tagsData, error: tagsError } = await supabase
        .from('tags')
        .select('*')
        .eq('is_active', true);

      if (tagsError) throw tagsError;

      setAccounts(accountsData);
      setTags(tagsData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    setUploadError("");

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const allowedTypes = ['.csv', '.ofx'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

    if (!allowedTypes.includes(fileExtension)) {
      setUploadError("Tipo de arquivo não suportado. Use apenas arquivos .csv ou .ofx");
      setSelectedFile(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Arquivo muito grande. O tamanho máximo é 10MB");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const normalizeDate = (dateStr) => {
    if (!dateStr) return new Date().toISOString().split('T')[0];

    let date;
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        date = new Date(`${year}-${month}-${day}`);
      }
    } else if (dateStr.includes('-')) {
      date = new Date(dateStr);
    } else {
      date = new Date(dateStr);
    }

    return date.toISOString().split('T')[0];
  };

  const checkTransactionExists = async (transaction, accountId) => {
    try {
        const { data: existingTransactions, error } = await supabase
            .from('transactions')
            .select('id, description, amount')
            .eq('account_id', accountId)
            .eq('transaction_date', transaction.date)
            .eq('amount', Math.abs(transaction.amount));

        if (error) throw error;

        return existingTransactions.some(existing => {
            const similarDescription = existing.description.toLowerCase().includes(
                transaction.description.toLowerCase().substring(0, 20)
            ) || transaction.description.toLowerCase().includes(
                existing.description.toLowerCase().substring(0, 20)
            );
            return similarDescription;
        });
    } catch (error) {
        console.error("Erro ao verificar transação existente:", error);
        return false;
    }
};


  const findMatchingTag = (description) => {
    if (!description || tags.length === 0) return null;

    const descLower = description.toLowerCase();

    const commonMatches = {
      'supermercado': ['supermercado', 'mercado', 'alimentação'],
      'combustível': ['posto', 'combustível', 'gasolina', 'álcool', 'diesel'],
      'farmácia': ['farmácia', 'drogaria', 'medicamento'],
      'restaurante': ['restaurante', 'lanchonete', 'fast food', 'delivery'],
      'transporte': ['uber', 'taxi', '99', 'transporte', 'ônibus'],
      'banco': ['taxa', 'tarifa', 'anuidade', 'juros', 'banco'],
      'salário': ['salário', 'salario', 'vencimento', 'pagamento']
    };

    for (const tag of tags) {
      const tagNameLower = tag.name.toLowerCase();

      if (descLower.includes(tagNameLower)) {
        return tag.id;
      }

      const keywords = commonMatches[tagNameLower];
      if (keywords && keywords.some(keyword => descLower.includes(keyword))) {
        return tag.id;
      }
    }

    return null;
  };

  const handleTagUpdate = async (transactionId, tagId) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ tag_id: tagId })
        .eq('id', transactionId);

      if (error) throw error;

      // Update local state to reflect the change immediately
      setImportResults(prevResults => {
        const newDetails = prevResults.details.map(detail => {
          if (detail.transactionId === transactionId) {
            return { ...detail, tagId: tagId };
          }
          return detail;
        });
        return { ...prevResults, details: newDetails };
      });

    } catch (error) {
      console.error("Erro ao atualizar tag:", error);
    }
  };

const handleImport = async () => {
    if (!selectedFile || !selectedAccount) {
        setUploadError("Selecione um arquivo e uma conta para continuar");
        return;
    }

    setIsProcessing(true);
    setProgress(0);
    setUploadError("");

    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        // Parse do arquivo CSV diretamente no cliente
        setProgress(25);
        Papa.parse(selectedFile, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const transactions = results.data;
                setProgress(50);

                // Processar transações
                const importResults = {
                    total: transactions.length,
                    imported: 0,
                    skipped: 0,
                    errors: 0,
                    details: []
                };

                for (let i = 0; i < transactions.length; i++) {
                    const transaction = transactions[i];
                    setProgress(50 + (i / transactions.length) * 50);

                    try {
                        const normalizedDate = normalizeDate(transaction.date || transaction.Data);
                        const amount = Math.abs(parseFloat(transaction.amount || transaction.Valor) || 0);
                        const description = transaction.description || transaction.Histórico || transaction.Descrição;
                        const isCredit = (transaction.type && transaction.type.toLowerCase() === 'credit') || parseFloat(transaction.amount || transaction.Valor) > 0;

                        if (!description || !amount) {
                            importResults.skipped++;
                            importResults.details.push({
                                status: 'skipped',
                                description: description || 'Linha inválida',
                                amount: amount || 0,
                                date: normalizedDate,
                                reason: 'Descrição ou valor ausente'
                            });
                            continue;
                        }

                        const transactionData = {
                            description: description,
                            amount: amount,
                            transaction_type: isCredit ? 'income' : 'expense',
                            account_id: selectedAccount,
                            transaction_date: normalizedDate,
                            tag_id: findMatchingTag(description),
                            notes: `Importado de ${selectedFile.name}`,
                            user_id: user.id
                        };

                        const exists = await checkTransactionExists({
                            date: normalizedDate,
                            description: description,
                            amount: amount
                        }, selectedAccount);

                        if (exists) {
                            importResults.skipped++;
                            importResults.details.push({
                                status: 'skipped',
                                description: description,
                                amount: amount,
                                date: normalizedDate,
                                reason: 'Transação já existe'
                            });
                        } else {
                            const { data: newTransaction, error: insertError } = await supabase.from('transactions').insert([transactionData]).select('id, tag_id').single();
                            if (insertError) throw insertError;

                            importResults.imported++;
                            importResults.details.push({
                                status: 'imported',
                                description: description,
                                amount: amount,
                                date: normalizedDate,
                                reason: 'Importado com sucesso',
                                transactionId: newTransaction.id,
                                tagId: newTransaction.tag_id
                            });
                        }
                    } catch (error) {
                        importResults.errors++;
                        importResults.details.push({
                            status: 'error',
                            description: transaction.description || 'Erro na transação',
                            amount: transaction.amount || 0,
                            date: transaction.date || '',
                            reason: error.message
                        });
                    }
                }

                setProgress(100);
                setImportResults(importResults);
                setShowResults(true);
                setIsProcessing(false);
            },
            error: (error) => {
                setUploadError("Falha ao processar arquivo: " + error.message);
                setIsProcessing(false);
            }
        });

    } catch (error) {
        console.error("Erro na importação:", error);
        setUploadError(error.message || "Erro inesperado durante a importação");
        setIsProcessing(false);
    }
};


  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <ImportHeader />
      </motion.div>

      <Card className="shadow-lg border-0">
        <CardHeader className="border-b bg-gray-50">
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-indigo-600" />
            Importar Extrato Bancário
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          {/* Seleção de Arquivo */}
          <div className="space-y-2">
            <Label htmlFor="file-input" className="text-sm font-medium">
              Arquivo do Extrato *
            </Label>
            <div className="flex items-center gap-4">
              <Input
                id="file-input"
                type="file"
                accept=".csv,.ofx"
                onChange={handleFileSelect}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
              {selectedFile && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>{selectedFile.name}</span>
                  <Badge variant="outline">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </Badge>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Formatos suportados: .csv, .ofx (máximo 10MB)
            </p>
          </div>

          {/* Seleção de Conta */}
          <div className="space-y-2">
            <Label htmlFor="account-select" className="text-sm font-medium">
              Conta de Destino *
            </Label>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a conta para importar as transações" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map(account => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} ({account.bank})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Avisos e Erros */}
          <AnimatePresence>
            {uploadError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{uploadError}</AlertDescription>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Progresso */}
          <AnimatePresence>
            {isProcessing && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="space-y-3"
              >
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processando arquivo...
                </div>
                <Progress value={progress} className="w-full" />
                <p className="text-xs text-gray-500">
                  {progress < 30 ? 'Fazendo upload...' :
                   progress < 50 ? 'Extraindo dados...' :
                   'Importando transações...'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Informações sobre a importação */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Como funciona a importação
            </h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• O sistema detecta automaticamente transações duplicadas</li>
              <li>• Tags são atribuídas automaticamente baseadas na descrição</li>
              <li>• O saldo da conta será atualizado automaticamente</li>
              <li>• Um log detalhado será exibido ao final da importação</li>
            </ul>
          </div>

          {/* Botão de Importar */}
          <div className="flex justify-end pt-4">
            <Button
              onClick={handleImport}
              disabled={!selectedFile || !selectedAccount || isProcessing}
              size="lg"
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Importar Extrato
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Resultados */}
      <ImportResultsModal
        results={importResults}
        isOpen={showResults}
        tags={tags}
        onTagChange={handleTagUpdate}
        onClose={() => {
          setShowResults(false);
          setSelectedFile(null);
          setSelectedAccount("");
          setProgress(0);
          // Limpar input de arquivo
          const fileInput = document.getElementById('file-input');
          if (fileInput) fileInput.value = '';
        }}
      />
    </div>
  );
}