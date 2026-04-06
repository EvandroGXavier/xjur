import { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, Plus, Trash2, Shield, Save, Link as LinkIcon, Key, Info } from 'lucide-react';
import { api } from '../../services/api';
import { toast } from 'sonner';

interface SecurityTabProps {
  entityType: 'BANK_ACCOUNT' | 'CONTACT' | 'PROCESS' | 'USER' | 'GENERAL';
  entityId: string;
}

interface Secret {
  id: string;
  description: string;
  username?: string;
  password?: string;
  link?: string;
  privateKey?: string;
  publicKey?: string;
  details?: string;
  expiresAt?: string;
  fileUrl?: string;
}

export function SecurityTab({ entityType, entityId }: SecurityTabProps) {
  const [observation, setObservation] = useState('');
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [, setLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  
  // New secret form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [newSecret, setNewSecret] = useState<Partial<Secret>>({
    description: '',
    username: '',
    password: '',
    link: '',
    privateKey: '',
    publicKey: '',
    details: '',
    expiresAt: '',
    fileUrl: ''
  });

  useEffect(() => {
    fetchData();
  }, [entityId, entityType]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [settingRes, secretsRes] = await Promise.all([
        api.get(`/security/setting?entityType=${entityType}&entityId=${entityId}`),
        api.get(`/security/secrets?entityType=${entityType}&entityId=${entityId}`)
      ]);
      setObservation(settingRes.data.observation || '');
      setSecrets(secretsRes.data);
    } catch (e) {
      toast.error('Erro ao carregar dados de segurança');
    } finally {
      setLoading(false);
    }
  };

  const getExpiryStatus = (date?: string) => {
    if (!date) return null;
    const expiry = new Date(date);
    const now = new Date();
    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { label: 'VENCIDO', color: 'text-red-500 bg-red-500/10 border-red-500/20' };
    if (diffDays <= 30) return { label: `VENCE EM ${diffDays} DIAS`, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' };
    return { label: 'VÁLIDO', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' };
  };

  const handleSaveObservation = async () => {
    try {
      await api.post('/security/setting', {
        entityType,
        entityId,
        observation
      });
      toast.success('Observação salva com sucesso');
    } catch (e) {
      toast.error('Erro ao salvar observação');
    }
  };

  const handleCreateSecret = async () => {
    if (!newSecret.description) {
      toast.error('Descrição é obrigatória');
      return;
    }
    try {
      const res = await api.post('/security/secrets', {
        ...newSecret,
        entityType,
        entityId
      });
      
      const createdSecretId = res.data.id;
      
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        await api.post(`/security/secrets/${createdSecretId}/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      toast.success('Segredo adicionado com sucesso');
      setShowAddForm(false);
      setNewSecret({ description: '', username: '', password: '', link: '', privateKey: '', publicKey: '', details: '', expiresAt: '', fileUrl: '' });
      setSelectedFile(null);
      fetchData();
    } catch (e) {
      toast.error('Erro ao criar segredo');
    }
  };

  const handleFileUpload = async (id: string, file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post(`/security/secrets/${id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Arquivo enviado com sucesso');
      fetchData();
    } catch (e) {
      toast.error('Erro ao enviar arquivo');
    }
  };

  const handleDownload = async (id: string, fileName: string) => {
    try {
      const response = await api.get(`/security/secrets/${id}/download`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName.split('-').slice(2).join('-') || 'arquivo');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      toast.error('Erro ao baixar arquivo');
    }
  };

  const handleDeleteSecret = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este segredo?')) return;
    try {
      await api.delete(`/security/secrets/${id}`);
      toast.success('Segredo removido');
      fetchData();
    } catch (e) {
      toast.error('Erro ao remover segredo');
    }
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="p-6 space-y-8 animate-in fade-in duration-500">
      {/* Observation Section */}
      <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Info size={18} className="text-indigo-400" /> Observação Geral
          </h3>
          <button 
            onClick={handleSaveObservation}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
          >
            <Save size={16} /> Salvar Notas
          </button>
        </div>
        <textarea
          value={observation}
          onChange={(e) => setObservation(e.target.value)}
          placeholder="Insira notas importantes, diretrizes de segurança ou avisos para este item..."
          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-4 text-slate-300 min-h-[100px] focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
        />
      </div>

      {/* Secrets Grid Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Lock size={18} className="text-yellow-500" /> Cofre de Credenciais
          </h3>
          <button 
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
          >
            <Plus size={16} /> Novo Registro
          </button>
        </div>

        {showAddForm && (
          <div className="bg-slate-800/80 p-6 rounded-xl border border-emerald-500/20 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
            <input 
              placeholder="Descrição (ex: Login do Banco)"
              className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white"
              value={newSecret.description}
              onChange={e => setNewSecret({...newSecret, description: e.target.value})}
            />
            <input 
              placeholder="Usuário"
              className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white"
              value={newSecret.username}
              onChange={e => setNewSecret({...newSecret, username: e.target.value})}
            />
            <input 
              type="password"
              placeholder="Senha"
              className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white"
              value={newSecret.password}
              onChange={e => setNewSecret({...newSecret, password: e.target.value})}
            />
            <input 
              placeholder="Link de Acesso"
              className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white"
              value={newSecret.link}
              onChange={e => setNewSecret({...newSecret, link: e.target.value})}
            />
            <textarea 
              placeholder="Chave Pública / Certificado"
              className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white md:col-span-1 min-h-[80px]"
              value={newSecret.publicKey}
              onChange={e => setNewSecret({...newSecret, publicKey: e.target.value})}
            />
             <textarea 
              placeholder="Chave Privada / Token"
              className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white md:col-span-1 min-h-[80px]"
              value={newSecret.privateKey}
              onChange={e => setNewSecret({...newSecret, privateKey: e.target.value})}
            />
            <textarea 
              placeholder="Detalhes Adicionais (ex: Unidade Certificadora, Token ID)"
              className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white md:col-span-2 min-h-[80px]"
              value={newSecret.details}
              onChange={e => setNewSecret({...newSecret, details: e.target.value})}
            />
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 uppercase font-bold ml-1">Data de Validade (Opcional)</label>
              <input 
                type="date"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white"
                value={newSecret.expiresAt}
                onChange={e => setNewSecret({...newSecret, expiresAt: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 uppercase font-bold ml-1">Anexar Arquivo (PFX, P12, Chaves)</label>
              <div className="relative group/field">
                <input 
                  type="file" 
                  onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                />
                <div className="flex items-center gap-2 w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-400">
                  <Plus size={16} className="text-indigo-400" />
                  <span className="truncate">
                    {selectedFile ? selectedFile.name : 'Clique para selecionar arquivo...'}
                  </span>
                </div>
              </div>
            </div>
            <div className="md:col-span-2 flex justify-end gap-2">
              <button 
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button 
                onClick={handleCreateSecret}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition-all"
              >
                Gravar Segredo
              </button>
            </div>
          </div>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Descrição</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Usuário</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Senha / PIN</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Status / Validade</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Link / Arquivo</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {secrets.map(s => (
                <tr key={s.id} className="hover:bg-slate-800/30 transition-all group">
                  <td className="px-6 py-4">
                    <div className="font-bold text-white">{s.description}</div>
                    {s.details && <div className="text-[10px] text-slate-500 mt-1 line-clamp-1">{s.details}</div>}
                  </td>
                  <td className="px-6 py-4 text-slate-300">{s.username || '-'}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono bg-slate-950 px-2 py-1 rounded border border-slate-800">
                        {showPasswords[s.id] ? s.password : '••••••••'}
                      </span>
                      <button 
                        onClick={() => togglePasswordVisibility(s.id)}
                        className="p-1 text-slate-500 hover:text-white hover:bg-slate-700 rounded transition-all"
                      >
                        {showPasswords[s.id] ? <EyeOff size={14}/> : <Eye size={14} />}
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {s.expiresAt ? (
                      <div className="space-y-1">
                        {(() => {
                           const status = getExpiryStatus(s.expiresAt);
                           return status && (
                             <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold ${status.color}`}>
                               {status.label}
                             </span>
                           );
                        })()}
                        <div className="text-xs text-slate-400 font-mono">
                          {new Date(s.expiresAt).toLocaleDateString()}
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-600 text-xs">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      {s.link && (
                        <a 
                          href={s.link} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="p-1.5 bg-slate-800 hover:bg-indigo-600/20 text-indigo-400 rounded transition-all" 
                          title="Abrir Link"
                        >
                          <LinkIcon size={14} />
                        </a>
                      )}
                      {s.fileUrl ? (
                         <button 
                           onClick={() => handleDownload(s.id, s.fileUrl!)}
                           className="flex items-center gap-2 p-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 rounded-lg border border-emerald-500/20 transition-all" 
                           title="Baixar Arquivo Criptografado"
                         >
                           <Save size={14} />
                           <span className="text-[10px] font-bold">BAIXAR</span>
                         </button>
                      ) : (
                        <div className="relative group/upload">
                          <input 
                            type="file" 
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(s.id, file);
                            }}
                          />
                          <button className="flex items-center gap-2 p-1.5 bg-slate-800 hover:bg-indigo-600/20 text-slate-300 rounded-lg border border-slate-700 transition-all" title="Upload de Arquivo">
                            <Plus size={14} className="text-indigo-400" />
                            <span className="text-[10px] font-bold">SUBIR ARQUIVO</span>
                          </button>
                        </div>
                      )}
                      {(s.publicKey || s.privateKey) && (
                        <div className="p-1.5 bg-slate-800 text-yellow-500 rounded flex items-center gap-1 cursor-help" title="Possui Chaves PKI">
                          <Key size={14} />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handleDeleteSecret(s.id)}
                      className="p-2 text-slate-500 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {secrets.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-500 italic">
                    Nenhum segredo armazenado para este item.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-3 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
        <Shield className="text-yellow-500 flex-shrink-0" size={20} />
        <p className="text-xs text-yellow-500/80">
          <strong>Aviso de Segurança:</strong> Todos os dados desta aba são protegidos por criptografia em repouso. 
          O acesso Supervisor é obrigatório para visualizar e editar estas informações.
        </p>
      </div>
    </div>
  );
}
