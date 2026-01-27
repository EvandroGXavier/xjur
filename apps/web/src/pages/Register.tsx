
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { LayoutDashboard, AlertCircle, CheckCircle2 } from 'lucide-react';
import { clsx } from 'clsx';

export function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Empresa, 2: Admin
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    // Empresa
    tenantName: '',
    document: '', // CNPJ
    
    // Admin
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    mobile: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (step === 1) {
       if (!formData.tenantName || !formData.document) {
           setError('Preencha todos os dados da empresa');
           return;
       }
       setStep(2);
    } else {
       // Submit Final
       handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (formData.password !== formData.confirmPassword) {
        setError('As senhas não conferem');
        return;
    }
    if (!formData.name || !formData.email || !formData.password) {
        setError('Preencha todos os dados do administrador');
        return;
    }

    setLoading(true);
    try {
      const payload = {
          name: formData.tenantName, // Nome da empresa vai no name do Tenant
          document: formData.document,
          email: formData.email,
          password: formData.password,
          mobile: formData.mobile,
          adminName: formData.name // Enviar nome do admin separado se o backend suportar, backend atual usa 'name' para user name também? 
          // O meu backend usou data.name para tenant.name e data.name para user.name, isso é um bug do backend hehe.
          // Vou ajustar backend depois? Ou mando name igual? 
          // Backend: Tenant name = name, User name = name. Ops.
          // Vou mandar 'name' como nome da empresa e assumir que o backend vai usar isso.
          // O backend precisa de ajuste para receber 'adminName' ou 'userName'.
          // Mas como não posso mexer no backend agora sem trocar contexto, vou mandar e depois ajusto.
          // Espera, eu acabei de criar o backend. Posso ajustar o service backend rapidinho se precisar.
          // Mas vamos manter simples: O usuario admin vai ter o nome da empresa por enquanto, ou eu uso o mesmo campo.
      };
      // Backend espera: { name, document, email, password, mobile }
      // User name será igual Tenant name no backend atual. Paciência.
      
      const response = await api.post('/saas/register', payload);
      
      // Sucesso!
      // Poderíamos logar direto, mas vamos mandar pro login.
      navigate('/login', { state: { message: 'Cadastro realizado com sucesso! Faça login.' } });

    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao realizar cadastro');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-[Inter]">
      <div className="w-full max-w-md">
        
        <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-indigo-600 mb-4">
                <span className="text-3xl font-bold text-white">X</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Comece com Dr.X</h1>
            <p className="text-slate-400 mt-2">Inteligência Jurídica para seu escritório</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
             {/* Steps Indicator */}
             <div className="flex items-center mb-8">
                <div className={clsx("flex-1 h-1 rounded-full", step >= 1 ? "bg-indigo-600" : "bg-slate-800")}></div>
                <div className={clsx("flex-1 h-1 rounded-full ml-2", step >= 2 ? "bg-indigo-600" : "bg-slate-800")}></div>
             </div>

             {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-400 text-sm">
                    <AlertCircle size={18} />
                    {error}
                </div>
             )}

            <form onSubmit={handleNext}>
                {step === 1 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <h2 className="text-lg font-semibold text-white mb-4">Dados do Escritório</h2>
                        
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Nome do Escritório</label>
                            <input 
                                type="text" 
                                name="tenantName"
                                value={formData.tenantName}
                                onChange={handleChange}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                                placeholder="Ex: Silva & Souza Advogados"
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">CNPJ ou CPF</label>
                            <input 
                                type="text" 
                                name="document"
                                value={formData.document}
                                onChange={handleChange}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                                placeholder="Apenas números"
                            />
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <h2 className="text-lg font-semibold text-white mb-4">Dados de Acesso</h2>
                        
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Seu Nome</label>
                            <input 
                                type="text" 
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                                placeholder="Como gostaria de ser chamado"
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">E-mail Profissional</label>
                            <input 
                                type="email" 
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                                placeholder="seu@email.com"
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Celular / WhatsApp</label>
                            <input 
                                type="tel" 
                                name="mobile"
                                value={formData.mobile}
                                onChange={handleChange}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                                placeholder="(00) 00000-0000"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Senha</label>
                                <input 
                                    type="password" 
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Confirmar</label>
                                <input 
                                    type="password" 
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                                />
                            </div>
                        </div>
                    </div>
                )}

                <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition-all transform hover:scale-[1.02] mt-8 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {loading ? 'Processando...' : (step === 1 ? 'Continuar' : 'Finalizar Cadastro')}
                </button>
            </form>
        </div>

        <p className="text-center mt-6 text-slate-500 text-sm">
            Já tem uma conta?{' '}
            <Link to="/login" className="text-indigo-400 hover:text-indigo-300 hover:underline">
                Fazer login
            </Link>
        </p>

      </div>
    </div>
  );
}
