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
  { id: 'chat', label: 'Atendimento', icon: MessageSquare, to: '/chat' },
  { 
    id: 'processes', 
    label: 'Processos', 
    icon: Scale, 
    to: '/processes',
    subItems: [
      { id: 'processes-tasks', label: 'Andamentos/Tarefas', to: '/processes/tasks' },
    ]
  },
  { id: 'contacts', label: 'Contatos', icon: Users, to: '/contacts' },
  { id: 'kanban', label: 'Kanban', icon: Columns, to: '/kanban' },
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
    to: '/inventory',
    subItems: [
      { id: 'inventory-dashboard', label: 'Dashboard', to: '/inventory/dashboard' },
      { id: 'inventory-products', label: 'Produtos', to: '/inventory/products' },
      { id: 'inventory-proposals', label: 'Orçamentos', to: '/inventory/proposals' },
      { id: 'inventory-purchases', label: 'Compras', to: '/inventory/purchases' },
      { id: 'inventory-fiscal', label: 'Fiscal', to: '/inventory/fiscal' },
    ]
  },
  { id: 'documents', label: 'Biblioteca', icon: FileText, to: '/documents' },
  { id: 'users', label: 'Equipe', icon: ShieldCheck, to: '/users' },
  { id: 'ai', label: 'Inteligência Artificial', icon: Bot, to: '/ai' },
  { id: 'settings', label: 'Configuração', icon: Settings, to: '/settings' }
];
