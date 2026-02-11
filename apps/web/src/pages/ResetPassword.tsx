
import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { AlertCircle, Lock, CheckCircle } from 'lucide-react';

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!token) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
             <div className="text-center text-white">
                 <h1 className="text-xl font-bold mb-2">Link Inválido</h1>
                 <p className="text-slate-400 mb-4">O link de recuperação parece estar incompleto.</p>
                 <Link to="/login" className="text-indigo-400 hover:underline">Ir para Login</Link>
             </div>
        </div>
      );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (password !== confirmPassword) {
        setError('As senhas não coincidem.');
        return;
    }

    if (password.length < 6) {
        setError('A senha deve ter no mínimo 6 caracteres.');
        return;
    }

    setLoading(true);

    try {
      await api.post('/auth/reset-password', { token, password });
      setSuccess(true);
      setTimeout(() => navigate('/login', { state: { message: 'Senha alterada com sucesso!' } }), 3000);
    } catch (err: any) {
      const message = err.response?.data?.message;
      if (Array.isArray(message)) {
          setError(message.join(', '));
      } else {
          setError(message || 'Erro ao redefinir senha. O link pode ter expirado.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-[Inter]">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl text-center">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="text-emerald-500" size={32} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Senha Alterada!</h2>
              <p className="text-slate-400 mb-4">
                  Sua senha foi atualizada com sucesso. Redirecionando para o login...
              </p>
          </div>
      </div>
    );
}

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-[Inter]">
      <div className="max-w-md w-full">
        
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600/20 text-indigo-500 mb-4">
                    <Lock size={24} />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Nova Senha</h1>
                <p className="text-slate-400 text-sm">Crie uma nova senha segura para sua conta.</p>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg p-3 mb-6 flex items-center gap-3 text-sm">
                    <AlertCircle size={18} />
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Nova Senha
                    </label>
                    <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                    placeholder="••••••••"
                    required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Confirmar Senha
                    </label>
                    <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                    placeholder="••••••••"
                    required
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg py-3 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
                >
                    {loading ? 'Salvando...' : 'Redefinir Senha'}
                </button>
            </form>
        </div>
      </div>
    </div>
  );
}
