import { useState } from 'react';
import { UploadCloud, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from 'sonner';

export function FiscalPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await api.post('/fiscal/import-xml', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(response.data.message || 'XML importado com sucesso');
      setFile(null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao importar XML');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Módulo Fiscal</h1>
          <p className="text-sm text-slate-500">Importe Notas Fiscais (XML) e configure seu certificado</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200">
            <h2 className="text-lg font-semibold mb-4 border-b border-slate-100 pb-2">Entrada de NF-e (XML)</h2>
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50 hover:bg-slate-100 transition-colors">
              <UploadCloud className="mx-auto h-12 w-12 text-slate-400 mb-3" />
              <p className="text-sm text-slate-600 mb-4">Arraste seu arquivo XML ou clique para selecionar</p>
              <input 
                type="file" 
                accept=".xml" 
                className="hidden" 
                id="xml-upload" 
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <label htmlFor="xml-upload" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-indigo-700">
                Selecionar XML
              </label>
            </div>
            {file && (
              <div className="mt-4 flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="flex items-center gap-3">
                  <FileText className="text-indigo-600" size={20} />
                  <span className="text-sm font-medium text-slate-700 truncate max-w-[200px]">{file.name}</span>
                </div>
                <button 
                  onClick={handleUpload}
                  disabled={loading}
                  className="text-sm bg-green-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? 'Processando...' : 'Importar'}
                </button>
              </div>
            )}
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200">
            <h2 className="text-lg font-semibold mb-4 border-b border-slate-100 pb-2">Certificado Digital (A1)</h2>
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex items-start gap-3">
                <AlertTriangle className="text-amber-500 mt-0.5" size={20} />
                <div>
                  <h3 className="text-sm font-medium text-amber-800">Nenhum certificado configurado</h3>
                  <p className="text-xs text-amber-700 mt-1">Carregue um arquivo .pfx para emitir notas fiscais pelo sistema.</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Senha do Certificado</label>
                <input type="password" placeholder="Digite a senha" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
              </div>
              <button disabled className="w-full bg-slate-800 text-white font-medium py-2 rounded-lg text-sm opacity-50 cursor-not-allowed">
                Salvar Configuração Fiscal
              </button>
            </div>
        </div>
      </div>
    </div>
  );
}
