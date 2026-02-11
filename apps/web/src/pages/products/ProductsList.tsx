
import { useState, useEffect, useMemo } from 'react';
import { Package, Plus, Search, Filter } from 'lucide-react';
import { api } from '../../services/api';
import { toast } from 'sonner';
import { DataGrid } from '../../components/ui/DataGrid';
import { Badge } from '../../components/ui/Badge';

interface Product {
  id: string;
  name: string;
  description?: string;
  currentStock: number;
  minStock: number;
  sellPrice?: number;
  costPrice?: number;
  supplier?: {
      name: string;
  };
}

export function ProductsList() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Product | null, direction: 'asc' | 'desc' | null }>({ key: null, direction: null });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
        setLoading(true);
        const response = await api.get('/products');
        setProducts(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
        console.error('Error fetching products:', error);
        toast.error('Erro ao carregar estoque');
    } finally {
        setLoading(false);
    }
  };

  const sortedProducts = useMemo(() => {
      let sortableItems = [...products];
      if (searchTerm) {
          const lowerTerm = searchTerm.toLowerCase();
          sortableItems = sortableItems.filter(p => 
              (p.name && p.name.toLowerCase().includes(lowerTerm)) ||
              (p.description && p.description.toLowerCase().includes(lowerTerm)) ||
              (p.supplier?.name && p.supplier.name.toLowerCase().includes(lowerTerm))
          );
      }
      if (sortConfig.key && sortConfig.direction) {
          sortableItems.sort((a, b) => {
              const aValue = a[sortConfig.key!] ?? '';
              const bValue = b[sortConfig.key!] ?? '';
              if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
              if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
              return 0;
          });
      }
      return sortableItems;
  }, [products, sortConfig, searchTerm]);

  const formatCurrency = (val?: number) => val ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val) : '-';

  const getStockStatus = (current: number, min: number) => {
      if (current <= 0) return 'error';
      if (current <= min) return 'warning';
      return 'success';
  };

  return (
    <div className="space-y-6 h-full flex flex-col animate-in fade-in duration-500 p-6 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
             <Package className="text-indigo-500" size={32} />
             Estoque e Produtos
          </h1>
          <p className="text-slate-400 mt-1">Gerencie seu inventário de produtos e materiais.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition shadow-lg shadow-indigo-500/20 whitespace-nowrap">
            <Plus size={20} /> Novo Produto
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full md:max-w-xl">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar produto ou fornecedor..." 
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-indigo-500 placeholder-slate-500 transition-all" 
              />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
              <button className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 flex items-center gap-2 hover:bg-slate-700 hover:text-white transition text-sm font-medium whitespace-nowrap">
                  <Filter size={16} /> Filtros
              </button>
          </div>
      </div>

      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-sm min-h-[400px]">
          <DataGrid<Product>
            data={sortedProducts}
            onSort={(key, direction) => setSortConfig({ key: key as keyof Product, direction })}
            totalItems={products.length}
            isLoading={loading}
            columns={[
                {
                    key: 'name',
                    label: 'Produto',
                    sortable: true,
                    render: (p) => (
                        <div className="flex flex-col">
                            <span className="font-medium text-white">{p.name}</span>
                            <span className="text-xs text-slate-500">{p.description || '-'}</span>
                        </div>
                    )
                },
                {
                    key: 'currentStock',
                    label: 'Estoque',
                    sortable: true,
                    render: (p) => (
                        <Badge variant={getStockStatus(p.currentStock, p.minStock)}>
                            {p.currentStock} un
                        </Badge>
                    )
                },
                {
                    key: 'sellPrice',
                    label: 'Preço Venda',
                    sortable: true,
                    render: (p) => <span className="font-mono text-slate-300">{formatCurrency(p.sellPrice)}</span>
                },
                {
                    key: 'supplier',
                    label: 'Fornecedor',
                    render: (p) => <span className="text-slate-400">{p.supplier?.name || '-'}</span>
                }
            ]}
          />
      </div>
    </div>
  );
}
