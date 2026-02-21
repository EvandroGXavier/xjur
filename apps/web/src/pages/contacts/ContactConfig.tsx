
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings, Upload, Tags, Columns, Database, FileSpreadsheet, ChevronRight, Users } from 'lucide-react';

interface ConfigCard {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  action: () => void;
  badge?: string;
  gradient: string;
}

export function ContactConfig() {
  const navigate = useNavigate();

  const configCards: ConfigCard[] = [
    {
      id: 'import',
      icon: <Upload className="w-6 h-6" />,
      title: 'Importar Contatos',
      description: 'Importe contatos em massa a partir de planilhas Excel (.xlsx) ou arquivos CSV.',
      action: () => navigate('/contacts/import'),
      gradient: 'from-emerald-500 to-teal-600',
    },
    {
      id: 'tags',
      icon: <Tags className="w-6 h-6" />,
      title: 'Gerenciar Etiquetas',
      description: 'Crie, edite e organize as etiquetas usadas para categorizar seus contatos.',
      action: () => {},
      badge: 'Em breve',
      gradient: 'from-violet-500 to-purple-600',
    },
    {
      id: 'columns',
      icon: <Columns className="w-6 h-6" />,
      title: 'Configurar Grid',
      description: 'Personalize quais colunas são exibidas na listagem de contatos e sua ordem.',
      action: () => {},
      badge: 'Em breve',
      gradient: 'from-sky-500 to-blue-600',
    },
    {
      id: 'fields',
      icon: <Database className="w-6 h-6" />,
      title: 'Campos Personalizados',
      description: 'Adicione campos customizados para armazenar informações específicas do seu escritório.',
      action: () => {},
      badge: 'Em breve',
      gradient: 'from-amber-500 to-orange-600',
    },
    {
      id: 'export',
      icon: <FileSpreadsheet className="w-6 h-6" />,
      title: 'Exportar Contatos',
      description: 'Exporte sua base de contatos para planilha Excel ou CSV com filtros personalizados.',
      action: () => {},
      badge: 'Em breve',
      gradient: 'from-rose-500 to-pink-600',
    },
    {
      id: 'duplicates',
      icon: <Users className="w-6 h-6" />,
      title: 'Mesclar Duplicados',
      description: 'Encontre e unifique contatos duplicados para manter sua base limpa e organizada.',
      action: () => {},
      badge: 'Em breve',
      gradient: 'from-cyan-500 to-teal-600',
    },
  ];

  return (
    <div className="min-h-screen p-6 md:p-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/contacts')}
            className="p-2.5 hover:bg-slate-800 rounded-xl transition-all border border-transparent hover:border-slate-700 group"
            title="Voltar para Contatos"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-xl border border-indigo-500/20">
                <Settings className="text-indigo-400 w-6 h-6" />
              </div>
              Configurações de Contatos
            </h1>
            <p className="text-slate-400 mt-1 ml-14">Gerencie importações, etiquetas, campos e mais.</p>
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {configCards.map((card) => {
          const isDisabled = !!card.badge;

          return (
            <button
              key={card.id}
              onClick={card.action}
              disabled={isDisabled}
              className={`group relative text-left rounded-xl border transition-all duration-300 overflow-hidden
                ${isDisabled
                  ? 'bg-slate-900/50 border-slate-800/50 cursor-not-allowed opacity-60'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-600 hover:shadow-xl hover:shadow-black/20 hover:-translate-y-0.5 active:scale-[0.98]'
                }
              `}
            >
              {/* Gradient accent top bar */}
              <div className={`h-1 w-full bg-gradient-to-r ${card.gradient} ${isDisabled ? 'opacity-30' : 'opacity-70 group-hover:opacity-100'} transition-opacity`} />

              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${card.gradient} ${isDisabled ? 'opacity-40' : 'opacity-80 group-hover:opacity-100 group-hover:scale-110'} transition-all duration-300 shadow-lg`}>
                    <span className="text-white">{card.icon}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {card.badge && (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 px-2.5 py-1 rounded-full border border-slate-700">
                        {card.badge}
                      </span>
                    )}
                    {!isDisabled && (
                      <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all duration-300" />
                    )}
                  </div>
                </div>

                <h3 className={`text-lg font-semibold mb-2 transition-colors ${isDisabled ? 'text-slate-500' : 'text-white group-hover:text-indigo-300'}`}>
                  {card.title}
                </h3>
                <p className={`text-sm leading-relaxed ${isDisabled ? 'text-slate-600' : 'text-slate-400'}`}>
                  {card.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer info */}
      <div className="mt-8 p-4 bg-slate-900/50 border border-slate-800/50 rounded-xl flex items-center gap-3">
        <div className="p-2 bg-indigo-500/10 rounded-lg">
          <Settings className="w-4 h-4 text-indigo-400 animate-spin" style={{ animationDuration: '8s' }} />
        </div>
        <p className="text-sm text-slate-500">
          Novas configurações estão sendo desenvolvidas e serão disponibilizadas em breve.
        </p>
      </div>
    </div>
  );
}
