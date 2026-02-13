
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, ArrowRight, Check, X, AlertCircle, FileSpreadsheet, ArrowLeft, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../services/api';

// Types
interface ImportPreview {
  headers: string[];
  preview: any[];
  data: any[];
  totalRows: number;
}

interface Mapping {
  [key: string]: string;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: { row: number; error: string; data: any }[];
}

const SYSTEM_FIELDS = [
  { key: 'name', label: 'Nome Completo', required: true },
  { key: 'email', label: 'E-mail' },
  { key: 'phone', label: 'Telefone Fixo' },
  { key: 'whatsapp', label: 'Celular / WhatsApp' },
  { key: 'document', label: 'CPF / CNPJ' },
  { key: 'category', label: 'Categoria' },
  { key: 'notes', label: 'Observações' },
  { key: 'address_street', label: 'Rua' },
  { key: 'address_number', label: 'Número' },
  { key: 'address_city', label: 'Cidade' },
  { key: 'address_state', label: 'Estado (UF)' },
  { key: 'address_zip', label: 'CEP' },
  { key: 'companyName', label: 'Razão Social (PJ)' },
  { key: 'stateRegistration', label: 'Inscrição Estadual (PJ)' },
];

export function ImportContacts() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<ImportPreview | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [duplicateAction, setDuplicateAction] = useState<'skip' | 'update'>('skip');

  // Step 1: Upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      await uploadFile(selectedFile);
    }
  };

  const uploadFile = async (fileToUpload: File) => {
    setLoading(true);
    const formData = new FormData();
    formData.append('file', fileToUpload);

    try {
      const response = await api.post('/contacts/import/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreviewData(response.data);
      
      // Auto-map columns with similar names
      const autoMapping: Mapping = {};
      const headers = response.data.headers.map((h: string) => h.toLowerCase());
      
      SYSTEM_FIELDS.forEach(field => {
        const exactMatch = response.data.headers.find((h: string) => h.toLowerCase() === field.key.toLowerCase());
        if (exactMatch) {
            autoMapping[field.key] = exactMatch;
        } else {
            // Fuzzy/Smart match specific rules
            if (field.key === 'name') {
                const match = response.data.headers.find((h: string) => ['nome', 'cliente', 'nome completo'].includes(h.toLowerCase()));
                if (match) autoMapping[field.key] = match;
            }
            if (field.key === 'document') {
                const match = response.data.headers.find((h: string) => ['cpf', 'cnpj', 'documento', 'cpf/cnpj'].includes(h.toLowerCase()));
                if (match) autoMapping[field.key] = match;
            }
            if (field.key === 'whatsapp' || field.key === 'phone') {
                const match = response.data.headers.find((h: string) => ['celular', 'telefone', 'tel', 'whatsapp', 'whats'].includes(h.toLowerCase()));
                if (match) autoMapping[field.key] = match;
            }
            if (field.key === 'email') {
                const match = response.data.headers.find((h: string) => ['e-mail', 'mail'].includes(h.toLowerCase()));
                if (match) autoMapping[field.key] = match;
            }
        }
      });
      
      setMapping(autoMapping);
      setStep(2);
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.message || 'Erro ao ler arquivo. Verifique se é um CSV ou Excel válido.';
      toast.error(msg);
      setFile(null); // Reset file input so user can try again
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Mapping
  const handleMappingChange = (systemField: string, fileHeader: string) => {
    setMapping(prev => ({
      ...prev,
      [systemField]: fileHeader
    }));
  };

  const validateMapping = () => {
    if (!mapping['name']) {
        toast.warning('O campo "Nome Completo" é obrigatório.');
        return false;
    }
    return true;
  };

  const goToPreview = () => {
    if (validateMapping()) {
        setStep(3);
    }
  };

  // Step 3: Execute
  const executeImport = async () => {
    if (!previewData) return;
    setLoading(true);
    try {
        const payload = {
            data: previewData.data, // Full data we got from upload
            mapping: mapping,
            duplicateAction
        };
        const response = await api.post('/contacts/import/execute', payload);
        setImportResult(response.data);
        setStep(4);
        toast.success(`Importação concluída! ${response.data.success} importados.`);
    } catch (error) {
        console.error(error);
        toast.error('Erro ao importar contatos.');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto min-h-screen text-slate-200">
      <div className="mb-8 flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="flex items-center gap-4">
            <button 
                onClick={() => navigate('/contacts')} 
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-700"
                title="Voltar"
            >
                <ArrowLeft className="w-5 h-5 text-slate-400 hover:text-white" />
            </button>
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                    <FileSpreadsheet className="text-indigo-500" />
                    Importação de Contatos
                </h1>
                <p className="text-sm text-slate-400">Importe seus contatos de planilhas Excel ou CSV</p>
            </div>
        </div>
      </div>

      {/* Steps Indicator */}
      <div className="flex items-center justify-between mb-8 px-12 max-w-4xl mx-auto relative">
        {/* Progress Bar Background */}
        <div className="absolute top-[15px] left-0 w-full h-0.5 bg-slate-800 -z-0 hidden md:block" /> 
        
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex flex-col items-center relative z-10">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 border-2
              ${step >= s 
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20 scale-110' 
                  : 'bg-slate-900 border-slate-700 text-slate-600'}`}>
              {step > s ? <Check className="w-4 h-4" /> : s}
            </div>
            <span className={`text-xs mt-2 font-medium transition-colors duration-300
                ${step >= s ? 'text-indigo-400' : 'text-slate-600'}`}>
              {s === 1 && 'Upload'}
              {s === 2 && 'Mapeamento'}
              {s === 3 && 'Revisão'}
              {s === 4 && 'Conclusão'}
            </span>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 rounded-xl shadow-xl border border-slate-800 p-6 min-h-[400px] animate-in fade-in zoom-in-95 duration-500">
        
        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className={`w-full max-w-xl p-12 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center transition-all duration-300 group
                ${loading 
                    ? 'border-slate-700 bg-slate-900/50 opacity-50 cursor-wait' 
                    : 'border-slate-700 hover:border-indigo-500/50 hover:bg-indigo-500/5 cursor-pointer'}
            `}>
              <label className="w-full cursor-pointer flex flex-col items-center">
                <div className="p-5 bg-slate-800 rounded-full mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-black/20">
                    {loading ? <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" /> : <Upload className="w-10 h-10 text-indigo-500" />}
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                    {loading ? 'Processando arquivo...' : 'Clique para selecionar o arquivo'}
                </h3>
                <p className="text-slate-400 mb-8 max-w-xs mx-auto">Suporta arquivos .xlsx (Excel) e .csv. O tamanho máximo é de 10MB.</p>
                <input 
                    type="file" 
                    className="hidden" 
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    onChange={handleFileChange}
                    disabled={loading}
                />
                {!loading && (
                    <span className="px-6 py-3 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20 active:scale-95">
                        Selecionar Arquivo do Computador
                    </span>
                )}
              </label>
            </div>
            <div className="mt-10 bg-slate-800/50 p-6 rounded-lg border border-slate-800">
                <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-indigo-400" /> 
                    Dicas para importação:
                </h4>
                <ul className="text-sm text-slate-400 list-disc list-inside space-y-2">
                    <li>A primeira linha do arquivo deve conter os <strong>cabeçalhos</strong> das colunas.</li>
                    <li>Certifique-se de que não há linhas vazias antes do cabeçalho.</li>
                    <li>O sistema tentará identificar automaticamente colunas como "Nome", "Email", "CPF".</li>
                </ul>
            </div>
          </div>
        )}

        {/* Step 2: Mapping */}
        {step === 2 && previewData && (
            <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div>
                        <h3 className="text-xl font-bold text-white">Mapeamento de Colunas</h3>
                        <p className="text-slate-400 text-sm mt-1">Vincule as colunas do seu arquivo aos campos do sistema.</p>
                    </div>
                    <div className="px-3 py-1 bg-indigo-500/20 border border-indigo-500/30 rounded-full text-xs font-medium text-indigo-300">
                        {previewData.headers.length} colunas encontradas
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    {SYSTEM_FIELDS.map(field => (
                        <div key={field.key} className="group">
                            <label className="text-sm font-medium text-slate-300 mb-2 block flex items-center gap-1">
                                {field.label}
                                {field.required && <span className="text-red-400" title="Obrigatório">*</span>}
                            </label>
                            <div className="flex items-center gap-3 relative">
                                <div className="absolute left-3 text-slate-500 pointer-events-none">
                                    <ArrowRight className="w-4 h-4" />
                                </div>
                                <select 
                                    className={`w-full bg-slate-950 border rounded-lg pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all appearance-none
                                        ${mapping[field.key] 
                                            ? 'border-indigo-500/50 text-white shadow-lg shadow-indigo-500/10' 
                                            : 'border-slate-700 text-slate-400'}
                                    `}
                                    value={mapping[field.key] || ''}
                                    onChange={(e) => handleMappingChange(field.key, e.target.value)}
                                >
                                    <option value="">-- Ignorar este campo --</option>
                                    {previewData.headers.map(header => (
                                        <option key={header} value={header} className="bg-slate-900 text-white">{header}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex justify-end pt-6 border-t border-slate-800 mt-6 gap-3">
                    <button 
                        onClick={() => setStep(1)}
                        className="px-6 py-2.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors"
                    >
                        Voltar
                    </button>
                    <button 
                        onClick={goToPreview}
                        className="px-8 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all active:scale-95"
                    >
                        Continuar <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && previewData && (
            <div className="space-y-6 animate-in slide-in-from-right-8 duration-500">
                 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div>
                        <h3 className="text-xl font-bold text-white">Revisão e Processamento</h3>
                        <p className="text-slate-400 text-sm mt-1">Verifique como os dados serão importados antes de finalizar.</p>
                    </div>
                    <div className="flex items-center gap-3 text-sm bg-slate-950 p-3 rounded-lg border border-slate-800">
                        <span className="text-slate-400 font-medium">Se houver CPF/CNPJ duplicado:</span>
                        <select 
                            className="bg-slate-800 border-none rounded text-white text-sm focus:ring-0 cursor-pointer font-bold"
                            value={duplicateAction}
                            onChange={(e) => setDuplicateAction(e.target.value as any)}
                        >
                            <option value="skip">Não Importar (Pular)</option>
                            <option value="update">Atualizar Contato</option>
                        </select>
                    </div>
                </div>

                <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950 shadow-inner">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-900 text-slate-300 border-b border-slate-800">
                                <tr>
                                    {SYSTEM_FIELDS.map(field => {
                                        if (!mapping[field.key]) return null;
                                        return (
                                            <th key={field.key} className="px-4 py-3 font-semibold whitespace-nowrap bg-slate-900/50">
                                                {field.label}
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {previewData.preview.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-slate-900/50 transition-colors">
                                        {SYSTEM_FIELDS.map(field => {
                                            if (!mapping[field.key]) return null;
                                            const originalCol = mapping[field.key];
                                            const value = row[originalCol];
                                            return (
                                                <td key={`${idx}-${field.key}`} className="px-4 py-3 text-slate-400 whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis border-r border-slate-800/50 last:border-0">
                                                    {value || <span className="text-slate-700 italic">-</span>}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <p className="text-xs text-center text-slate-500 mt-2">
                    Exibindo prévia das primeiras {previewData.preview.length} linhas. Total de registros a importar: <span className="text-white font-bold">{previewData.totalRows}</span>.
                </p>

                <div className="flex justify-end pt-6 border-t border-slate-800 mt-6 gap-3">
                    <button 
                        onClick={() => setStep(2)}
                        disabled={loading}
                        className="px-6 py-2.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors"
                    >
                        Voltar
                    </button>
                    <button 
                        onClick={executeImport}
                        disabled={loading}
                        className="px-8 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-500 shadow-lg shadow-green-500/20 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        {loading ? 'Processando...' : 'Confirmar e Importar'}
                    </button>
                </div>
            </div>
        )}

        {/* Step 4: Result */}
        {step === 4 && importResult && (
            <div className="flex flex-col items-center justify-center py-12 space-y-8 animate-in zoom-in-95 duration-500">
                <div className="relative">
                    <div className="absolute inset-0 bg-green-500/20 blur-xl rounded-full"></div>
                    <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center relative shadow-lg shadow-green-500/40">
                        <Check className="w-10 h-10 text-white" />
                    </div>
                </div>
                
                <div className="text-center">
                    <h2 className="text-3xl font-bold text-white mb-2">Importação Finalizada!</h2>
                    <p className="text-slate-400">O processo foi concluído com o seguinte resumo:</p>
                </div>
                
                <div className="flex gap-4 md:gap-8 text-center flex-wrap justify-center">
                    <div className="p-6 bg-slate-950 border border-slate-800 rounded-xl min-w-[140px] shadow-lg">
                        <div className="text-4xl font-bold text-green-500 mb-2">{importResult.success}</div>
                        <div className="text-sm text-slate-400 font-medium bg-slate-900 py-1 px-3 rounded-full inline-block">Sucessos</div>
                    </div>
                    {/* Only show failures if distinct from 0 or if total > 0 */}
                    <div className="p-6 bg-slate-950 border border-slate-800 rounded-xl min-w-[140px] shadow-lg">
                        <div className={`text-4xl font-bold mb-2 ${importResult.failed > 0 ? 'text-red-500' : 'text-slate-600'}`}>
                            {importResult.failed}
                        </div>
                        <div className="text-sm text-slate-400 font-medium bg-slate-900 py-1 px-3 rounded-full inline-block">Falhas</div>
                    </div>
                </div>

                {importResult.errors.length > 0 && (
                    <div className="w-full max-w-2xl mt-4">
                        <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-red-500" />
                            Detalhes dos Erros ({importResult.errors.length})
                        </h4>
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 max-h-60 overflow-y-auto custom-scrollbar">
                            <ul className="space-y-3">
                                {importResult.errors.map((err, i) => (
                                    <li key={i} className="text-red-300 border-b border-red-500/10 pb-2 last:border-0 last:pb-0 text-sm flex gap-3">
                                        <span className="font-bold bg-red-500/20 px-2 py-0.5 rounded text-xs h-fit whitespace-nowrap">Linha {err.row}</span>
                                        <span>{err.error}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                <div className="flex gap-4 mt-8 pt-8 border-t border-slate-800 w-full justify-center">
                    <button 
                        onClick={() => {
                            setStep(1);
                            setFile(null);
                            setPreviewData(null);
                            setImportResult(null);
                        }}
                        className="px-6 py-2.5 border border-slate-700 hover:border-slate-500 rounded-lg text-sm font-medium hover:bg-slate-800 text-slate-300 transition-all"
                    >
                        Importar Outro Arquivo
                    </button>
                    <button 
                        onClick={() => navigate('/contacts')}
                        className="px-8 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                    >
                        Voltar para Contatos
                    </button>
                </div>
            </div>
        )}

      </div>
    </div>
  );
}
