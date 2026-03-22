import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileArchive,
  RefreshCw,
  Server,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../services/api';

type BackupStatus = {
  database: {
    host: string;
    port: string;
    database: string;
    username: string;
    sslmode: string;
  };
  tools: {
    pgDump: { available: boolean; version: string | null };
    pgRestore: { available: boolean; version: string | null };
    psql: { available: boolean; version: string | null };
  };
  backups: BackupFile[];
  restoreConfirmationKeyword: string;
  recommendations: string[];
};

type BackupFile = {
  fileName: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  extension: string;
};

const toolCardClass =
  'rounded-xl border border-slate-800 bg-slate-950/80 p-4';

export function BackupTab() {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [createLabel, setCreateLabel] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const backups = status?.backups || [];
  const toolsReady = Boolean(
    status?.tools.pgDump.available &&
      status?.tools.pgRestore.available &&
      status?.tools.psql.available,
  );

  const environmentSummary = useMemo(() => {
    if (!status) return null;
    return `${status.database.database} @ ${status.database.host}:${status.database.port}`;
  }, [status]);

  useEffect(() => {
    void loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const response = await api.get('/backup/status');
      setStatus(response.data);
    } catch (error: any) {
      console.error(error);
      toast.error(
        error?.response?.data?.message || 'Nao foi possivel carregar a area de backup',
      );
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const handleCreateBackup = async () => {
    try {
      setBusyAction('create');
      const response = await api.post('/backup/create', {
        label: createLabel.trim() || undefined,
      });
      toast.success(response.data?.message || 'Backup criado com sucesso');
      setCreateLabel('');
      await loadStatus();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Erro ao criar backup');
    } finally {
      setBusyAction(null);
    }
  };

  const handleUploadBackup = async () => {
    if (!selectedFile) {
      toast.warning('Selecione um arquivo .backup, .dump ou .sql');
      return;
    }

    try {
      setBusyAction('upload');
      const formData = new FormData();
      formData.append('file', selectedFile);
      const response = await api.post('/backup/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(response.data?.message || 'Backup enviado com sucesso');
      setSelectedFile(null);
      await loadStatus();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Erro ao enviar backup');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDownloadBackup = async (backup: BackupFile) => {
    try {
      setBusyAction(`download:${backup.fileName}`);
      const response = await api.get(`/backup/download/${encodeURIComponent(backup.fileName)}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = backup.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Erro ao baixar backup');
    } finally {
      setBusyAction(null);
    }
  };

  const handleRestoreBackup = async (backup: BackupFile) => {
    const confirmation = window.prompt(
      `Digite ${status?.restoreConfirmationKeyword || 'RESTAURAR'} para restaurar ${backup.fileName} na base atual.`,
      '',
    );

    if (!confirmation) return;

    try {
      setBusyAction(`restore:${backup.fileName}`);
      const response = await api.post(`/backup/restore/${encodeURIComponent(backup.fileName)}`, {
        confirmation,
      });
      toast.success(response.data?.message || 'Restauracao concluida');
      await loadStatus();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Erro ao restaurar backup');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeleteBackup = async (backup: BackupFile) => {
    if (!window.confirm(`Excluir o arquivo ${backup.fileName}?`)) return;

    try {
      setBusyAction(`delete:${backup.fileName}`);
      const response = await api.delete(`/backup/${encodeURIComponent(backup.fileName)}`);
      toast.success(response.data?.message || 'Backup removido');
      await loadStatus();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Erro ao excluir backup');
    } finally {
      setBusyAction(null);
    }
  };

  if (loading && !status) {
    return <div className="text-slate-400">Carregando painel de backup...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Database size={20} className="text-indigo-400" />
              BACKUP & RESTAURAÇÃO
            </h3>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Gere backups completos do PostgreSQL, baixe o arquivo para transporte seguro e restaure em outra instância quando necessário.
            </p>
          </div>
          <button
            onClick={loadStatus}
            disabled={loading || !!busyAction}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-indigo-400 hover:text-white disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Atualizar Status
          </button>
        </div>

        {/* PROGRESS BAR */}
        {busyAction && (
          <div className="mt-6 space-y-2 animate-in fade-in transition-all duration-500">
            <div className="flex justify-between text-xs font-semibold uppercase tracking-wider">
              <span className="text-indigo-400 flex items-center gap-2">
                <RefreshCw size={12} className="animate-spin" />
                {busyAction.startsWith('restore') ? 'Restaurando Base de Dados...' : 
                 busyAction.startsWith('create') ? 'Gerando Backup Completo...' :
                 busyAction.startsWith('upload') ? 'Enviando Arquivo...' : 'Processando...'}
              </span>
              <span className="text-slate-500">Isso pode levar alguns minutos</span>
            </div>
            <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div 
                className="h-full bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 animate-progress-stripes transition-all duration-[2000ms] ease-out"
                style={{ width: '92%' }}
              ></div>
            </div>
            <p className="text-[10px] text-slate-500 italic">
              Não feche esta tela até a conclusão do processo.
            </p>
          </div>
        )}

        <div className="mt-6 grid gap-4 lg:grid-cols-4">
          <div className={toolCardClass}>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Base Atual</p>
            <p className="mt-3 text-sm font-medium text-white">{environmentSummary}</p>
            <p className="mt-2 text-xs text-slate-400">
              Usuario {status?.database.username} | SSL {status?.database.sslmode}
            </p>
          </div>

          {[
            ['pg_dump', status?.tools.pgDump],
            ['pg_restore', status?.tools.pgRestore],
            ['psql', status?.tools.psql],
          ].map(([label, tool]) => (
            <div key={label} className={toolCardClass}>
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
                {tool?.available ? (
                  <CheckCircle2 size={16} className="text-emerald-400" />
                ) : (
                  <AlertTriangle size={16} className="text-amber-400" />
                )}
              </div>
              <p className="mt-3 text-sm font-medium text-white">
                {tool?.available ? 'Disponivel' : 'Indisponivel'}
              </p>
              <p className="mt-2 text-xs text-slate-400">{tool?.version || 'Nao localizado no servidor'}</p>
            </div>
          ))}
        </div>

        {!toolsReady && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            O servidor precisa ter `pg_dump`, `pg_restore` e `psql` disponiveis no PATH ou nas variaveis `PG_BIN_PATH`, `PG_DUMP_PATH`, `PG_RESTORE_PATH` e `PSQL_PATH`.
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center gap-2 text-white">
            <FileArchive size={18} className="text-indigo-400" />
            <h4 className="font-semibold">Criar Backup</h4>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Gera um arquivo completo em formato custom (`.backup`) no servidor atual.
          </p>
          <div className="mt-5 flex flex-col gap-3 md:flex-row">
            <input
              type="text"
              value={createLabel}
              onChange={(event) => setCreateLabel(event.target.value)}
              placeholder="Ex: producao-antes-da-migracao"
              className="flex-1 rounded-lg border border-slate-800 bg-slate-950 px-4 py-2 text-white outline-none focus:border-indigo-500"
            />
            <button
              onClick={handleCreateBackup}
              disabled={!!busyAction || !status?.tools.pgDump.available}
              className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busyAction === 'create' ? 'Gerando...' : 'Criar Backup Completo'}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center gap-2 text-white">
            <Upload size={18} className="text-indigo-400" />
            <h4 className="font-semibold">Subir Backup Externo</h4>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Use este bloco para enviar um backup vindo da VPS de producao e depois restaurar na base de teste.
          </p>
          <div className="mt-5 space-y-3">
            <input
              type="file"
              accept=".backup,.dump,.sql"
              onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
              className="block w-full rounded-lg border border-dashed border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-slate-200"
            />
            {selectedFile && (
              <div className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300">
                {selectedFile.name} ({formatSize(selectedFile.size)})
              </div>
            )}
            <button
              onClick={handleUploadBackup}
              disabled={!!busyAction || !selectedFile}
              className="w-full rounded-lg bg-slate-100 px-4 py-2 font-medium text-slate-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busyAction === 'upload' ? 'Enviando...' : 'Enviar Para a Biblioteca de Backups'}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex items-center gap-2 text-white">
          <Server size={18} className="text-indigo-400" />
            <h4 className="font-semibold">Fluxo Recomendado Produção para Teste</h4>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {status?.recommendations.map((item) => (
            <div
              key={item}
              className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-300"
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h4 className="font-semibold text-white">Biblioteca de Backups</h4>
            <p className="mt-1 text-sm text-slate-400">
              Os arquivos abaixo podem ser baixados, restaurados ou removidos do servidor.
            </p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-300">
            {backups.length} arquivo(s)
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {backups.length === 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-6 text-center text-slate-400">
              Nenhum backup disponivel ainda.
            </div>
          )}

          {backups.map((backup) => (
            <div
              key={backup.fileName}
              className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-950/80 p-4 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-white">{backup.fileName}</p>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-400">
                  <span>{formatSize(backup.size)}</span>
                  <span>{backup.extension}</span>
                  <span>{new Date(backup.updatedAt).toLocaleString('pt-BR')}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleDownloadBackup(backup)}
                  disabled={!!busyAction}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-indigo-400 hover:text-white disabled:opacity-50"
                >
                  <Download size={14} />
                  {busyAction === `download:${backup.fileName}` ? 'Baixando...' : 'Baixar'}
                </button>
                <button
                  onClick={() => handleRestoreBackup(backup)}
                  disabled={!!busyAction || !status?.tools.pgRestore.available}
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-100 transition hover:bg-amber-500/20 disabled:opacity-50"
                >
                  <RefreshCw size={14} />
                  {busyAction === `restore:${backup.fileName}` ? 'Restaurando...' : 'Restaurar'}
                </button>
                <button
                  onClick={() => handleDeleteBackup(backup)}
                  disabled={!!busyAction}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  {busyAction === `delete:${backup.fileName}` ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
