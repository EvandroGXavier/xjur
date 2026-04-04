import { 
  LayoutDashboard, 
  MessageSquare, 
  Scale, 
  DollarSign, 
  Users, 
  Bot,
  FileText,
  Settings,
  Package,
  ShieldCheck,
  Calendar,
  Columns,
  Lock
} from 'lucide-react';

export const SYSTEM_MODULES = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, to: '/' },
  { id: 'chat', label: 'Atendimento', icon: MessageSquare, to: '/atendimento' },
  { 
    id: 'processes', 
    label: 'Processos', 
    icon: Scale, 
    to: '/processes'
  },
  { id: 'contacts', label: 'Contatos', icon: Users, to: '/contacts' },
  { id: 'agenda', label: 'Agenda', icon: Calendar, to: '/agenda' },
  { 
    id: 'financial', 
    label: 'Financeiro', 
    icon: DollarSign, 
    to: '/financial'
  },
  { 
    id: 'inventory', 
    label: 'Estoque', 
    icon: Package, 
    to: '/inventory'
  },
  { id: 'documents', label: 'Biblioteca', icon: FileText, to: '/documents' },
  { id: 'users', label: 'Equipe', icon: ShieldCheck, to: '/users' },
  { id: 'ai', label: 'Inteligência Artificial', icon: Bot, to: '/ai' },
  { id: 'settings', label: 'Configuração', icon: Settings, to: '/settings' }
];
