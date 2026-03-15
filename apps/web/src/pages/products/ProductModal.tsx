import { useEffect, useState } from 'react';
import { X, Save, Package, Tag, Hash, Info, Truck } from 'lucide-react';
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
  images?: string[];
  weight?: number;
  width?: number;
  height?: number;
  length?: number;
  category?: string;
  brand?: string;
  isEcommerce?: boolean;
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

const defaultFormData: Product = {
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
  supplierId: '',
  images: [],
  weight: 0,
  width: 0,
  height: 0,
  length: 0,
  category: '',
  brand: '',
  isEcommerce: false,
};

export function ProductModal({
  isOpen,
  onClose,
  onSuccess,
  product,
}: ProductModalProps) {
  const [formData, setFormData] = useState<Product>(defaultFormData);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (product) {
      setFormData({
        ...defaultFormData,
        ...product,
        costPrice: product.costPrice ? Number(product.costPrice) : 0,
        sellPrice: product.sellPrice ? Number(product.sellPrice) : 0,
        weight: product.weight ? Number(product.weight) : 0,
        width: product.width ? Number(product.width) : 0,
        height: product.height ? Number(product.height) : 0,
        length: product.length ? Number(product.length) : 0,
        images: product.images || [],
        category: product.category || '',
        brand: product.brand || '',
        isEcommerce: !!product.isEcommerce,
      });
    } else {
      setFormData(defaultFormData);
    }

    fetchSuppliers();
  }, [product, isOpen]);

  const fetchSuppliers = async () => {
    try {
      const response = await api.get('/contacts?category=Fornecedor');
      setSuppliers(Array.isArray(response.data) ? response.data : []);
    } catch {
      setSuppliers([]);
    }
  };

  const handleSubmit = async (
    event: React.FormEvent,
    shouldClose: boolean = true,
  ) => {
    event.preventDefault();

    if (!formData.name) {
      toast.error('O nome e obrigatorio');
      return;
    }
    if (!formData.unit) {
      toast.error('A unidade e obrigatoria (Ex: UN, KG)');
      return;
    }
    if (formData.sellPrice === undefined || formData.sellPrice <= 0) {
      toast.error('O preco de venda deve ser maior que zero');
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

      if (shouldClose) {
        onClose();
      } else {
        toast.success('Produto salvo. Voce pode continuar editando.');
      }
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
              {product ? 'Editar Item' : 'Novo Item (Produto/Servico)'}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400">
                Tipo de Item <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as 'PRODUCT' | 'SERVICE',
                  })
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-all"
              >
                <option value="PRODUCT">Produto</option>
                <option value="SERVICE">Servico</option>
              </select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium text-slate-400">
                Nome do {formData.type === 'PRODUCT' ? 'Produto' : 'Servico'}{' '}
                <span className="text-red-500">*</span>
              </label>
              <input
                autoFocus
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder={`Ex: ${formData.type === 'PRODUCT' ? 'Papel A4' : 'Consultoria Juridica'}`}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400">
              Descricao
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Detalhes adicionais sobre o item..."
              rows={3}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                <Hash size={14} /> SKU / Codigo de Estoque
              </label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) =>
                  setFormData({ ...formData, sku: e.target.value })
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                <Tag size={14} /> Codigo de Barras (EAN)
              </label>
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) =>
                  setFormData({ ...formData, barcode: e.target.value })
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

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
                  onChange={(e) =>
                    setFormData({ ...formData, unit: e.target.value })
                  }
                  placeholder="UN, KG, H"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 uppercase">
                  NCM
                </label>
                <input
                  type="text"
                  value={formData.ncm}
                  onChange={(e) =>
                    setFormData({ ...formData, ncm: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 uppercase">
                  CEST
                </label>
                <input
                  type="text"
                  value={formData.cest}
                  onChange={(e) =>
                    setFormData({ ...formData, cest: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Hash size={16} /> Controle de Estoque
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-500 uppercase">
                    Minimo
                  </label>
                  <input
                    type="number"
                    value={formData.minStock}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        minStock: Number(e.target.value),
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-500 uppercase">
                    Atual
                  </label>
                  <input
                    type="number"
                    value={formData.currentStock}
                    disabled={!!product}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        currentStock: Number(e.target.value),
                      })
                    }
                    className={`w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-all ${product ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                  <label className="text-xs font-medium text-slate-500 uppercase">
                    Custo (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.costPrice}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        costPrice: Number(e.target.value),
                      })
                    }
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
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        sellPrice: Number(e.target.value),
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-all border-indigo-500/30"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 space-y-4">
            <div className="flex items-center gap-2 text-slate-200 font-medium text-sm border-b border-slate-700/50 pb-2">
              <Package size={16} className="text-purple-400" />
              Logistica e E-commerce
            </div>

            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="isEcommerce"
                checked={formData.isEcommerce}
                onChange={(e) =>
                  setFormData({ ...formData, isEcommerce: e.target.checked })
                }
                className="w-4 h-4 bg-slate-950 border-slate-700 rounded text-indigo-500 focus:ring-indigo-500"
              />
              <label htmlFor="isEcommerce" className="text-sm font-medium text-slate-300">
                Produto disponivel para E-commerce / Catalogo Online
              </label>
            </div>

            {formData.isEcommerce && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-500 uppercase">
                      Peso (Kg)
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={formData.weight}
                      onChange={(e) =>
                        setFormData({ ...formData, weight: Number(e.target.value) })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-500 uppercase">
                      Compr. (cm)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.length}
                      onChange={(e) =>
                        setFormData({ ...formData, length: Number(e.target.value) })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-500 uppercase">
                      Altura (cm)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.height}
                      onChange={(e) =>
                        setFormData({ ...formData, height: Number(e.target.value) })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-500 uppercase">
                      Largura (cm)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.width}
                      onChange={(e) =>
                        setFormData({ ...formData, width: Number(e.target.value) })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-500 uppercase">
                      Categoria
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Informatica, Papelaria..."
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-500 uppercase">
                      Marca
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Samsung, BIC..."
                      value={formData.brand}
                      onChange={(e) =>
                        setFormData({ ...formData, brand: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <label className="text-xs font-medium text-slate-500 uppercase flex items-center justify-between">
                    Imagens (URLs)
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((current) => ({
                          ...current,
                          images: [...(current.images || []), ''],
                        }))
                      }
                      className="text-indigo-400 hover:text-indigo-300 font-semibold px-2"
                    >
                      + Adicionar Imagem
                    </button>
                  </label>
                  {formData.images?.map((img, idx) => (
                    <div key={idx} className="flex gap-2 mb-2 items-center">
                      <input
                        type="url"
                        value={img}
                        placeholder="https://..."
                        onChange={(e) => {
                          const newImgs = [...(formData.images || [])];
                          newImgs[idx] = e.target.value;
                          setFormData({ ...formData, images: newImgs });
                        }}
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm focus:border-indigo-500"
                      />
                      {img && (
                        <img
                          src={img}
                          alt="Preview"
                          className="w-10 h-10 object-cover rounded border border-slate-700 bg-slate-900"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjOTQ5Njc1MSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwb2x5bGluZSBwb2ludHM9IjIxIDYgMjEgMTggMyAxOCAzIDYgMjEgNiIvPjxwb2x5bGluZSBwb2ludHM9IjIxIDYgMTIgMTIgMyA2Ii8+PC9zdmc+';
                          }}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const newImgs = [...(formData.images || [])];
                          newImgs.splice(idx, 1);
                          setFormData({ ...formData, images: newImgs });
                        }}
                        className="p-1.5 text-red-400 hover:bg-red-400/10 rounded"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  {(!formData.images || formData.images.length === 0) && (
                    <p className="text-xs text-slate-500">
                      Nenhuma imagem cadastrada.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
              <Truck size={14} /> Fornecedor Preferencial
            </label>
            <select
              value={formData.supplierId}
              onChange={(e) =>
                setFormData({ ...formData, supplierId: e.target.value })
              }
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-all"
            >
              <option value="">Selecione um fornecedor...</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-4 pt-4 border-top border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition"
            >
              Cancelar (ESC)
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={(e) => handleSubmit(e, false)}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-bold transition shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
            >
              {loading ? 'Salvando...' : 'Salvar e Continuar'}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={(e) => handleSubmit(e, true)}
              className="flex-[2] flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-bold transition shadow-lg shadow-indigo-500/20"
            >
              {loading ? (
                'Salvando...'
              ) : (
                <>
                  <Save size={20} />
                  {product ? 'Atualizar e Sair' : 'Salvar e Sair'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
