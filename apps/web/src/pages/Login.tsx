import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Bot, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';
import {
  getDeviceToken,
  setDeviceToken,
  setToken,
  setUser,
  type AuthPersistence,
} from '../auth/authStorage';

function guessDeviceName() {
  const ua = navigator.userAgent || '';

  const isWindows = /Windows/i.test(ua);
  const isMac = /Macintosh|Mac OS X/i.test(ua);
  const isLinux = /Linux/i.test(ua) && !/Android/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);

  const os = isWindows
    ? 'Windows'
    : isMac
      ? 'macOS'
      : isLinux
        ? 'Linux'
        : isAndroid
          ? 'Android'
          : isIOS
            ? 'iOS'
            : 'Dispositivo';

  const browser = /Edg/i.test(ua)
    ? 'Edge'
    : /Chrome/i.test(ua) && !/Edg/i.test(ua)
      ? 'Chrome'
      : /Firefox/i.test(ua)
        ? 'Firefox'
        : /Safari/i.test(ua) && !/Chrome/i.test(ua)
          ? 'Safari'
          : 'Navegador';

  return `${os} - ${browser}`;
}

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const suggestedDeviceName = useMemo(() => guessDeviceName(), []);

  useEffect(() => {
    if (location.state?.message) {
      setMessage(location.state.message);
    }
  }, [location]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await api.post('/auth/login', {
        email,
        password,
        trustDevice,
        deviceName: suggestedDeviceName,
        deviceToken: getDeviceToken() || undefined,
      });

      const { access_token, user, deviceToken, isTrustedDevice } = response.data || {};

      if (!access_token) {
        throw new Error('Token não recebido');
      }

      if (deviceToken) {
        setDeviceToken(deviceToken);
      }

      const persistence: AuthPersistence = isTrustedDevice ? 'persistent' : 'session';
      setToken(access_token, persistence);
      setUser(user, persistence);

      navigate('/');
    } catch (err: any) {
      const apiMessage = err.response?.data?.message;
      if (Array.isArray(apiMessage)) {
        setError(apiMessage.join(', '));
      } else {
        setError(apiMessage || 'Credenciais inválidas. Tente novamente.');
      }
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

          {message && (
            <div className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-200 rounded-lg p-3 mb-6 flex items-center gap-3 text-sm">
              <Bot size={18} className="text-indigo-300" />
              {message}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">E-mail</label>
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
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors pr-12"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-400 transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              <div className="flex items-center justify-between mt-3 gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-300 select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={trustDevice}
                    onChange={(e) => setTrustDevice(e.target.checked)}
                    className="accent-indigo-600"
                  />
                  <span className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-indigo-300" />
                    Confiar neste computador
                  </span>
                </label>

                <Link
                  to="/forgot-password"
                  className="text-sm text-indigo-400 hover:text-indigo-300 hover:underline transition-colors"
                >
                  Esqueci minha senha
                </Link>
              </div>

              <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                Em dispositivos não confiáveis, o acesso é temporário e recursos sensíveis (ex: downloads/arquivos) ficam
                bloqueados.
              </p>
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
            <Link
              to="/register"
              className="text-indigo-400 hover:text-indigo-300 text-sm font-medium hover:underline transition-colors"
            >
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

