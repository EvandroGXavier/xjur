import { useState, useEffect } from 'react';
import { Lock, ShieldAlert, X, ShieldCheck, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { toast } from 'sonner';
import { useSigilo } from '../contexts/SigiloContext';

export function SigiloAuthModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { activateSigilo } = useSigilo();

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-sigilo-auth', handleOpen);
    return () => window.removeEventListener('open-sigilo-auth', handleOpen);
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    try {
      await api.post('/security/re-auth', { password });
      activateSigilo(5); // Ativa por 5 minutos
      setIsOpen(false);
      setPassword('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Senha incorreta ou acesso negado.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-red-500/30 w-full max-w-md rounded-2xl shadow-2xl shadow-red-500/10 overflow-hidden">
        <div className="bg-gradient-to-r from-red-950/50 to-slate-900 p-6 border-b border-red-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-lg text-red-500">
              <ShieldAlert size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">ACESSO SIGILOSO</h2>
              <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest">Confirmação de Identidade</p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleAuth} className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto w-16 h-16 bg-slate-950 rounded-full border border-slate-800 flex items-center justify-center text-red-500 shadow-inner">
               <Lock size={28} />
            </div>
            <p className="text-sm text-slate-400">
              Para visualizar ou editar informações sigilosas, insira sua senha de administrador abaixo.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Senha de Acesso</label>
            <input
              autoFocus
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 outline-none transition-all placeholder:text-slate-700"
              placeholder="••••••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 transition-all transform active:scale-[0.98]"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                <ShieldCheck size={20} />
                DESBLOQUEAR SIGILO
              </>
            )}
          </button>

          <p className="text-[10px] text-center text-slate-600 uppercase tracking-tighter">
            ESTE ACESSO SERÁ REGISTRADO E EXPIRA EM 5 MINUTOS.
          </p>
        </form>
      </div>
    </div>
  );
}
