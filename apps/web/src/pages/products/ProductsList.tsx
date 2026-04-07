import { useEffect, useMemo, useState } from 'react';
import { Package, Plus, Search, Edit2, Trash2, Box, Wrench } from 'lucide-react';
import { api } from '../../services/api';
import { toast } from 'sonner';
import { DataGrid } from '../../components/ui/DataGrid';
import { Badge } from '../../components/ui/Badge';
import { ProductModal } from './ProductModal';
import { useHotkeys } from '../../hooks/useHotkeys';

interface Product {
  id: string;
  name: string;
  description?: string;
  type: 'PRODUCT' | 'SERVICE';
  sku?: string;
  barcode?: string;
  unit: string;
  ncm?: string;
  cest?: string;
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
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Product | null;
    direction: 'asc' | 'desc' | null;
  }>({ key: null, direction: null });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useHotkeys({
    onNew: () => {
      setSelectedProduct(null);
      setIsModalOpen(true);
    },
    onCancel: () => {
      if (isModalOpen) setIsModalOpen(false);
    },
  });

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
      toast.error('Erro ao carregar catalogo');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este item?')) return;

    try {
      await api.delete(`/products/${id}`);
      toast.success('Item excluido com sucesso');
      fetchProducts();
    } catch (error: any) {
      console.error('Error deleting product:', error);
      toast.error(error.response?.data?.message || 'Erro ao excluir item');
    }
  };

  const sortedProducts = useMemo(() => {
    let sortableItems = [...products];

    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      sortableItems = sortableItems.filter(
        (product) =>
          product.name?.toLowerCase().includes(lowerTerm) ||
          product.description?.toLowerCase().includes(lowerTerm) ||
          product.sku?.toLowerCase().includes(lowerTerm) ||
          product.supplier?.name?.toLowerCase().includes(lowerTerm),
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

  const formatCurrency = (value?: number) =>
    value === undefined || value === null
      ? '-'
      : new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(value);

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
            Catalogo e Estoque
          </h1>
          <p className="text-slate-400 mt-1">
            Gerencie seus produtos, servicos e niveis de inventario.
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedProduct(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition shadow-lg shadow-indigo-500/20 whitespace-nowrap"
        >
          <Plus size={20} /> Novo Item
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, SKU ou fornecedor..."
            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-indigo-500 placeholder-slate-500 transition-all"
          />
        </div>
      </div>

      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-sm min-h-[400px]">
        <DataGrid<Product>
          data={sortedProducts}
          onRowDoubleClick={handleEdit}
          onSort={(key, direction) =>
            setSortConfig({ key: key as keyof Product, direction })
          }
          totalItems={sortedProducts.length}
          isLoading={loading}
          columns={[
            {
              key: 'type',
              label: 'Tipo',
              render: (product) => (
                <div className="flex items-center justify-center">
                  {product.type === 'SERVICE' ? (
                    <div
                      className="p-1.5 bg-blue-500/10 text-blue-500 rounded-md"
                      title="Servico"
                    >
                      <Wrench size={16} />
                    </div>
                  ) : (
                    <div
                      className="p-1.5 bg-indigo-500/10 text-indigo-500 rounded-md"
                      title="Produto"
                    >
                      <Box size={16} />
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'name',
              label: 'Item',
              sortable: true,
              render: (product) => (
                <div className="flex flex-col">
                  <span className="font-medium text-white">{product.name}</span>
                  <span className="text-xs text-slate-500">
                    {product.sku
                      ? `SKU: ${product.sku}`
                      : product.description || '-'}
                  </span>
                </div>
              ),
            },
            {
              key: 'currentStock',
              label: 'Estoque',
              sortable: true,
              render: (product) =>
                product.type === 'PRODUCT' ? (
                  <Badge variant={getStockStatus(product.currentStock, product.minStock)}>
                    {product.currentStock} {product.unit || 'un'}
                  </Badge>
                ) : (
                  <span className="text-slate-500 italic text-sm">N/A</span>
                ),
            },
            {
              key: 'sellPrice',
              label: 'P. Venda',
              sortable: true,
              render: (product) => (
                <span className="font-mono text-slate-300">
                  {formatCurrency(product.sellPrice)}
                </span>
              ),
            },
            {
              key: 'supplier',
              label: 'Fornecedor',
              render: (product) => (
                <span className="text-slate-400 truncate max-w-[150px] inline-block">
                  {product.supplier?.name || '-'}
                </span>
              ),
            },
            {
              key: 'actions',
              label: '',
              render: (product) => (
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleEdit(product)}
                    className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 rounded transition-colors"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(product.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ),
            },
          ]}
        />
      </div>

      <ProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchProducts}
        product={selectedProduct}
      />
    </div>
  );
}
