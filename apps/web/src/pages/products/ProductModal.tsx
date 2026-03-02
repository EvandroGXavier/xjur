
import { useState, useEffect } from 'react';
import { X, Save, Package, Tag, Hash, FileText, Info, Truck } from 'lucide-react';
import { api } from '../../services/api';
import { toast } from 'sonner';

interface Product {
  id?: string;
  name: string;
  description?: string;
  type: 'PRODUCT' | 'SERVICE';
  sku?: string;
  barcode?: string;
  unit: string;
  ncm?: string;
  cest?: string;
  minStock: number;
  currentStock: number;
  costPrice?: number;
  sellPrice?: number;
  supplierId?: string;
}

interface Supplier {
    id: string;
    name: string;
}

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product?: Product | null;
}

export function ProductModal({ isOpen, onClose, onSuccess, product }: ProductModalProps) {
  const [formData, setFormData] = useState<Product>({
    name: '',
    description: '',
    type: 'PRODUCT',
    sku: '',
    barcode: '',
    unit: 'UN',
    ncm: '',
    cest: '',
    minStock: 0,
    currentStock: 0,
    costPrice: 0,
    sellPrice: 0,
    supplierId: ''
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (product) {
      setFormData({
        ...product,
        costPrice: product.costPrice ? Number(product.costPrice) : 0,
        sellPrice: product.sellPrice ? Number(product.sellPrice) : 0,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        type: 'PRODUCT',
        sku: '',
        barcode: '',
        unit: 'UN',
        ncm: '',
        cest: '',
        minStock: 0,
        currentStock: 0,
        costPrice: 0,
        sellPrice: 0,
        supplierId: ''
      });
    }
    
    fetchSuppliers();
  }, [product, isOpen]);

  const fetchSuppliers = async () => {
      try {
          const response = await api.get('/contacts?category=Fornecedor');
          setSuppliers(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
          // Silent fail or default to empty
          setSuppliers([]);
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error('O nome é obrigatório');
      return;
    }
    if (!formData.unit) {
      toast.error('A unidade é obrigatória (Ex: UN, KG)');
      return;
    }
    if (formData.sellPrice === undefined || formData.sellPrice <= 0) {
      toast.error('O preço de venda deve ser maior que zero');
      return;
    }

    try {
      setLoading(true);
      if (product?.id) {
        await api.patch(`/products/${product.id}`, formData);
        toast.success('Produto atualizado com sucesso!');
      } else {
        await api.post('/products', formData);
        toast.success('Produto cadastrado com sucesso!');
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Erro ao salvar produto');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between p-6 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500">
                <Package size={24} />
            </div>
            <h2 className="text-xl font-bold text-white">
              {product ? 'Editar Item' : 'Novo Item (Produto/Serviço)'}
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Tipo e Nome */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400">
                Tipo de Item <span className="text-red-500">*</span>
              </label>
              <select 
                value={formData.type}
                onChange={e => setFormData({ ...formData, type: e.target.value as 'PRODUCT' | 'SERVICE' })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-all"
              >
                <option value="PRODUCT">Produto</option>
                <option value="SERVICE">Serviço</option>
              </select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium text-slate-400">
                Nome do {formData.type === 'PRODUCT' ? 'Produto' : 'Serviço'} <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder={`Ex: ${formData.type === 'PRODUCT' ? 'Papel A4' : 'Consultoria Jurídica'}`}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400">Descrição</label>
            <textarea 
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detalhes adicionais sobre o item..."
              rows={3}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-all resize-none"
            />
          </div>

          {/* Dados Técnicos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                <Hash size={14} /> SKU / Código de Estoque
              </label>
              <input 
                type="text" 
                value={formData.sku}
                onChange={e => setFormData({ ...formData, sku: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                <Tag size={14} /> Código de Barras (EAN)
              </label>
              <input 
                type="text" 
                value={formData.barcode}
                onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          {/* Dados Fiscais */}
          <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 space-y-4">
             <div className="flex items-center gap-2 text-slate-200 font-medium text-sm">
                <Info size={16} className="text-indigo-400" />
                Dados Fiscais (NFe)
             </div>
             <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-500 uppercase">
                        Unidade <span className="text-red-500">*</span>
                    </label>
                    <input 
                        type="text" 
                        value={formData.unit}
                        onChange={e => setFormData({ ...formData, unit: e.target.value })}
                        placeholder="UN, KG, H"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-all"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-500 uppercase">NCM</label>
                    <input 
                        type="text" 
                        value={formData.ncm}
                        onChange={e => setFormData({ ...formData, ncm: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-all"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-500 uppercase">CEST</label>
                    <input 
                        type="text" 
                        value={formData.cest}
                        onChange={e => setFormData({ ...formData, cest: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-all"
                    />
                </div>
             </div>
          </div>

          {/* Estoque e Valores */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
               <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                 <Hash size={16} /> Controle de Estoque
               </h3>
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-500 uppercase">Mínimo</label>
                    <input 
                      type="number" 
                      value={formData.minStock}
                      onChange={e => setFormData({ ...formData, minStock: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-500 uppercase">Atual</label>
                    <input 
                      type="number" 
                      value={formData.currentStock}
                      disabled={!!product} // Evitar alteração manual direta no estoque via edit (usar movimentação depois)
                      onChange={e => setFormData({ ...formData, currentStock: Number(e.target.value) })}
                      className={`w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-all ${!!product ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                  </div>
               </div>
            </div>

            <div className="space-y-4">
               <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                 $ Valores
               </h3>
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-500 uppercase">Custo (R$)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={formData.costPrice}
                      onChange={e => setFormData({ ...formData, costPrice: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-500 uppercase">
                        Venda (R$) <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={formData.sellPrice}
                      onChange={e => setFormData({ ...formData, sellPrice: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-all border-indigo-500/30"
                    />
                  </div>
               </div>
            </div>
          </div>

          {/* Fornecedor */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                <Truck size={14} /> Fornecedor Preferencial
            </label>
            <select 
              value={formData.supplierId}
              onChange={e => setFormData({ ...formData, supplierId: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-all"
            >
              <option value="">Selecione um fornecedor...</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-4 pt-4 border-top border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[2] flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-bold transition shadow-lg shadow-indigo-500/20"
            >
              {loading ? 'Salvando...' : (
                <>
                  <Save size={20} />
                  {product ? 'Atualizar Item' : 'Cadastrar Item'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
