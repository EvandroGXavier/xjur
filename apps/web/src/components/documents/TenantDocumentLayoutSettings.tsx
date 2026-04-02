import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Save, RotateCcw } from 'lucide-react';
import { api } from '../../services/api';
import { RichTextEditor } from '../ui/RichTextEditor';

export function TenantDocumentLayoutSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [headerHtml, setHeaderHtml] = useState('');
  const [footerHtml, setFooterHtml] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get('/documents/tenant-settings', { signal: controller.signal as any });
        setHeaderHtml(String(res.data?.headerHtml || ''));
        setFooterHtml(String(res.data?.footerHtml || ''));
      } catch (err) {
        console.error(err);
        toast.error('Erro ao carregar cabeçalho/rodapé');
      } finally {
        setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/documents/tenant-settings', { headerHtml, footerHtml });
      toast.success('Cabeçalho/Rodapé salvos');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar cabeçalho/rodapé');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!confirm('Limpar cabeçalho e rodapé?')) return;
    setHeaderHtml('');
    setFooterHtml('');
  };

  return (
    <div className="mt-8 pt-6 border-t border-slate-800">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-md font-semibold text-white">Cabeçalho e Rodapé das Peças</h4>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">
            Esse conteúdo é inserido automaticamente em <b>todas as peças</b> geradas a partir de modelos (do sistema ou
            do escritório). Você pode usar variáveis como <code>{'{{tenant.name}}'}</code>, <code>{'{{process.cnj}}'}</code>,{' '}
            <code>{'{{contact.name}}'}</code> e <code>{'{{today.fullDate}}'}</code>.
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Dica: mantenha o cabeçalho enxuto (identificação + dados essenciais) e o rodapé com contato/endereço/assinatura.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 transition disabled:opacity-60"
            disabled={loading || saving}
            title="Limpar cabeçalho e rodapé"
          >
            <RotateCcw size={16} /> Limpar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition disabled:opacity-60"
            disabled={loading || saving}
            title="Salvar cabeçalho e rodapé"
          >
            <Save size={16} /> {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-slate-500 mt-4">Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
               <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
               <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Cabeçalho (Topo)</h3>
            </div>
            <RichTextEditor value={headerHtml} onChange={setHeaderHtml} showVariables={true} minHeight={320} placeholder="Monte aqui o cabeçalho padrão do escritório." />
          </div>
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
               <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
               <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Rodapé (Final)</h3>
            </div>
            <RichTextEditor value={footerHtml} onChange={setFooterHtml} showVariables={true} minHeight={320} placeholder="Monte aqui o rodapé padrão do escritório." />
          </div>
        </div>
      )}

      <div className="mt-4 bg-slate-950/60 border border-slate-800 rounded-xl p-4">
        <div className="text-xs font-bold text-slate-300 mb-2">Exemplo pronto (copiar)</div>
        <pre className="text-xs text-slate-300 whitespace-pre-wrap">
{`Cabeçalho:
<p><strong>{{tenant.name}}</strong> — CNPJ/CPF {{tenant.document}}</p>
<p>Processo: {{process.cnj}} — Vara {{process.vars}} — {{process.district}}/{{process.uf}}</p>

Rodapé:
<p>Cliente: {{contact.name}} — CPF/CNPJ {{contact.document}}</p>
<p>Data: {{today.fullDate}}</p>`}
        </pre>
      </div>
    </div>
  );
}
