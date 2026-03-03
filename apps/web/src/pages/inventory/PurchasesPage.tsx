import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Plus, Search, Check, X, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ContactPickerGlobal } from '../../components/contacts/ContactPickerGlobal';

export function PurchasesPage() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  
  const [selectedPurchase, setSelectedPurchase] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState<any>({
    contactId: '',
    expectedDate: '',
    deliveryDate: '',
    paymentCondition: '',
    notes: '',
    items: [],
    xmlData: null,
    supplierName: '',
  });

  useEffect(() => {
    loadPurchases();
    loadDependencies();
  }, []);

  const loadPurchases = async () => {
    try {
      const res = await api.get('/purchases');
      setPurchases(res.data);
    } catch {
      toast.error('Erro ao buscar pedidos de compra');
    }
  };

  const loadDependencies = async () => {
    try {
      const res = await api.get('/products');
      setProducts(res.data);
    } catch {
      toast.error('Erro ao buscar produtos');
    }
  };

  const loadPurchaseDetails = async (id: string) => {
    try {
      const res = await api.get(`/purchases/${id}`);
      setSelectedPurchase(res.data);
      setFormData({
        contactId: res.data.contactId,
        expectedDate: res.data.expectedDate ? new Date(res.data.expectedDate).toISOString().split('T')[0] : '',
        deliveryDate: res.data.deliveryDate ? new Date(res.data.deliveryDate).toISOString().split('T')[0] : '',
        paymentCondition: res.data.paymentCondition || '',
        notes: res.data.notes || '',
        items: res.data.items || [],
      });
    } catch {
      toast.error('Erro ao carregar detalhes do pedido');
    }
  };

  const handleApprove = async (id: string) => {
    if (!confirm('Dar entrada/receber este pedido? O estoque será atualizado e um contas-a-pagar será gerado.')) return;
    try {
      await api.patch(`/purchases/${id}/status`, { status: 'RECEIVED' });
      toast.success('Entrada concluída! Financeiro e estoque atualizados!');
      loadPurchases();
      loadPurchaseDetails(id);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao processar');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este pedido?')) return;
    try {
      await api.delete(`/purchases/${id}`);
      toast.success('Pedido excluído com sucesso');
      setSelectedPurchase(null);
      loadPurchases();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao excluir');
    }
  };

  const handleSave = async () => {
    try {
      const totalAmount = formData.items.reduce((acc: number, item: any) => acc + Number(item.total), 0);
      
      const payload = {
        ...formData,
        totalAmount
      };

      if (selectedPurchase && selectedPurchase.id) {
        await api.put(`/purchases/${selectedPurchase.id}`, payload);
        toast.success('Pedido atualizado');
      } else {
        await api.post('/purchases', payload);
        if (formData.xmlData) {
            toast.success('Entrada registrada com sucesso (Financeiro e Estoque alimentados)');
        } else {
            toast.success('Pedido de compra registrado com sucesso');
        }
      }
      setIsEditing(false);
      setSelectedPurchase(null);
      loadPurchases();
      loadDependencies(); // Reload products in case XML created new ones
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao salvar');
    }
  };

  const handleImportXmlFile = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;

    toast.loading('Lendo XML...');
    const reader = new FileReader();
    reader.onload = async (event) => {
       const xmlStr = event.target?.result as string;
       try {
           const res = await api.post('/purchases/parse-xml', { xml: xmlStr });
           const data = res.data;
           setFormData({
               ...formData,
               contactId: data.contactId,
               expectedDate: data.expectedDate ? data.expectedDate.split('T')[0] : '',
               notes: data.notes,
               items: data.items,
               xmlData: data.xmlData,
               supplierName: data.xmlData.supplierName
           });
           toast.dismiss();
           toast.success('XML carregado. Salve para registrar a entrada de vez.');
       } catch (error: any) {
           toast.dismiss();
           toast.error(error.response?.data?.message || 'Erro ao importar XML');
       }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        { productId: '', quantity: 1, unitCost: 0, discount: 0, total: 0 }
      ]
    });
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData({ ...formData, items: newItems });
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    
    if (field === 'productId') {
        const prod = products.find(p => p.id === value);
        if (prod) {
            newItems[index].unitCost = Number(prod.costPrice) || 0;
            newItems[index].total = newItems[index].unitCost * newItems[index].quantity - Number(newItems[index].discount || 0);
        }
    }
    
    if (['quantity', 'unitCost', 'discount'].includes(field)) {
        newItems[index].total = Number(newItems[index].unitCost) * Number(newItems[index].quantity) - Number(newItems[index].discount || 0);
    }
    
    setFormData({ ...formData, items: newItems });
  };

  const filteredPurchases = purchases.filter(p => 
    p.contact?.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.code.toString().includes(searchQuery)
  );

  if (isEditing) {
    const productItems = formData.items;
    const totalItemsAmount = productItems.reduce((acc: number, item: any) => acc + Number(item.total), 0);

    return (
      <div className="h-[calc(100vh-80px)] flex flex-col bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
        <div className="bg-slate-800/50 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <h2 className="text-lg font-bold text-teal-400">Novo Pedido de Compra / Cotação</h2>
             {!selectedPurchase && (
                <>
                   <input type="file" accept=".xml" id="importXmlInput" className="hidden" onChange={handleImportXmlFile} />
                   <button 
                      onClick={() => document.getElementById('importXmlInput')?.click()}
                      className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-1.5 rounded flex items-center gap-1 shadow">
                      Importar XML
                   </button>
                </>
             )}
          </div>
          <button onClick={() => setIsEditing(false)} className="text-slate-300 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-sm">
          {/* Top Panel - Info do Pedido */}
          <div className="bg-slate-800/50 border text-xs sm:text-sm border-slate-800 p-3 rounded shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="flex items-center gap-2">
                <label className="font-semibold text-slate-400 w-24">Pedido:</label>
                <input className="border border-slate-700 bg-slate-950 text-white px-2 py-1 rounded w-full font-mono font-bold outline-none" disabled value={selectedPurchase ? String(selectedPurchase.code).padStart(6, '0') : 'NOVO'} />
             </div>
             
             <div className="flex items-center gap-2">
                <label className="font-semibold text-slate-400 w-24 shrink-0">Fornecedor:</label>
                <div className="flex-1 w-full relative z-40 bg-slate-950 rounded border border-slate-700 pointer-events-auto shadow-sm">
                   <ContactPickerGlobal 
                       onAdd={async () => {}}
                       hideRole={true}
                       hideQualification={true}
                       showAction={false}
                       hideContactLabel={true}
                       onSelectContact={(id) => setFormData({...formData, contactId: id})}
                       defaultContact={selectedPurchase?.contact ? {
                           id: selectedPurchase.contact.id,
                           name: selectedPurchase.contact.name,
                           document: selectedPurchase.contact.document
                       } : formData.supplierName ? {
                           id: formData.contactId,
                           name: formData.supplierName,
                           document: ''
                       } : null}
                       className="!p-0 !bg-transparent !border-none !shadow-none"
                   />
                </div>
             </div>
             
             <div className="flex items-center gap-2">
                <label className="font-semibold text-slate-400 w-20">Previsão:</label>
                <input type="date" className="border border-slate-700 bg-slate-950 text-white px-2 py-1 rounded w-full outline-none" value={formData.expectedDate} onChange={e => setFormData({...formData, expectedDate: e.target.value})} />
             </div>
             
             <div className="flex items-center gap-2">
                <label className="font-semibold text-slate-400 w-24">Data Chegada:</label>
                <input type="date" className="border border-slate-700 bg-slate-950 text-white px-2 py-1 rounded w-full outline-none" value={formData.deliveryDate} onChange={e => setFormData({...formData, deliveryDate: e.target.value})} />
             </div>
             
             <div className="flex items-center gap-2">
                <label className="font-semibold text-slate-400 w-20">Cond. Pgto:</label>
                <input className="border border-slate-700 bg-slate-950 text-white px-2 py-1 rounded w-full outline-none" value={formData.paymentCondition} onChange={e => setFormData({...formData, paymentCondition: e.target.value})} />
             </div>
          </div>

          <div className="flex gap-4 flex-1 min-h-[300px]">
              {/* Left Side grids */}
              <div className="flex-1 flex flex-col gap-4">
                  
                  {/* Produtos */}
                  <div className="flex-1 bg-slate-800/50 border border-slate-800 rounded shadow-sm flex flex-col">
                      <div className="bg-slate-900 border-b border-slate-800 px-2 py-1 font-semibold text-slate-300 flex justify-between items-center">
                          Produtos Adquiridos
                          <button onClick={handleAddItem} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2 py-0.5 rounded text-xs flex items-center gap-1 text-slate-300">
                              <Plus size={14} /> Add
                          </button>
                      </div>
                      <div className="flex-1 overflow-auto">
                          <table className="w-full text-left text-xs">
                              <thead className="bg-slate-900 sticky top-0 text-slate-400">
                                  <tr>
                                      <th className="p-1 px-2 border-r border-slate-800 w-1/2">Produto</th>
                                      <th className="p-1 px-2 border-r border-slate-800">Custo Un.</th>
                                      <th className="p-1 px-2 border-r border-slate-800">Qtde.</th>
                                      <th className="p-1 px-2 border-r border-slate-800">Desc.</th>
                                      <th className="p-1 px-2 border-r border-slate-800">Total</th>
                                      <th className="p-1 px-2">X</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {productItems.map((item: any, idx: number) => (
                                      <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/80 transition-colors text-white">
                                          <td className="p-1 px-2 border-r border-slate-800">
                                              {item._productName ? (
                                                  <span className="text-xs">{item._productName}</span>
                                              ) : (
                                                  <select className="w-full bg-transparent outline-none text-white [&>option]:bg-slate-900" value={item.productId} onChange={e => handleItemChange(idx, 'productId', e.target.value)}>
                                                      <option value="">Selecione...</option>
                                                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                  </select>
                                              )}
                                          </td>
                                          <td className="p-1 px-2 border-r border-slate-800">
                                              <input type="number" className="w-full bg-transparent outline-none" value={item.unitCost} onChange={e => handleItemChange(idx, 'unitCost', Number(e.target.value))} />
                                          </td>
                                          <td className="p-1 px-2 border-r border-slate-800">
                                              <input type="number" className="w-full bg-transparent outline-none" value={item.quantity} onChange={e => handleItemChange(idx, 'quantity', Number(e.target.value))} />
                                          </td>
                                          <td className="p-1 px-2 border-r border-slate-800">
                                              <input type="number" className="w-full bg-transparent outline-none" value={item.discount} onChange={e => handleItemChange(idx, 'discount', Number(e.target.value))} />
                                          </td>
                                          <td className="p-1 px-2 border-r border-slate-800 font-medium">
                                              R$ {Number(item.total).toFixed(2)}
                                          </td>
                                          <td className="p-1 px-2 text-center text-red-400 cursor-pointer hover:bg-red-900/50" onClick={() => handleRemoveItem(idx)}>
                                              <Trash2 size={14} className="mx-auto"/>
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  </div>

                  {/* Observações */}
                  <div className="h-32 bg-slate-800/50 border border-slate-800 rounded shadow-sm flex flex-col">
                      <div className="bg-slate-900 border-b border-slate-800 px-2 py-1 font-semibold text-slate-300">
                          Observações do Pedido
                      </div>
                      <textarea className="flex-1 w-full p-2 outline-none resize-none bg-transparent text-white" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}></textarea>
                  </div>
              </div>

              {/* Right Side Summary Panel */}
              <div className="w-[300px] flex flex-col gap-4">
                  <div className="bg-teal-900/20 border border-teal-800/50 p-4 rounded shadow-sm flex flex-col gap-2">
                       <div className="flex justify-between font-semibold text-slate-300">
                           <span>Total Produtos:</span>
                           <span>R$ {totalItemsAmount.toFixed(2)}</span>
                       </div>
                       <div className="flex justify-between font-bold text-lg text-teal-400 border-t border-teal-800/50 pt-2 mt-2">
                           <span>Custo Total:</span>
                           <span>R$ {totalItemsAmount.toFixed(2)}</span>
                       </div>
                  </div>
              </div>
          </div>
        </div>

        <div className="bg-slate-900 border-t border-slate-800 p-3 flex justify-end gap-2">
              <button className="bg-slate-800 border border-slate-700 text-slate-300 px-4 py-2 font-medium flex items-center gap-2 rounded shadow-sm hover:bg-slate-700"
                  onClick={() => setIsEditing(false)}>
                  <X size={18} className="text-red-400"/> Cancelar
              </button>
              <button className={`${formData.xmlData ? 'bg-purple-600 border-purple-700 hover:bg-purple-700' : 'bg-teal-600 border-teal-700 hover:bg-teal-700'} text-white px-6 py-2 font-medium flex items-center gap-2 rounded shadow-sm`}
                  onClick={handleSave}>
                  <Check size={18} /> {formData.xmlData ? 'Salvar Entrada (Mover Estoque)' : 'Salvar Pedido'}
              </button>
        </div>
      </div>
    );
  }

  // Tela de Grid Principal
  return (
    <div className="h-[calc(100vh-80px)] flex flex-col bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
      <div className="bg-slate-800/50 text-white px-4 py-2 flex items-center justify-between border-b-2 border-teal-500">
        <h1 className="text-lg font-bold text-teal-400">Compras / Entradas</h1>
        <button className="text-slate-400 hover:text-white" onClick={() => window.history.back()}><X size={20} /></button>
      </div>
      
      {/* Top Search Bar */}
      <div className="bg-slate-800/30 px-4 py-3 flex items-center gap-2 border-b border-slate-800">
         <span className="text-sm font-semibold text-slate-400">Busca:</span>
         <div className="relative flex-1 max-w-md">
            <input type="text" className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 pr-8 text-sm text-white outline-none focus:border-teal-500" placeholder="Buscar pedidos..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            <Search size={16} className="absolute right-3 top-2 text-slate-500" />
         </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
         {/* Left Grid */}
         <div className="w-1/3 bg-slate-900 border-r border-slate-800 flex flex-col overflow-hidden">
             <table className="w-full text-left text-sm whitespace-nowrap">
                 <thead className="bg-slate-800">
                     <tr>
                         <th className="px-3 py-2 border-r border-slate-700 font-semibold text-slate-300 w-24">Pedido</th>
                         <th className="px-3 py-2 font-semibold text-slate-300">Fornecedor</th>
                     </tr>
                 </thead>
                 <tbody className="overflow-y-auto block h-full"> 
                 </tbody>
             </table>
             <div className="flex-1 overflow-y-auto w-full">
                 <table className="w-full text-left text-sm table-fixed">
                      <tbody>
                        {filteredPurchases.map(p => (
                             <tr key={p.id} 
                                 className={`cursor-pointer transition-colors ${selectedPurchase?.id === p.id ? 'bg-teal-600/20 text-teal-400 border-l-2 border-l-teal-500' : 'text-slate-300 hover:bg-slate-800/50 border-b border-slate-800'}`}
                                 onClick={() => loadPurchaseDetails(p.id)}>
                                 <td className="px-3 py-2 w-24 border-r border-slate-800 font-mono">{String(p.code).padStart(6, '0')}</td>
                                 <td className="px-3 py-2 truncate">{p.contact?.name || 'Sem nome'}</td>
                             </tr>
                        ))}
                      </tbody>
                 </table>
             </div>
         </div>

         {/* Right Detail Panel */}
         <div className="w-2/3 bg-slate-900 p-4 overflow-y-auto flex flex-col gap-4">
             {selectedPurchase ? (
                 <>
                    {/* Top Info Panel */}
                    <div className="flex gap-4">
                        <div className="flex-1 bg-slate-800/50 border border-slate-800 p-4 shadow-sm rounded-lg">
                           <h3 className="text-slate-400 font-semibold mb-3 pb-2 border-b border-slate-700 text-xs uppercase tracking-wider">Informações da Compra</h3>
                           <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm text-white">
                               <div><span className="text-slate-500 mr-2">Data Cotação:</span> {new Date(selectedPurchase.createdAt).toLocaleDateString()}</div>
                               <div><span className="text-slate-500 mr-2">Data Previsão:</span> {selectedPurchase.expectedDate ? new Date(selectedPurchase.expectedDate).toLocaleDateString() : 'N/A'}</div>
                               <div><span className="text-slate-500 mr-2">Valor Total:</span> <span className="font-medium text-teal-400">R$ {Number(selectedPurchase.totalAmount).toFixed(2)}</span></div>
                               <div><span className="text-slate-500 mr-2">Status:</span> 
                                  <strong className={`${selectedPurchase.status === 'RECEIVED' ? 'text-teal-400' : 'text-blue-400'}`}>
                                      {selectedPurchase.status === 'RECEIVED' ? 'RECEBIDO (ENTRADA)' : selectedPurchase.status === 'QUOTATION' ? 'COTAÇÃO' : selectedPurchase.status}
                                  </strong>
                               </div>
                               <div className="col-span-2 mt-1">
                                  <span className="text-slate-500 mr-2">Fornecedor:</span> 
                                  <span className="font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">{selectedPurchase.contact?.name}</span>
                               </div>
                           </div>
                        </div>

                        <div className="flex flex-col gap-2 w-48">
                            <button className="bg-slate-800 hover:bg-slate-700 border border-slate-700 shadow-sm py-2 text-sm font-semibold text-slate-300 rounded transition-colors disabled:opacity-50"
                              onClick={() => handleApprove(selectedPurchase.id)}
                              disabled={selectedPurchase.status === 'RECEIVED'}>
                                Dar Entrada (Receber)
                            </button>
                            <button className="bg-slate-800 hover:bg-slate-700 border border-slate-700 shadow-sm py-2 text-sm font-semibold text-slate-300 rounded transition-colors"
                              onClick={() => { setIsEditing(true); }}>
                                Editar Pedido
                            </button>
                            <button className="bg-slate-800 hover:bg-red-900/40 border border-slate-700 hover:border-red-800 hover:text-red-400 shadow-sm py-2 text-sm font-semibold text-slate-300 rounded transition-colors"
                              onClick={() => handleDelete(selectedPurchase.id)}>
                                Excluir Pedido
                            </button>
                            <button className="bg-slate-800 hover:bg-slate-700 border border-slate-700 shadow-sm py-2 text-sm font-semibold text-slate-300 rounded transition-colors">
                                Imprimir Ordem
                            </button>
                        </div>
                    </div>

                    {/* Grids Bottom */}
                    <div className="flex-1 bg-slate-800/50 border border-slate-800 shadow-sm rounded-lg flex flex-col overflow-hidden">
                        <h3 className="text-slate-400 font-semibold px-4 py-2 border-b border-slate-800 text-xs uppercase tracking-wider bg-slate-900/50 text-left">Itens da Compra</h3>
                        <div className="p-0 overflow-auto flex-1">
                             <table className="w-full text-left text-sm border-collapse">
                                 <thead className="bg-[#0078D7] text-white">
                                     <tr>
                                         <th className="px-3 py-2 border-b border-blue-800">Código</th>
                                         <th className="px-3 py-2 border-b border-blue-800">Descrição</th>
                                         <th className="px-3 py-2 border-b border-blue-800 w-24 text-right">Qtd</th>
                                         <th className="px-3 py-2 border-b border-blue-800 w-32 text-right">Custo Un.</th>
                                         <th className="px-3 py-2 border-b border-blue-800 w-32 text-right">Total</th>
                                     </tr>
                                 </thead>
                                 <tbody className="text-slate-300">
                                     {selectedPurchase.items && selectedPurchase.items.map((item: any) => (
                                         <tr key={item.id} className="border-b border-slate-800 hover:bg-slate-800 transition-colors">
                                            <td className="px-3 py-2">{item.product?.sku || item.productId.substring(0,6)}</td>
                                            <td className="px-3 py-2">{item.product?.name || 'Desconhecido'}</td>
                                            <td className="px-3 py-2 text-right">{item.quantity}</td>
                                            <td className="px-3 py-2 text-right">R$ {Number(item.unitCost).toFixed(2)}</td>
                                            <td className="px-3 py-2 text-right font-medium text-white">R$ {Number(item.total).toFixed(2)}</td>
                                         </tr>
                                     ))}
                                     {(!selectedPurchase.items || selectedPurchase.items.length === 0) && (
                                         <tr>
                                             <td colSpan={5} className="text-center p-8 text-slate-500">Nenhum item adicionado</td>
                                         </tr>
                                     )}
                                 </tbody>
                             </table>
                        </div>
                    </div>
                 </>
             ) : (
                <div className="flex-1 flex items-center justify-center text-slate-500">
                    Selecione um pedido de compra à esquerda para visualizar detalhes
                </div>
             )}
         </div>
      </div>

      {/* Bottom Navbar (Classic Windows App Style) */}
      <div className="bg-slate-900 border-t border-slate-800 px-4 py-3 flex items-center gap-4">
         <div className="flex bg-slate-800 rounded overflow-hidden shadow-sm">
             <button className="px-3 py-1.5 hover:bg-slate-700 border-r border-slate-700 text-slate-400 hover:text-white transition-colors">|&lt;</button>
             <button className="px-3 py-1.5 hover:bg-slate-700 border-r border-slate-700 text-slate-400 hover:text-white transition-colors">&lt;</button>
             <button className="px-3 py-1.5 hover:bg-slate-700 border-r border-slate-700 text-slate-400 hover:text-white transition-colors">&gt;</button>
             <button className="px-3 py-1.5 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">&gt;|</button>
         </div>
         <button className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white px-5 py-1.5 font-medium text-sm rounded shadow-sm flex flex-col items-center transition-colors"
            onClick={() => {
                setSelectedPurchase(null);
                setFormData({
                    contactId: '',
                    expectedDate: '',
                    deliveryDate: '',
                    paymentCondition: '',
                    notes: '',
                    items: [],
                });
                setIsEditing(true);
            }}>
             <span>Incluir (F2)</span>
         </button>
         <button className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white px-5 py-1.5 font-medium text-sm rounded shadow-sm flex flex-col items-center transition-colors">
             <span>Imprimir (F4)</span>
         </button>

         <div className="flex-1"></div>

         <button className="bg-slate-800 hover:bg-red-900/40 border border-slate-700 hover:border-red-800 text-slate-300 hover:text-red-400 px-5 py-1.5 font-medium text-sm rounded shadow-sm flex flex-col items-center transition-colors">
             <span>Sair</span>
         </button>
      </div>
    </div>
  );
}
