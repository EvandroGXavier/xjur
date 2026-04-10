import { MessageCircleMore, RadioTower, Settings2 } from 'lucide-react';
import { Connections } from './components/Connections';

export function AtendimentoConnectionsPage() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/10 bg-slate-950 text-white">
      <div className="border-b border-white/10 px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-300/70">Central de canais</p>
            <h2 className="mt-2 text-2xl font-semibold">Conexoes do Atendimento</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Configure e acompanhe WhatsApp, Telegram, e-mail e outros conectores fora da fila operacional.
              A tela principal de atendimento fica focada em triagem, conversa e vinculo com processo.
            </p>
          </div>

          <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="flex items-center gap-2 font-medium text-white">
                <RadioTower size={16} className="text-emerald-300" />
                Conectores
              </div>
              <p className="mt-2 text-xs text-slate-400">Instancias, bots e autenticação dos canais.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="flex items-center gap-2 font-medium text-white">
                <Settings2 size={16} className="text-emerald-300" />
                Governanca
              </div>
              <p className="mt-2 text-xs text-slate-400">Mantenha setup técnico fora do console de atendimento.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="flex items-center gap-2 font-medium text-white">
                <MessageCircleMore size={16} className="text-emerald-300" />
                Operacao limpa
              </div>
              <p className="mt-2 text-xs text-slate-400">Fila, conversa e Kanban ficam livres de ruído técnico.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <Connections />
      </div>
    </div>
  );
}
