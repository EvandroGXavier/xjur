import { Building2, Calendar, FileText, CheckCircle, Users } from 'lucide-react';
import { clsx } from 'clsx';
import { masks } from '../../utils/masks';

interface PJTabProps {
  formData: any;
}

export function PJTab({ formData }: PJTabProps) {
  if (formData.personType !== 'PJ') return null;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Status Card */}
        <div className={clsx(
            "p-4 rounded-lg border",
            formData.status === 'ATIVA' ? "bg-emerald-500/10 border-emerald-500/20" : 
            formData.status === 'BAI' ? "bg-red-500/10 border-red-500/20" : 
            "bg-slate-800/50 border-slate-700"
        )}>
            <div className="flex items-center gap-3 mb-2">
                <div className={clsx("p-2 rounded-full", 
                    formData.status === 'ATIVA' ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700 text-slate-400"
                )}>
                    <CheckCircle size={20} />
                </div>
                <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Situação Cadastral</p>
                    <p className="font-bold text-white text-lg">{formData.status || 'NÃO INFORMADO'}</p>
                </div>
            </div>
            {formData.statusDate && (
                <p className="text-xs text-slate-500 pl-11">Desde: {formData.statusDate}</p>
            )}
        </div>

        {/* Capital Social Card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-full bg-indigo-500/20 text-indigo-400">
                    <Building2 size={20} />
                </div>
                <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Capital Social</p>
                    <p className="font-bold text-white text-lg">
                        {formData.shareCapital ? masks.currency(formData.shareCapital.toString()) : 'R$ 0,00'}
                    </p>
                </div>
            </div>
            <p className="text-xs text-slate-500 pl-11">Porte: {formData.size || 'NÃO INFORMADO'}</p>
        </div>

        {/* Natureza Jurídica */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
             <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-full bg-violet-500/20 text-violet-400">
                    <FileText size={20} />
                </div>
                <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Natureza Jurídica</p>
                    <p className="font-medium text-white text-sm line-clamp-2" title={formData.legalNature}>
                        {formData.legalNature || 'Não Informado'}
                    </p>
                </div>
            </div>
             <div className="pl-11 flex items-center gap-2">
                <Calendar size={12} className="text-slate-500" />
                <p className="text-xs text-slate-500">Abertura: {formData.openingDate || '-'}</p>
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
              <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Atividade Principal</p>
                  {formData.mainActivity ? (
                      <div className="flex items-start gap-3 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                          <span className="font-mono text-indigo-400 font-bold">{formData.mainActivity.code}</span>
                          <span className="text-indigo-100">{formData.mainActivity.text}</span>
                      </div>
                  ) : (
                      <p className="text-slate-500 italic">Nenhuma atividade principal informada.</p>
                  )}
              </div>

              {/* Atividades Secundárias */}
              <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Atividades Secundárias</p>
                  {formData.sideActivities && formData.sideActivities.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {formData.sideActivities.map((activity: any, idx: number) => (
                              <div key={idx} className="flex items-start gap-2 p-2 bg-slate-900/50 border border-slate-800 rounded hover:bg-slate-800 transition">
                                  <span className="font-mono text-slate-400 text-xs">{activity.code}</span>
                                  <span className="text-slate-300 text-sm line-clamp-1" title={activity.text}>{activity.text}</span>
                              </div>
                          ))}
                      </div>
                  ) : (
                      <p className="text-slate-500 italic">Nenhuma atividade secundária informada.</p>
                  )}
              </div>
          </div>
      </div>

      {/* Quadro de Sócios e Administradores (QSA) */}
      <div className="bg-slate-800/50 border border-slate-800 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-800 bg-slate-900/50">
            <h3 className="font-semibold text-white flex items-center gap-2">
                <Users size={18} className="text-emerald-400" /> Quadro de Sócios e Administradores
            </h3>
        </div>
        
        {formData.pjQsa && formData.pjQsa.length > 0 ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                {formData.pjQsa.map((socio: any, idx: number) => (
                    <div key={idx} className="bg-slate-900 p-4 rounded-lg border border-slate-800 flex items-start gap-3">
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
        ) : (
            <div className="p-8 text-center text-slate-500">
                <p>Nenhum sócio ou administrador encontrado na base da Receita.</p>
            </div>
        )}
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
