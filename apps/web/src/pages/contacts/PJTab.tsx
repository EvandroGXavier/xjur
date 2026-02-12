import { useState } from 'react';
import { Building2, Calendar, FileText, CheckCircle, Users, Plus, Trash2, Edit2, Save } from 'lucide-react';
import { clsx } from 'clsx';
import { masks } from '../../utils/masks';

interface PJTabProps {
  formData: any;
  setFormData: (data: any) => void;
  onSave: (e: any) => void;
}

export function PJTab({ formData, setFormData, onSave }: PJTabProps) {
  const [newSideActivity, setNewSideActivity] = useState({ code: '', text: '' });
  const [newPartner, setNewPartner] = useState({ nome: '', qual: '', pais_origem: '' });

  if (formData.personType !== 'PJ') return null;

  // Helper to update simple fields
  const updateField = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  // Helper for Nested Objects (Main Activity)
  const updateMainActivity = (key: 'code' | 'text', value: string) => {
     const current = formData.mainActivity || { code: '', text: '' };
     setFormData({ ...formData, mainActivity: { ...current, [key]: value } });
  };

  // Helper for Arrays (Side Activities)
  const addSideActivity = () => {
    if (!newSideActivity.code || !newSideActivity.text) return;
    const current = formData.sideActivities || [];
    setFormData({ ...formData, sideActivities: [...current, newSideActivity] });
    setNewSideActivity({ code: '', text: '' });
  };

  const removeSideActivity = (index: number) => {
    const current = [...(formData.sideActivities || [])];
    current.splice(index, 1);
    setFormData({ ...formData, sideActivities: current });
  };

  // Helper for Arrays (QSA)
  const addPartner = () => {
    if (!newPartner.nome) return;
    const current = formData.pjQsa || [];
    setFormData({ ...formData, pjQsa: [...current, newPartner] });
    setNewPartner({ nome: '', qual: '', pais_origem: '' });
  };

  const removePartner = (index: number) => {
    const current = [...(formData.pjQsa || [])];
    current.splice(index, 1);
    setFormData({ ...formData, pjQsa: current });
  };

  return (
    <div className="space-y-6 animate-fadeIn max-w-5xl">
      <div className="flex justify-end">
        <button onClick={onSave} className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium mb-4 transition shadow-lg hover:shadow-green-900/20">
            <Save size={18} /> Salvar Alterações
        </button>
      </div>

      {/* Header Info (Editáveis) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Status Card */}
        <div className={clsx(
            "p-4 rounded-lg border",
            formData.status === 'ATIVA' ? "bg-emerald-500/10 border-emerald-500/20" : 
            formData.status === 'BAIXADA' ? "bg-red-500/10 border-red-500/20" : 
            "bg-slate-800/50 border-slate-700"
        )}>
            <div className="flex items-center gap-3 mb-4">
                <div className={clsx("p-2 rounded-full", 
                    formData.status === 'ATIVA' ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700 text-slate-400"
                )}>
                    <CheckCircle size={20} />
                </div>
                <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Situação Cadastral</p>
                    <select 
                        value={formData.status || ''} 
                        onChange={(e) => updateField('status', e.target.value)}
                        className="bg-transparent border-b border-slate-600 text-white font-bold text-lg focus:outline-none focus:border-indigo-500 w-full"
                    >
                        <option value="ATIVA">ATIVA</option>
                        <option value="BAIXADA">BAIXADA</option>
                        <option value="INAPTA">INAPTA</option>
                        <option value="SUSPENSA">SUSPENSA</option>
                        <option value="NULA">NULA</option>
                    </select>
                </div>
            </div>
            <div className="space-y-2">
                <div>
                    <label className="text-xs text-slate-500 block">Data da Situação</label>
                    <input 
                        type="date" 
                        value={formData.statusDate ? formData.statusDate.split('T')[0] : ''}
                        onChange={(e) => updateField('statusDate', e.target.value)}
                        className="bg-slate-900/50 border border-slate-700 rounded px-2 py-1 text-sm text-white w-full"
                    />
                </div>
                <div>
                    <label className="text-xs text-slate-500 block">Motivo</label>
                    <input 
                        value={formData.statusReason || ''}
                        onChange={(e) => updateField('statusReason', e.target.value)}
                        className="bg-slate-900/50 border border-slate-700 rounded px-2 py-1 text-sm text-white w-full"
                        placeholder="Motivo da situação..."
                    />
                </div>
            </div>
        </div>

        {/* Capital Social Card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-full bg-indigo-500/20 text-indigo-400">
                    <Building2 size={20} />
                </div>
                <div className="flex-1">
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Capital Social</p>
                    <input 
                        value={formData.shareCapital || ''}
                        onChange={(e) => updateField('shareCapital', e.target.value)}
                        className="bg-transparent border-b border-slate-600 text-white font-bold text-lg focus:outline-none focus:border-indigo-500 w-full"
                        placeholder="0.00"
                        type="number"
                    />
                </div>
            </div>
            <div className="mt-4">
                <label className="text-xs text-slate-500 block">Porte da Empresa</label>
                <select 
                    value={formData.size || ''} 
                    onChange={(e) => updateField('size', e.target.value)}
                    className="bg-slate-900/50 border border-slate-700 rounded px-2 py-1 text-sm text-white w-full mt-1"
                >
                    <option value="">Selecione...</option>
                    <option value="ME">Microempresa (ME)</option>
                    <option value="EPP">Empresa de Pequeno Porte (EPP)</option>
                    <option value="DEMAIS">Demais</option>
                </select>
            </div>
        </div>

        {/* Natureza Jurídica */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
             <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-full bg-violet-500/20 text-violet-400">
                    <FileText size={20} />
                </div>
                <div className="flex-1">
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Natureza Jurídica</p>
                    <textarea 
                        value={formData.legalNature || ''}
                        onChange={(e) => updateField('legalNature', e.target.value)}
                        className="bg-transparent border-b border-slate-600 text-white text-sm focus:outline-none focus:border-indigo-500 w-full h-12 resize-none"
                        placeholder="Código e Descrição..."
                    />
                </div>
            </div>
             <div className="pl-11 mt-2">
                <label className="text-xs text-slate-500 block mb-1">Data de Abertura</label>
                <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-700 rounded px-2 py-1">
                    <Calendar size={14} className="text-slate-500" />
                    <input 
                        type="date"
                        value={formData.openingDate ? formData.openingDate.split('T')[0] : ''}
                        onChange={(e) => updateField('openingDate', e.target.value)}
                        className="bg-transparent text-sm text-white focus:outline-none w-full"
                    />
                </div>
             </div>
        </div>
      </div>

      {/* Identificação Básica */}
      <div className="bg-slate-800/50 border border-slate-800 rounded-lg p-6 space-y-4">
          <h3 className="font-semibold text-white flex items-center gap-2 mb-4">
                <Building2 size={18} className="text-indigo-400" /> Identificação da Empresa
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">Razão Social (Nome Empresarial)</label>
                  <input 
                      value={formData.companyName || ''}
                      onChange={(e) => updateField('companyName', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
              </div>
              <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">Nome Fantasia (Nome de Exibição)</label>
                  <input 
                      value={formData.name || ''} // Mapped to main 'name' field usually
                      onChange={(e) => updateField('name', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
              </div>
               <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">Inscrição Estadual</label>
                  <input 
                      value={formData.stateRegistration || ''}
                      onChange={(e) => updateField('stateRegistration', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
              </div>
               <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">CNPJ (Somente Leitura)</label>
                  <input 
                      value={formData.cnpj || ''}
                      readOnly
                      className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-500 cursor-not-allowed"
                  />
              </div>
          </div>
      </div>

      {/* Atividades Econômicas (CNAEs) */}
      <div className="bg-slate-800/50 border border-slate-800 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-slate-800 bg-slate-900/50">
              <h3 className="font-semibold text-white flex items-center gap-2">
                  <BriefcaseIcon /> Atividades Econômicas
              </h3>
          </div>
          <div className="p-6 space-y-6">
              {/* Atividade Principal */}
              <div className="space-y-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Atividade Principal</p>
                  <div className="flex gap-2">
                       <input 
                          placeholder="CNAE (Código)"
                          value={formData.mainActivity?.code || ''}
                          onChange={(e) => updateMainActivity('code', e.target.value)}
                          className="w-24 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                       />
                       <input 
                          placeholder="Descrição da Atividade Principal"
                          value={formData.mainActivity?.text || ''}
                          onChange={(e) => updateMainActivity('text', e.target.value)}
                          className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                       />
                  </div>
              </div>

              {/* Atividades Secundárias */}
              <div className="space-y-4">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Atividades Secundárias</p>
                  
                  {/* List */}
                  {formData.sideActivities && formData.sideActivities.length > 0 && (
                      <div className="grid grid-cols-1 gap-2">
                          {formData.sideActivities.map((activity: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-2 p-2 bg-slate-900/50 border border-slate-800 rounded hover:bg-slate-800 transition group">
                                  <span className="font-mono text-slate-400 text-xs w-20 px-2 py-1 bg-slate-950 rounded">{activity.code}</span>
                                  <span className="text-slate-300 text-sm flex-1">{activity.text}</span>
                                  <button onClick={() => removeSideActivity(idx)} className="p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition">
                                      <Trash2 size={16} />
                                  </button>
                              </div>
                          ))}
                      </div>
                  )}

                  {/* Add New */}
                  <div className="flex gap-2 p-3 bg-slate-900/30 rounded border border-slate-800/50 border-dashed">
                       <input 
                          placeholder="CNAE"
                          value={newSideActivity.code}
                          onChange={(e) => setNewSideActivity({...newSideActivity, code: e.target.value})}
                          className="w-24 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-indigo-500"
                       />
                       <input 
                          placeholder="Descrição da Atividade Secundária"
                          value={newSideActivity.text}
                          onChange={(e) => setNewSideActivity({...newSideActivity, text: e.target.value})}
                          className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-indigo-500"
                       />
                       <button 
                          onClick={addSideActivity}
                          disabled={!newSideActivity.code || !newSideActivity.text}
                          className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded disabled:opacity-50"
                          title="Adicionar Atividade"
                       >
                           <Plus size={16} />
                       </button>
                  </div>
              </div>
          </div>
      </div>

      {/* Quadro de Sócios e Administradores (QSA) */}
      <div className="bg-slate-800/50 border border-slate-800 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-800 bg-slate-900/50">
            <h3 className="font-semibold text-white flex items-center gap-2">
                <Users size={18} className="text-emerald-400" /> Quadro de Sócios e Administradores (QSA)
            </h3>
        </div>
        
        <div className="p-6 space-y-6">
            {formData.pjQsa && formData.pjQsa.length > 0 && (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {formData.pjQsa.map((socio: any, idx: number) => (
                        <div key={idx} className="bg-slate-900 p-4 rounded-lg border border-slate-800 flex items-start gap-3 relative group">
                            <button 
                                onClick={() => removePartner(idx)}
                                className="absolute top-2 right-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                            >
                                <Trash2 size={14} />
                            </button>
                            <div className="p-2 bg-slate-800 rounded-full text-slate-400">
                                <Users size={16} />
                            </div>
                            <div>
                                <p className="font-bold text-white text-sm">{socio.nome}</p>
                                <p className="text-xs text-emerald-400 font-medium mt-1">{socio.qual}</p>
                                {socio.pais_origem && (
                                    <p className="text-xs text-slate-500 mt-1">País: {socio.pais_origem}</p>
                                )}
                            </div>
                        </div>
                    ))}
                 </div>
            )}

            {/* Add Partner */}
            <div className="p-4 bg-slate-900/30 rounded border border-slate-800/50 border-dashed">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Adicionar Sócio / Administrador</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input 
                        placeholder="Nome do Sócio"
                        value={newPartner.nome}
                        onChange={(e) => setNewPartner({...newPartner, nome: e.target.value})}
                        className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                    <input 
                        placeholder="Qualificação (ex: Sócio-Admin)"
                        value={newPartner.qual}
                        onChange={(e) => setNewPartner({...newPartner, qual: e.target.value})}
                        className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                     <div className="flex gap-2">
                        <input 
                            placeholder="País (Opcional)"
                            value={newPartner.pais_origem}
                            onChange={(e) => setNewPartner({...newPartner, pais_origem: e.target.value})}
                            className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                        <button 
                             onClick={addPartner}
                             disabled={!newPartner.nome}
                             className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded disabled:opacity-50 text-sm font-medium"
                        >
                            Adicionar
                        </button>
                     </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}

function BriefcaseIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400">
            <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
    );
}
