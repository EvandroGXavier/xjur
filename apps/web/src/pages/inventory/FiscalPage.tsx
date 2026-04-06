import { useEffect, useState } from 'react';
import {
  UploadCloud,
  FileText,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../../services/api';
import { toast } from 'sonner';

export function FiscalPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({
    razaoSocialEmitente: '',
    nomeFantasiaEmitente: '',
    cnpjEmitente: '',
    ieEmitente: '',
    imEmitente: '',
    crt: '',
    regimeTributario: '',
    serieNfe: 1,
    serieNfse: 1,
    webserviceUf: 'MG',
    codigoMunicipioIbge: '3106200',
    provedorNfse: 'BH',
    environment: 'HOMOLOGATION',
    certificateStorageProvider: 'SECURITY',
    certificateFileUrl: '',
    certificateSerialNumber: '',
    certificatePassword: '',
  });

  useEffect(() => {
    loadFiscalData();
  }, []);

  const loadFiscalData = async () => {
    try {
      const [configRes, invoicesRes] = await Promise.all([
        api.get('/fiscal/config'),
        api.get('/fiscal/invoices'),
      ]);
      setConfig((prev: any) => ({
        ...prev,
        ...configRes.data,
        certificatePassword: '',
      }));
      setInvoices(invoicesRes.data || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao carregar modulo fiscal');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await api.post('/fiscal/import-xml', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(response.data.message || 'XML importado com sucesso');
      setFile(null);
      loadFiscalData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao importar XML');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      await api.put('/fiscal/config', config);
      toast.success('Configuracao fiscal salva com sucesso');
      loadFiscalData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao salvar configuracao fiscal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Modulo Fiscal</h1>
          <p className="text-sm text-slate-500">
            Configure o emitente, acompanhe documentos fiscais e importe XML de entrada.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 border-b border-slate-100 pb-2 text-lg font-semibold">
              Configuracao do Emitente
            </h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Razao social"
                value={config.razaoSocialEmitente || ''}
                onChange={(e) =>
                  setConfig((prev: any) => ({
                    ...prev,
                    razaoSocialEmitente: e.target.value,
                  }))
                }
              />
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Nome fantasia"
                value={config.nomeFantasiaEmitente || ''}
                onChange={(e) =>
                  setConfig((prev: any) => ({
                    ...prev,
                    nomeFantasiaEmitente: e.target.value,
                  }))
                }
              />
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="CNPJ do emitente"
                value={config.cnpjEmitente || ''}
                onChange={(e) =>
                  setConfig((prev: any) => ({
                    ...prev,
                    cnpjEmitente: e.target.value,
                  }))
                }
              />
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="IE do emitente"
                value={config.ieEmitente || ''}
                onChange={(e) =>
                  setConfig((prev: any) => ({
                    ...prev,
                    ieEmitente: e.target.value,
                  }))
                }
              />
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="IM do emitente"
                value={config.imEmitente || ''}
                onChange={(e) =>
                  setConfig((prev: any) => ({
                    ...prev,
                    imEmitente: e.target.value,
                  }))
                }
              />
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="CRT"
                value={config.crt || ''}
                onChange={(e) =>
                  setConfig((prev: any) => ({
                    ...prev,
                    crt: e.target.value,
                  }))
                }
              />
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Regime tributario"
                value={config.regimeTributario || ''}
                onChange={(e) =>
                  setConfig((prev: any) => ({
                    ...prev,
                    regimeTributario: e.target.value,
                  }))
                }
              />
              <select
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={config.environment || 'HOMOLOGATION'}
                onChange={(e) =>
                  setConfig((prev: any) => ({
                    ...prev,
                    environment: e.target.value,
                  }))
                }
              >
                <option value="HOMOLOGATION">Homologacao</option>
                <option value="PRODUCTION">Producao</option>
              </select>
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Serie NF-e"
                value={config.serieNfe || 1}
                onChange={(e) =>
                  setConfig((prev: any) => ({
                    ...prev,
                    serieNfe: e.target.value,
                  }))
                }
              />
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Serie NFS-e"
                value={config.serieNfse || 1}
                onChange={(e) =>
                  setConfig((prev: any) => ({
                    ...prev,
                    serieNfse: e.target.value,
                  }))
                }
              />
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="UF webservice NF-e"
                value={config.webserviceUf || ''}
                onChange={(e) =>
                  setConfig((prev: any) => ({
                    ...prev,
                    webserviceUf: e.target.value,
                  }))
                }
              />
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Codigo municipio IBGE"
                value={config.codigoMunicipioIbge || ''}
                onChange={(e) =>
                  setConfig((prev: any) => ({
                    ...prev,
                    codigoMunicipioIbge: e.target.value,
                  }))
                }
              />
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Provedor NFS-e"
                value={config.provedorNfse || ''}
                onChange={(e) =>
                  setConfig((prev: any) => ({
                    ...prev,
                    provedorNfse: e.target.value,
                  }))
                }
              />
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Arquivo/local do certificado"
                value={config.certificateFileUrl || ''}
                onChange={(e) =>
                  setConfig((prev: any) => ({
                    ...prev,
                    certificateFileUrl: e.target.value,
                  }))
                }
              />
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Serial do certificado"
                value={config.certificateSerialNumber || ''}
                onChange={(e) =>
                  setConfig((prev: any) => ({
                    ...prev,
                    certificateSerialNumber: e.target.value,
                  }))
                }
              />
              <input
                type="password"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Senha do certificado"
                value={config.certificatePassword || ''}
                onChange={(e) =>
                  setConfig((prev: any) => ({
                    ...prev,
                    certificatePassword: e.target.value,
                  }))
                }
              />
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={handleSaveConfig}
                disabled={saving}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar configuracao fiscal'}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 border-b border-slate-100 pb-2 text-lg font-semibold">
              Entrada de NF-e (XML)
            </h2>
            <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center transition-colors hover:bg-slate-100">
              <UploadCloud className="mx-auto mb-3 h-12 w-12 text-slate-400" />
              <p className="mb-4 text-sm text-slate-600">
                Arraste seu XML ou selecione o arquivo para importar entrada fiscal.
              </p>
              <input
                type="file"
                accept=".xml"
                className="hidden"
                id="xml-upload"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <label
                htmlFor="xml-upload"
                className="cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Selecionar XML
              </label>
            </div>
            {file && (
              <div className="mt-4 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-3">
                  <FileText className="text-indigo-600" size={20} />
                  <span className="max-w-[220px] truncate text-sm font-medium text-slate-700">
                    {file.name}
                  </span>
                </div>
                <button
                  onClick={handleUpload}
                  disabled={loading}
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? 'Processando...' : 'Importar'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-2">
              <ShieldCheck className="text-emerald-600" size={20} />
              <h2 className="text-lg font-semibold">Status fiscal atual</h2>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <div className="mb-1 flex items-start gap-2">
                <AlertTriangle className="mt-0.5" size={18} />
                <span className="font-medium">
                  A transmissao automatica para SEFAZ e prefeitura ainda depende da proxima etapa de integracao dos gateways.
                </span>
              </div>
              <p className="pl-7 text-xs text-amber-700">
                O sistema ja registra configuracao, prontidao e documentos fiscais preparados para emissao.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 border-b border-slate-100 pb-2 text-lg font-semibold">
              Documentos fiscais registrados
            </h2>

            <div className="space-y-3">
              {invoices.length === 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  Nenhum documento fiscal registrado ainda.
                </div>
              )}

              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {invoice.documentModel} • {invoice.scope}
                      </div>
                      <div className="text-xs text-slate-500">
                        {invoice.contact?.name || 'Sem contato'} • Proposta #{String(invoice.proposal?.code || '').padStart(6, '0')}
                      </div>
                    </div>
                    <div className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700">
                      {invoice.status}
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-slate-500">
                    Serie: {invoice.series || '-'} • Numero: {invoice.number || '-'} • Ambiente: {invoice.environment || '-'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
