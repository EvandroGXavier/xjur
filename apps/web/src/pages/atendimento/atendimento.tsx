import { clsx } from 'clsx';
import { BookOpen, Columns, List, MessageCircle, RadioTower } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { getUser } from '../../auth/authStorage';
import { HelpModal, useHelpModal } from '../../components/HelpModal';
import { helpAtendimentoV2, helpOmnichannelConnectionsV2 } from '../../data/helpManuals';
import { AtendimentoConnectionsPage } from './AtendimentoConnectionsPage';
import { AtendimentoPage } from './atendimento-v2';
import { Kanban } from '../Kanban';
import { AtendimentoMessagesAuditPage } from './components/AtendimentoMessagesAuditPage';

type ViewType = 'console' | 'kanban' | 'connections' | 'messages';

const normalizeView = (value: string | null): ViewType => {
  if (value === 'kanban' || value === 'connections' || value === 'messages') return value;
  return 'console';
};

const NAV_ITEMS = [
  { id: 'console' as ViewType, label: 'Console', icon: MessageCircle },
  { id: 'messages' as ViewType, label: 'Mensagens', icon: List },
  { id: 'kanban' as ViewType, label: 'Kanban', icon: Columns },
  { id: 'connections' as ViewType, label: 'Canais', icon: RadioTower },
] as const;

const getUserInitials = () => {
  const user = getUser();
  if (!user?.name) return 'DX';
  return (
    user.name
      .split(' ')
      .slice(0, 2)
      .map((w: string) => w[0] || '')
      .join('')
      .toUpperCase() || 'DX'
  );
};

export function Atendimento() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isHelpOpen, setIsHelpOpen } = useHelpModal();
  const view = normalizeView(searchParams.get('view'));
  const selectedConversationId = searchParams.get('conversationId');

  const updateParams = (nextView: ViewType, conversationId?: string | null) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('view', nextView);
    if (conversationId) {
      nextParams.set('conversationId', conversationId);
    } else {
      nextParams.delete('conversationId');
    }
    setSearchParams(nextParams, { replace: true });
  };

  const helpSections = view === 'connections' ? helpOmnichannelConnectionsV2 : helpAtendimentoV2;
  const helpTitle =
    view === 'connections' ? 'Atendimento > Central de Canais' : 'Atendimento > Console e Kanban';
  const userInitials = getUserInitials();

  return (
    <div className="flex h-full overflow-hidden rounded-[28px] border border-white/10 bg-slate-950 text-white">
      {/* Vertical nav rail */}
      <nav className="flex w-14 shrink-0 flex-col items-center border-r border-white/10 bg-slate-900/80 py-3">
        {/* User avatar */}
        <div className="mb-5 flex h-9 w-9 select-none items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
          {userInitials}
        </div>

        {/* Nav items */}
        <div className="flex flex-1 flex-col items-center gap-1">
          {NAV_ITEMS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => updateParams(id)}
              title={label}
              className={clsx(
                'flex h-10 w-10 items-center justify-center rounded-xl transition',
                view === id
                  ? 'bg-emerald-400/20 text-emerald-400'
                  : 'text-slate-400 hover:bg-white/10 hover:text-white',
              )}
            >
              <Icon size={20} />
            </button>
          ))}
        </div>

        {/* Help at bottom */}
        <button
          onClick={() => setIsHelpOpen(true)}
          title="Ajuda (F1)"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          <BookOpen size={20} />
        </button>
      </nav>

      {/* Content area */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {view === 'console' && (
          <AtendimentoPage
            selectedConversationId={selectedConversationId}
            onSelectConversation={(conversationId) => updateParams('console', conversationId)}
            onOpenConnections={() => updateParams('connections')}
          />
        )}
        {view === 'kanban' && (
          <Kanban onOpenConversation={(conversationId) => updateParams('console', conversationId)} />
        )}
        {view === 'messages' && <AtendimentoMessagesAuditPage />}
        {view === 'connections' && <AtendimentoConnectionsPage />}
      </div>

      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        title={helpTitle}
        sections={helpSections}
      />
    </div>
  );
}
