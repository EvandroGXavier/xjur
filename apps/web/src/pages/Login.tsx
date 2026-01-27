import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { api } from '../services/api';
import { Bot, AlertCircle } from 'lucide-react';

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check for success message from redirect
    if (location.state?.message) {
        setSuccess(location.state.message);
    }
  }, [location]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.post('/auth/login', { email, password });
      
      const { access_token, user } = response.data;

      if (!access_token) {
          throw new Error("Token não recebido");
      }

      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(user));
      
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Credenciais inválidas. Tente novamente.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-[Inter]">
      <div className="max-w-md w-full">
        
        <div className="text-center mb-8">
           <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-indigo-600 mb-4 transition-transform hover:scale-110">
                <span className="text-3xl font-bold text-white">X</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Dr.X</h1>
            <p className="text-slate-400">Entre para acessar seu ambiente jurídico</p>
        </div>

        <div className="bg-slate-900 rounded-2xl shadow-2xl p-8 border border-slate-800">
            {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg p-3 mb-6 flex items-center gap-3 text-sm">
                <AlertCircle size={18} />
                {error}
            </div>
            )}
            
            {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-lg p-3 mb-6 flex items-center gap-3 text-sm">
                <Bot size={18} />
                {success}
            </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
            <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                E-mail
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

            <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Senha
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

            <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg py-3 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
            >
                {loading ? 'Entrando...' : 'Entrar na Plataforma'}
            </button>
            </form>
            
            <div className="mt-6 pt-6 border-t border-slate-800 text-center">
                 <p className="text-slate-500 text-sm mb-4">Ainda não tem uma conta?</p>
                 <Link to="/register" className="text-indigo-400 hover:text-indigo-300 text-sm font-medium hover:underline transition-colors">
                     Cadastrar Escritório
                 </Link>
            </div>
        </div>
        
        <p className="text-center text-slate-600 text-xs mt-8">
            &copy; 2024 Dr.X Inteligência Jurídica. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
