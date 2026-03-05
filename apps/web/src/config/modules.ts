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
  Columns 
} from 'lucide-react';

export const SYSTEM_MODULES = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, to: '/' },
  { id: 'chat', label: 'Atendimento', icon: MessageSquare, to: '/chat' },
  { id: 'kanban', label: 'Kanban', icon: Columns, to: '/kanban' },
  { id: 'processes', label: 'Processos', icon: Scale, to: '/processes' },
  { id: 'agenda', label: 'Agenda', icon: Calendar, to: '/agenda' },
  { 
    id: 'financial', 
    label: 'Financeiro', 
    icon: DollarSign, 
    to: '/financial',
    subItems: [
      { id: 'financial-dashboard', label: 'Meu Financeiro', to: '/financial' },
      { id: 'financial-conditions', label: 'Cond. Pagamento', to: '/financial/payment-conditions' },
    ]
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
  { id: 'contacts', label: 'Contatos', icon: Users, to: '/contacts' },
  { id: 'documents', label: 'Biblioteca', icon: FileText, to: '/documents' },
  { id: 'users', label: 'Equipe', icon: ShieldCheck, to: '/users' },
  { id: 'ai', label: 'Inteligência Artificial', icon: Bot, to: '/ai' },
  { id: 'settings', label: 'Configuração', icon: Settings, to: '/settings' },
];
