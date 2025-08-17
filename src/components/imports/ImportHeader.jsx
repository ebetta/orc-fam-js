import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, FileText, CheckCircle2 } from "lucide-react";

export default function ImportHeader() {
  return (
    <Card className="bg-gradient-to-r from-indigo-500 to-indigo-700 border-0 shadow-xl">
      <CardContent className="p-8">
        <div className="text-white">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Upload className="w-8 h-8" />
            Importação de Extratos
          </h1>
          <p className="text-indigo-100 text-lg mb-6">
            Importe suas transações bancárias de arquivos CSV ou OFX
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 bg-white/10 rounded-lg p-4">
              <FileText className="w-8 h-8 text-indigo-200" />
              <div>
                <h3 className="font-semibold">Formatos Suportados</h3>
                <p className="text-sm text-indigo-100">CSV e OFX</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 bg-white/10 rounded-lg p-4">
              <CheckCircle2 className="w-8 h-8 text-indigo-200" />
              <div>
                <h3 className="font-semibold">Detecção Automática</h3>
                <p className="text-sm text-indigo-100">Evita duplicatas</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 bg-white/10 rounded-lg p-4">
              <Upload className="w-8 h-8 text-indigo-200" />
              <div>
                <h3 className="font-semibold">Atualização Automática</h3>
                <p className="text-sm text-indigo-100">Saldos e categorias</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}