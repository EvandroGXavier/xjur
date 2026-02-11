
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { AlertCircle, ArrowLeft, Mail, CheckCircle } from 'lucide-react';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post('/auth/forgot-password', { email });
      setSuccess(true);
    } catch (err: any) {
      const message = err.response?.data?.message;
      if (Array.isArray(message)) {
          setError(message.join(', '));
      } else {
          setError(message || 'Erro ao solicitar recuperação.');
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
                <h2 className="text-2xl font-bold text-white mb-2">Verifique seu E-mail</h2>
                <p className="text-slate-400 mb-8">
                    Se o e-mail <strong>{email}</strong> estiver cadastrado, enviamos um link para redefinir sua senha.
                </p>
                <Link to="/login" className="text-indigo-400 font-medium hover:text-indigo-300 transition-colors">
                    Voltar para Login
                </Link>
            </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-[Inter]">
      <div className="max-w-md w-full">
        
        <div className="mb-6">
             <Link to="/login" className="text-slate-400 hover:text-white flex items-center gap-2 transition-colors text-sm">
                <ArrowLeft size={16} />
                Voltar para Login
             </Link>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600/20 text-indigo-500 mb-4">
                    <Mail size={24} />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Recuperar Senha</h1>
                <p className="text-slate-400 text-sm">Digite seu e-mail para receber o link de redefinição.</p>
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
                    E-mail Cadastrado
                    </label>
                    <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                    placeholder="seu@email.com"
                    required
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg py-3 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
                >
                    {loading ? 'Enviando...' : 'Enviar Link de Recuperação'}
                </button>
            </form>
        </div>
      </div>
    </div>
  );
}
