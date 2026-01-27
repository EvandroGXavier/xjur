import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/login', { email, password });
      // Assumindo que a API retorna o objeto do usuário. 
      // Se retornar token separado, ajustar aqui.
      // O backend atual retorna o objeto user. Onde está o token?
      // Analisando AuthController: retorna user. 
      // Analisando AuthService: retorna { ...result } (user sem senha).
      // ESPERA! O backend atual NÃO GERA TOKEN JWT ainda, apenas valida senha.
      // Para este primeiro passo, vamos salvar um "flag" ou o próprio user simulando sessão.
      // Mas o ideal seria JWT. O usuário pediu para "verificar se está autenticando".
      // Vou salvar o que vier no localStorage como 'user' e usar isso como flag.
      
      localStorage.setItem('user', JSON.stringify(response.data));
      // Se não tiver token real, usamos um dummy para passar no interceptor ou ajustamos a logica.
      // Por enquanto, salvamos 'token' como 'logged' ou algo assim se não houver JWT.
      // Mas o interceptor busca 'token'.
      // Vamos assumir que por enquanto a autenticação é simples (sessão client-side) até termos JWT no back.
      localStorage.setItem('token', 'dummy-token'); 
      
      navigate('/');
    } catch (err) {
      setError('Credenciais inválidas. Tente novamente.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-xl p-8 border border-gray-700">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Dr.X</h1>
          <p className="text-gray-400">Entre para acessar o sistema</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 rounded p-3 mb-6 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-colors"
              placeholder="seu@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-colors"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
