import { useState, useEffect } from "react";
import { api } from "../../services/api";
import { Plus, Search, Check, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ContactPickerGlobal } from "../../components/contacts/ContactPickerGlobal";
import { usePaymentConditions } from "../../hooks/usePaymentConditions";
import { useHotkeys } from "../../hooks/useHotkeys";

export function PurchasesPage() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  const [selectedPurchase, setSelectedPurchase] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { conditions: paymentConditions, fetchConditions } =
    usePaymentConditions();

  const [formData, setFormData] = useState<any>({
    contactId: null,
    buyerId: null,
    paymentConditionId: null,
    expectedDate: "",
    deliveryDate: "",
    paymentCondition: "",
    notes: "",
    items: [],
    financialInstallments: [],
    xmlData: null,
    supplierName: "",
  });

  useEffect(() => {
    loadPurchases();
    loadDependencies();
    fetchConditions();
  }, []);

  const handleNovoPedido = () => {
    setSelectedPurchase(null);
    setFormData({
      contactId: null,
      buyerId: null,
      paymentConditionId: null,
      expectedDate: "",
      deliveryDate: "",
      paymentCondition: "",
      notes: "",
      items: [],
      financialInstallments: [],
      xmlData: null,
      supplierName: "",
    });
    setIsEditing(true);
  };

  const printPurchaseOrder = (purchase: any) => {
    if (!purchase) {
      toast.warning("Selecione um pedido para imprimir.");
      return;
    }

    const printWindow = window.open('', '_blank', 'width=800,height=800');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Imprimir Pedido de Compra</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 12px; margin: 0; padding: 20px; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
          .info-box { border: 1px solid #000; padding: 10px; margin-bottom: 15px; border-radius: 4px; }
          .info-box h3 { margin-top: 0; border-bottom: 1px solid #ccc; padding-bottom: 5px; font-size: 14px;}
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #000; padding: 6px; text-align: left; }
          th { background-color: #f0f0f0; }
          .text-right { text-align: right; }
          .total { font-weight: bold; font-size: 14px; text-align: right; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>PEDIDO DE COMPRA Nº ${String(purchase.code).padStart(6, '0')}</h2>
          <p>DATA: ${new Date(purchase.createdAt).toLocaleDateString()}</p>
        </div>

        <div class="info-box">
          <h3>DADOS DO FORNECEDOR / EMITENTE</h3>
          <p><strong>Nome/Razão Social:</strong> ${purchase.contact?.name || ''}</p>
          <p><strong>CNPJ/CPF:</strong> ${purchase.contact?.document || ''}</p>
        </div>

        <div class="info-box">
          <h3>INFORMAÇÕES DA COMPRA</h3>
          <p><strong>Previsão de Entrega:</strong> ${purchase.deliveryDate ? new Date(purchase.deliveryDate).toLocaleDateString() : 'N/A'}</p>
          <p><strong>Status do Pedido:</strong> ${purchase.status}</p>
          <p><strong>Comprador Responsável:</strong> ${purchase.buyer?.name || 'Não Informado'}</p>
        </div>

        <h3>ITENS DO PEDIDO</h3>
        <table>
          <thead>
            <tr>
              <th>CÓDIGO</th>
              <th>DESCRIÇÃO</th>
              <th class="text-right">QTD</th>
              <th class="text-right">CUSTO UN ($)</th>
              <th class="text-right">TOTAL ($)</th>
            </tr>
          </thead>
          <tbody>
            ${purchase.items?.map((i: any) => `
              <tr>
                <td>${i.product?.sku || i.productId.substring(0,6)}</td>
                <td>${i.product?.name || ''}</td>
                <td class="text-right">${i.quantity}</td>
                <td class="text-right">${Number(i.unitCost).toFixed(2)}</td>
                <td class="text-right">${Number(i.total).toFixed(2)}</td>
              </tr>
            `).join('') || '<tr><td colspan="5" style="text-align: center;">Nenhum item adicionado</td></tr>'}
          </tbody>
        </table>

        ${purchase.financialRecords && purchase.financialRecords.length > 0 ? `
           <h3>PARCELAMENTO / FINANCEIRO</h3>
          <table>
            <thead>
              <tr>
                <th>PARCELA</th>
                <th>VENCIMENTO</th>
                <th class="text-right">VALOR ($)</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              ${purchase.financialRecords.map((fin: any) => `
                <tr>
                  <td>${fin.installmentNumber ? `${fin.installmentNumber}/${fin.totalInstallments || 1}` : 'Única'}</td>
                  <td>${new Date(fin.dueDate).toLocaleDateString()}</td>
                  <td class="text-right">${Number(fin.amount).toFixed(2)}</td>
                  <td>${fin.status}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}

        <div class="total">
          TOTAL DO PEDIDO: R$ ${Number(purchase.totalAmount).toFixed(2)}
        </div>

        ${purchase.notes ? `
          <div class="info-box" style="margin-top: 20px;">
            <h3>OBSERVAÇÕES</h3>
            <p>${purchase.notes}</p>
          </div>
        ` : ''}
        
        <script>
          window.onload = function() { window.print(); window.setTimeout(function(){window.close();}, 500); }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  useHotkeys({
    onNew: () => handleNovoPedido(),
    onCancel: () => {
      if (isEditing) setIsEditing(false);
    },
    onPrint: () => {
      if (selectedPurchase && !isEditing) {
        printPurchaseOrder(selectedPurchase);
      } else if (!isEditing) {
        toast.warning("Selecione um pedido para imprimir.");
      }
    }
  });

  const loadPurchases = async () => {
    try {
      const res = await api.get("/purchases");
      setPurchases(res.data);
    } catch {
      toast.error("Erro ao buscar pedidos de compra");
    }
  };

  const loadDependencies = async () => {
    try {
      const res = await api.get("/products");
      setProducts(res.data);
    } catch {
      toast.error("Erro ao buscar produtos");
    }
  };

  const loadPurchaseDetails = async (id: string) => {
    try {
      const res = await api.get(`/purchases/${id}`);
      setSelectedPurchase(res.data);
      setFormData({
        contactId: res.data.contactId || "",
        buyerId: res.data.buyerId || "",
        expectedDate: res.data.expectedDate
          ? new Date(res.data.expectedDate).toISOString().split("T")[0]
          : "",
        deliveryDate: res.data.deliveryDate
          ? new Date(res.data.deliveryDate).toISOString().split("T")[0]
          : "",
        paymentConditionId: res.data.paymentConditionId || "",
        paymentCondition: "",
        financialInstallments: res.data.paymentCondition?.startsWith("[")
          ? JSON.parse(res.data.paymentCondition)
          : [],
        notes: res.data.notes || "",
        items: res.data.items || [],
      });
    } catch {
      toast.error("Erro ao carregar detalhes do pedido");
    }
  };

  const handleApprove = async (id: string) => {
    if (selectedPurchase?.status === "RECEIVED") {
      toast.info("Este pedido jÃ¡ foi recebido.");
      return;
    }

    if (
      !confirm(
        "Dar entrada/receber este pedido? O estoque será atualizado e um contas-a-pagar será gerado.",
      )
    )
      return;
    try {
      await api.patch(`/purchases/${id}/status`, { status: "RECEIVED" });
      toast.success("Entrada concluída! Financeiro e estoque atualizados!");
      loadPurchases();
      loadPurchaseDetails(id);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao processar");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir este pedido?")) return;
    try {
      await api.delete(`/purchases/${id}`);
      toast.success("Pedido excluído com sucesso");
      setSelectedPurchase(null);
      loadPurchases();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao excluir");
    }
  };

  const handleSave = async (shouldClose = true) => {
    if (selectedPurchase?.status === "RECEIVED") {
      toast.error("Pedidos recebidos nÃ£o podem ser editados.");
      return;
    }

    try {
      const totalAmount = formData.items.reduce(
        (acc: number, item: any) => acc + Number(item.total),
        0,
      );

      if (formData.financialInstallments && formData.financialInstallments.length > 0) {
        const totalInstallments = formData.financialInstallments.reduce(
          (acc: number, inst: any) => acc + Number(inst.amount),
          0,
        );
        if (Math.abs(totalAmount - totalInstallments) > 0.05) {
          toast.warning(`A soma das parcelas (R$ ${totalInstallments.toFixed(2)}) não pode ser diferente do total do pedido (R$ ${totalAmount.toFixed(2)}).`);
          return;
        }
      }

      const payload = {
        ...formData,
        contactId: formData.contactId || null,
        buyerId: formData.buyerId || null,
        paymentConditionId: formData.paymentConditionId || null,
        paymentCondition: JSON.stringify(formData.financialInstallments),
        totalAmount,
      };

      if (selectedPurchase && selectedPurchase.id) {
        await api.put(`/purchases/${selectedPurchase.id}`, payload);
        toast.success("Pedido atualizado");
      } else {
        await api.post("/purchases", payload);
        if (formData.xmlData) {
          toast.success(
            "Entrada registrada com sucesso (Financeiro e Estoque alimentados)",
          );
        } else {
          toast.success("Pedido de compra registrado com sucesso");
        }
      }
      if (shouldClose) {
        setIsEditing(false);
        setSelectedPurchase(null);
      }
      loadPurchases();
      loadDependencies(); // Reload products in case XML created new ones
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao salvar");
    }
  };

  const handleImportXmlFile = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;

    toast.loading("Lendo XML...");
    const reader = new FileReader();
    reader.onload = async (event) => {
      const xmlStr = event.target?.result as string;
      try {
        const res = await api.post("/purchases/parse-xml", { xml: xmlStr });
        const data = res.data;
        
        // Ativa o modo de edição para mostrar os dados importados
        setIsEditing(true);
        setSelectedPurchase(null);

        setFormData({
          contactId: data.contactId,
          buyerId: data.buyerId,
          paymentConditionId: data.paymentConditionId || null,
          expectedDate: data.expectedDate
            ? data.expectedDate.split("T")[0]
            : "",
          deliveryDate: data.deliveryDate
            ? data.deliveryDate.split("T")[0]
            : "",
          notes: data.notes,
          items: data.items,
          xmlData: data.xmlData,
          supplierName: data.xmlData.supplierName,
          buyerName: data.xmlData.buyerName,
          financialInstallments:
            data.xmlData.dups?.map((dup: any) => ({
              dueDate: new Date(String(dup.dVenc) + "T12:00:00").toISOString().split("T")[0],
              amount: Number(dup.vDup).toFixed(2),
              installment: Number(dup.nDup),
            })) || [],
        });
        toast.dismiss();
        toast.success("XML carregado. Salve para registrar a entrada de vez.");
      } catch (error: any) {
        toast.dismiss();
        toast.error(error.response?.data?.message || "Erro ao importar XML");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        { productId: "", quantity: 1, unitCost: 0, discount: 0, total: 0 },
      ],
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

    if (field === "productId") {
      const prod = products.find((p) => p.id === value);
      if (prod) {
        newItems[index].unitCost = Number(prod.costPrice) || 0;
        newItems[index].total =
          newItems[index].unitCost * newItems[index].quantity -
          Number(newItems[index].discount || 0);
      }
    }

    if (["quantity", "unitCost", "discount"].includes(field)) {
      newItems[index].total =
        Number(newItems[index].unitCost) * Number(newItems[index].quantity) -
        Number(newItems[index].discount || 0);
    }

    setFormData({ ...formData, items: newItems });
  };

  const handlePaymentConditionChange = (condId: string) => {
    if (!condId) {
      setFormData({
        ...formData,
        paymentConditionId: "",
        financialInstallments: [],
      });
      return;
    }
    const cond = paymentConditions.find((c) => c.id === condId);
    if (cond && cond.installments) {
      const total = formData.items.reduce(
        (acc: number, item: any) => acc + Number(item.total),
        0,
      );
      const baseDateStr =
        formData.deliveryDate ||
        formData.expectedDate ||
        new Date().toISOString().split("T")[0];
      const baseDate = new Date(baseDateStr);
      // Localize date to prevent timezone shift by adding T00:00:00
      const localTime = new Date(
        baseDate.getTime() + baseDate.getTimezoneOffset() * 60000,
      );

      const insts = cond.installments.map((i: any) => {
        const d = new Date(localTime);
        d.setDate(d.getDate() + Number(i.days));
        return {
          dueDate: d.toISOString().split("T")[0],
          amount: (total * (Number(i.percentage) / 100)).toFixed(2),
          installment: i.installment,
        };
      });
      setFormData({
        ...formData,
        paymentConditionId: condId,
        financialInstallments: insts,
      });
    }
  };

  const filteredPurchases = purchases.filter(
    (p) =>
      p.contact?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toString().includes(searchQuery),
  );

  if (isEditing) {
    const productItems = formData.items;
    const totalItemsAmount = productItems.reduce(
      (acc: number, item: any) => acc + Number(item.total),
      0,
    );

    return (
      <div className="h-[calc(100vh-80px)] flex flex-col bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
        <div className="bg-slate-800/50 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-teal-400">
              Novo Pedido de Compra / Cotação
            </h2>
            {!selectedPurchase && (
              <>
                <input
                  type="file"
                  accept=".xml"
                  id="importXmlInput"
                  className="hidden"
                  onChange={handleImportXmlFile}
                />
                <button
                  onClick={() =>
                    document.getElementById("importXmlInput")?.click()
                  }
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-1.5 rounded flex items-center gap-1 shadow"
                >
                  Importar XML
                </button>
              </>
            )}
          </div>
          <button
            onClick={() => setIsEditing(false)}
            className="text-slate-300 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-sm">
          {/* Top Panel - Info do Pedido */}
          <div className="bg-slate-800/50 border text-xs sm:text-sm border-slate-800 p-3 rounded shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <label className="font-semibold text-slate-400 w-24">
                Pedido:
              </label>
              <input
                className="border border-slate-700 bg-slate-950 text-white px-2 py-1 rounded w-full font-mono font-bold outline-none"
                disabled
                value={
                  selectedPurchase
                    ? String(selectedPurchase.code).padStart(6, "0")
                    : "NOVO"
                }
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="font-semibold text-slate-400 w-24 shrink-0">
                Fornecedor:
              </label>
              <div className="flex-1 w-full relative z-40 bg-slate-950 rounded border border-slate-700 pointer-events-auto shadow-sm">
                <ContactPickerGlobal
                  onAdd={async () => {}}
                  hideRole={true}
                  hideQualification={true}
                  showAction={false}
                  hideContactLabel={true}
                  onSelectContact={(id) =>
                    setFormData({ ...formData, contactId: id })
                  }
                  defaultContact={
                    selectedPurchase?.contact
                      ? {
                          id: selectedPurchase.contact.id,
                          name: selectedPurchase.contact.name,
                          document: selectedPurchase.contact.document,
                        }
                      : formData.supplierName
                        ? {
                            id: formData.contactId,
                            name: formData.supplierName,
                            document: "",
                          }
                        : formData.contactId 
                          ? { id: formData.contactId, name: "Carregando...", document: "" }
                          : null
                  }
                  className="!p-0 !bg-transparent !border-none !shadow-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="font-semibold text-slate-400 w-24 shrink-0">
                Comprador:
              </label>
              <div className="flex-1 w-full relative z-30 bg-slate-950 rounded border border-slate-700 pointer-events-auto shadow-sm">
                <ContactPickerGlobal
                  onAdd={async () => {}}
                  hideRole={true}
                  hideQualification={true}
                  showAction={false}
                  hideContactLabel={true}
                  onSelectContact={(id) =>
                    setFormData({ ...formData, buyerId: id })
                  }
                  defaultContact={
                    selectedPurchase?.buyer
                      ? {
                          id: selectedPurchase.buyer.id,
                          name: selectedPurchase.buyer.name,
                          document: selectedPurchase.buyer.document,
                        }
                      : formData.buyerName
                        ? {
                            id: formData.buyerId,
                            name: formData.buyerName,
                            document: "",
                          }
                        : formData.buyerId
                          ? { id: formData.buyerId, name: "Carregando...", document: "" }
                          : null
                  }
                  className="!p-0 !bg-transparent !border-none !shadow-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="font-semibold text-slate-400 w-20">
                Previsão:
              </label>
              <input
                autoFocus
                type="date"
                className="border border-slate-700 bg-slate-950 text-white px-2 py-1 rounded w-full outline-none"
                value={formData.expectedDate}
                onChange={(e) =>
                  setFormData({ ...formData, expectedDate: e.target.value })
                }
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="font-semibold text-slate-400 w-24">
                Data Chegada:
              </label>
              <input
                type="date"
                className="border border-slate-700 bg-slate-950 text-white px-2 py-1 rounded w-full outline-none"
                value={formData.deliveryDate}
                onChange={(e) =>
                  setFormData({ ...formData, deliveryDate: e.target.value })
                }
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="font-semibold text-slate-400 w-20">
                Cond. Pgto:
              </label>
              <select
                className="border border-slate-700 bg-slate-950 text-white px-2 py-1 rounded w-full outline-none"
                value={formData.paymentConditionId || ""}
                onChange={(e) => handlePaymentConditionChange(e.target.value)}
              >
                <option value="">Selecione...</option>
                {paymentConditions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-4 flex-1 min-h-[300px]">
            {/* Left Side grids */}
            <div className="flex-1 flex flex-col gap-4">
              {/* Produtos */}
              <div className="flex-1 bg-slate-800/50 border border-slate-800 rounded shadow-sm flex flex-col">
                <div className="bg-slate-900 border-b border-slate-800 px-2 py-1 font-semibold text-slate-300 flex justify-between items-center">
                  Produtos Adquiridos
                  <button
                    onClick={handleAddItem}
                    className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2 py-0.5 rounded text-xs flex items-center gap-1 text-slate-300"
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 sticky top-0 text-slate-400">
                      <tr>
                        <th className="p-1 px-2 border-r border-slate-800 w-1/2">
                          Produto
                        </th>
                        <th className="p-1 px-2 border-r border-slate-800">
                          Custo Un.
                        </th>
                        <th className="p-1 px-2 border-r border-slate-800">
                          Qtde.
                        </th>
                        <th className="p-1 px-2 border-r border-slate-800">
                          Desc.
                        </th>
                        <th className="p-1 px-2 border-r border-slate-800">
                          Total
                        </th>
                        <th className="p-1 px-2">X</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productItems.map((item: any, idx: number) => (
                        <tr
                          key={idx}
                          className="border-b border-slate-800 hover:bg-slate-800/80 transition-colors text-white"
                        >
                          <td className="p-1 px-2 border-r border-slate-800">
                            {item._productName ? (
                              <span className="text-xs">
                                {item._productName}
                              </span>
                            ) : (
                              <select
                                className="w-full bg-transparent outline-none text-white [&>option]:bg-slate-900"
                                value={item.productId}
                                onChange={(e) =>
                                  handleItemChange(
                                    idx,
                                    "productId",
                                    e.target.value,
                                  )
                                }
                              >
                                <option value="">Selecione...</option>
                                {products.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="p-1 px-2 border-r border-slate-800">
                            <input
                              type="number"
                              className="w-full bg-transparent outline-none"
                              value={item.unitCost}
                              onChange={(e) =>
                                handleItemChange(
                                  idx,
                                  "unitCost",
                                  Number(e.target.value),
                                )
                              }
                            />
                          </td>
                          <td className="p-1 px-2 border-r border-slate-800">
                            <input
                              type="number"
                              className="w-full bg-transparent outline-none"
                              value={item.quantity}
                              onChange={(e) =>
                                handleItemChange(
                                  idx,
                                  "quantity",
                                  Number(e.target.value),
                                )
                              }
                            />
                          </td>
                          <td className="p-1 px-2 border-r border-slate-800">
                            <input
                              type="number"
                              className="w-full bg-transparent outline-none"
                              value={item.discount}
                              onChange={(e) =>
                                handleItemChange(
                                  idx,
                                  "discount",
                                  Number(e.target.value),
                                )
                              }
                            />
                          </td>
                          <td className="p-1 px-2 border-r border-slate-800 font-medium">
                            R$ {Number(item.total).toFixed(2)}
                          </td>
                          <td
                            className="p-1 px-2 text-center text-red-400 cursor-pointer hover:bg-red-900/50"
                            onClick={() => handleRemoveItem(idx)}
                          >
                            <Trash2 size={14} className="mx-auto" />
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
                <textarea
                  className="flex-1 w-full p-2 outline-none resize-none bg-transparent text-white"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                ></textarea>
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
              {/* Instllments / Faturamento */}
              <div className="bg-teal-900/20 border border-teal-800/50 p-4 rounded shadow-sm flex flex-col gap-2">
                <h4 className="text-teal-400 font-semibold mb-2">
                  Previsão Financeira
                </h4>
                {formData.financialInstallments.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {formData.financialInstallments.map(
                      (inst: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex gap-2 text-xs items-center"
                        >
                          <span className="text-slate-400 w-4">
                            {inst.installment}
                          </span>
                          <input
                            type="date"
                            className="bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-slate-300 w-full"
                            value={inst.dueDate}
                            onChange={(e) => {
                              const n = [...formData.financialInstallments];
                              n[idx].dueDate = e.target.value;
                              setFormData({
                                ...formData,
                                financialInstallments: n,
                              });
                            }}
                          />
                          <input
                            type="number"
                            step="0.01"
                            className="bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-slate-300 w-20 text-right"
                            value={inst.amount}
                            onChange={(e) => {
                              const n = [...formData.financialInstallments];
                              n[idx].amount = e.target.value;
                              setFormData({
                                ...formData,
                                financialInstallments: n,
                              });
                            }}
                          />
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">
                    Nenhuma parcela. Valor será à vista.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border-t border-slate-800 p-3 flex justify-end gap-2">
          <button
            className="bg-slate-800 border border-slate-700 text-slate-300 px-4 py-2 font-medium flex items-center gap-2 rounded shadow-sm hover:bg-slate-700"
            onClick={() => setIsEditing(false)}
          >
            <X size={18} className="text-red-400" /> Cancelar (ESC)
          </button>
          <button
            className={`bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 px-6 py-2 font-medium flex items-center gap-2 rounded shadow-sm`}
            onClick={() => handleSave(false)}
          >
            Salvar
          </button>
          <button
            className={`${formData.xmlData ? "bg-purple-600 border-purple-700 hover:bg-purple-700" : "bg-teal-600 border-teal-700 hover:bg-teal-700"} text-white px-6 py-2 font-medium flex items-center gap-2 rounded shadow-sm`}
            onClick={() => handleSave(true)}
          >
            <Check size={18} />{" "}
            {formData.xmlData
              ? "Salvar Entrada e Sair"
              : "Salvar e Sair"}
          </button>
        </div>
      </div>
    );
  }

  // Tela de Grid Principal
  return (
    <div className="h-[calc(100vh-80px)] flex flex-col bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
      <div className="bg-slate-800/50 text-white px-4 py-2 flex items-center justify-between border-b-2 border-teal-500">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-teal-400">Compras / Entradas</h1>
          <input
            type="file"
            accept=".xml"
            id="importXmlListInput"
            className="hidden"
            onChange={handleImportXmlFile}
          />
          <button
            onClick={() => document.getElementById("importXmlListInput")?.click()}
            className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 text-sm rounded flex items-center gap-2 shadow-lg shadow-purple-900/20 transition-all font-bold"
          >
            <Plus size={16} /> Nova Compra / Importar XML
          </button>
        </div>
        <button
          className="text-slate-400 hover:text-white"
          onClick={() => window.history.back()}
        >
          <X size={20} />
        </button>
      </div>

      {/* Top Search Bar */}
      <div className="bg-slate-800/30 px-4 py-3 flex items-center gap-2 border-b border-slate-800">
        <span className="text-sm font-semibold text-slate-400">Busca:</span>
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 pr-8 text-sm text-white outline-none focus:border-teal-500"
            placeholder="Buscar pedidos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search size={16} className="absolute right-3 top-2 text-slate-500" />
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Grid */}
        <div className="w-1/3 bg-slate-900 border-r border-slate-800 flex flex-col overflow-hidden">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-800">
              <tr>
                <th className="px-3 py-2 border-r border-slate-700 font-semibold text-slate-300 w-24">
                  Pedido
                </th>
                <th className="px-3 py-2 font-semibold text-slate-300">
                  Fornecedor
                </th>
              </tr>
            </thead>
            <tbody className="overflow-y-auto block h-full"></tbody>
          </table>
          <div className="flex-1 overflow-y-auto w-full">
            <table className="w-full text-left text-sm table-fixed">
              <tbody>
                {filteredPurchases.map((p) => (
                  <tr
                    key={p.id}
                    className={`cursor-pointer transition-colors ${selectedPurchase?.id === p.id ? "bg-teal-600/20 text-teal-400 border-l-2 border-l-teal-500" : "text-slate-300 hover:bg-slate-800/50 border-b border-slate-800"}`}
                    onClick={() => loadPurchaseDetails(p.id)}
                    onDoubleClick={() => {
                      if (p.status === "RECEIVED") {
                        toast.info("Pedidos recebidos nÃ£o podem ser editados.");
                        return;
                      }
                      setIsEditing(true);
                    }}
                  >
                    <td className="px-3 py-2 w-24 border-r border-slate-800 font-mono">
                      {String(p.code).padStart(6, "0")}
                    </td>
                    <td className="px-3 py-2 truncate">
                      {p.contact?.name || "Sem nome"}
                    </td>
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
                  <h3 className="text-slate-400 font-semibold mb-3 pb-2 border-b border-slate-700 text-xs uppercase tracking-wider">
                    Informações da Compra
                  </h3>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm text-white">
                    <div>
                      <span className="text-slate-500 mr-2">Data Cotação:</span>{" "}
                      {new Date(
                        selectedPurchase.createdAt,
                      ).toLocaleDateString()}
                    </div>
                    <div>
                      <span className="text-slate-500 mr-2">
                        Data Previsão:
                      </span>{" "}
                      {selectedPurchase.expectedDate
                        ? new Date(
                            selectedPurchase.expectedDate,
                          ).toLocaleDateString()
                        : "N/A"}
                    </div>
                    <div>
                      <span className="text-slate-500 mr-2">Valor Total:</span>{" "}
                      <span className="font-medium text-teal-400">
                        R$ {Number(selectedPurchase.totalAmount).toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 mr-2">Status:</span>
                      <strong
                        className={`${selectedPurchase.status === "RECEIVED" ? "text-teal-400" : "text-blue-400"}`}
                      >
                        {selectedPurchase.status === "RECEIVED"
                          ? "RECEBIDO (ENTRADA)"
                          : selectedPurchase.status === "QUOTATION"
                            ? "COTAÇÃO"
                            : selectedPurchase.status}
                      </strong>
                    </div>
                    <div className="col-span-2 mt-1">
                      <span className="text-slate-500 mr-2">Fornecedor:</span>
                      <span className="font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                        {selectedPurchase.contact?.name}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 w-48">
                  <button
                    className="bg-slate-800 hover:bg-slate-700 border border-slate-700 shadow-sm py-2 text-sm font-semibold text-slate-300 rounded transition-colors disabled:opacity-50"
                    onClick={() => handleApprove(selectedPurchase.id)}
                    disabled={selectedPurchase.status === "RECEIVED"}
                  >
                    Dar Entrada (Receber)
                  </button>
                  <button
                    className="bg-slate-800 hover:bg-slate-700 border border-slate-700 shadow-sm py-2 text-sm font-semibold text-slate-300 rounded transition-colors disabled:opacity-50"
                    onClick={() => {
                      if (selectedPurchase.status === "RECEIVED") {
                        toast.info("Pedidos recebidos nÃ£o podem ser editados.");
                        return;
                      }
                      setIsEditing(true);
                    }}
                    disabled={selectedPurchase.status === "RECEIVED"}
                  >
                    Editar Pedido
                  </button>
                  <button
                    className="bg-slate-800 hover:bg-red-900/40 border border-slate-700 hover:border-red-800 hover:text-red-400 shadow-sm py-2 text-sm font-semibold text-slate-300 rounded transition-colors"
                    onClick={() => handleDelete(selectedPurchase.id)}
                  >
                    Excluir Pedido
                  </button>
                  <button 
                    onClick={() => printPurchaseOrder(selectedPurchase)}
                    className="bg-slate-800 hover:bg-slate-700 border border-slate-700 shadow-sm py-2 text-sm font-semibold text-slate-300 rounded transition-colors"
                  >
                    Imprimir Ordem
                  </button>
                  {selectedPurchase.financialRecords && selectedPurchase.financialRecords.length > 0 && (
                     <button
                       className="bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/50 text-indigo-400 hover:text-indigo-300 shadow-sm py-2 text-sm font-semibold rounded transition-colors shadow-indigo-500/10"
                       onClick={() => window.location.href = "/financial"}
                     >
                       Acessar Financeiro
                     </button>
                  )}
                </div>
              </div>

              {/* Grids Bottom */}
              <div className="flex-1 bg-slate-800/50 border border-slate-800 shadow-sm rounded-lg flex flex-col overflow-hidden">
                <h3 className="text-slate-400 font-semibold px-4 py-2 border-b border-slate-800 text-xs uppercase tracking-wider bg-slate-900/50 text-left">
                  Itens da Compra
                </h3>
                <div className="p-0 overflow-auto flex-1">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-[#0078D7] text-white">
                      <tr>
                        <th className="px-3 py-2 border-b border-blue-800 w-24">
                          Código
                        </th>
                        <th className="px-3 py-2 border-b border-blue-800">
                          Descrição
                        </th>
                        <th className="px-3 py-2 border-b border-blue-800 w-24 text-right">
                          Qtd
                        </th>
                        <th className="px-3 py-2 border-b border-blue-800 w-32 text-right">
                          Custo Un.
                        </th>
                        <th className="px-3 py-2 border-b border-blue-800 w-32 text-right">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-300">
                      {selectedPurchase.items &&
                        selectedPurchase.items.map((item: any) => (
                          <tr
                            key={item.id}
                            className="border-b border-slate-800 hover:bg-slate-800 transition-colors"
                          >
                            <td className="px-3 py-2">
                              {item.product?.sku ||
                                item.productId.substring(0, 6)}
                            </td>
                            <td className="px-3 py-2">
                              {item.product?.name || "Desconhecido"}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {item.quantity}
                            </td>
                            <td className="px-3 py-2 text-right">
                              R$ {Number(item.unitCost).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-white">
                              R$ {Number(item.total).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      {(!selectedPurchase.items ||
                        selectedPurchase.items.length === 0) && (
                        <tr>
                          <td
                            colSpan={5}
                            className="text-center p-8 text-slate-500"
                          >
                            Nenhum item adicionado
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Grids Bottom - Financeiro (Contas a Pagar geradas) */}
              <div className="flex-[0.8] bg-slate-800/50 border border-slate-800 shadow-sm rounded-lg flex flex-col overflow-hidden">
                <h3 className="text-slate-400 font-semibold px-4 py-2 border-b border-slate-800 text-xs uppercase tracking-wider bg-slate-900/50 text-left">
                  Títulos a Pagar (Financeiro)
                </h3>
                <div className="p-0 overflow-auto flex-1">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-[#0078D7] text-white">
                      <tr>
                        <th className="px-3 py-2 border-b border-blue-800">Parcela</th>
                        <th className="px-3 py-2 border-b border-blue-800">Vencimento</th>
                        <th className="px-3 py-2 border-b border-blue-800 text-right">Valor</th>
                        <th className="px-3 py-2 border-b border-blue-800 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-300">
                      {selectedPurchase.financialRecords && selectedPurchase.financialRecords.map((fin: any) => (
                          <tr
                            key={fin.id}
                            className="border-b border-slate-800 hover:bg-slate-800 transition-colors"
                          >
                            <td className="px-3 py-2 font-mono">
                              {fin.installmentNumber ? `${fin.installmentNumber}/${fin.totalInstallments || 1}` : 'Única'}
                            </td>
                            <td className="px-3 py-2">
                              {new Date(fin.dueDate).toLocaleDateString()}
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-white">
                              R$ {Number(fin.amount).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {fin.status === 'PENDING' ? (
                                <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded text-xs px-2">A Pagar</span>
                              ) : fin.status === 'PAID' ? (
                                <span className="bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded text-xs px-2">Liquidado</span>
                              ) : (
                                <span className="bg-slate-500/10 text-slate-400 border border-slate-500/20 px-2 py-0.5 rounded text-xs px-2">{fin.status}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      {(!selectedPurchase.financialRecords || selectedPurchase.financialRecords.length === 0) && (
                        <tr>
                          <td colSpan={4} className="text-center p-8 text-slate-500">
                            {selectedPurchase.status === 'RECEIVED' 
                                ? 'Nenhum lançamento financeiro encontrado.'
                                : 'Contas a Pagar serão geradas ao Dar Entrada neste pedido.'}
                          </td>
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
          <button className="px-3 py-1.5 hover:bg-slate-700 border-r border-slate-700 text-slate-400 hover:text-white transition-colors">
            |&lt;
          </button>
          <button className="px-3 py-1.5 hover:bg-slate-700 border-r border-slate-700 text-slate-400 hover:text-white transition-colors">
            &lt;
          </button>
          <button className="px-3 py-1.5 hover:bg-slate-700 border-r border-slate-700 text-slate-400 hover:text-white transition-colors">
            &gt;
          </button>
          <button className="px-3 py-1.5 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
            &gt;|
          </button>
        </div>
        <button
          className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white px-5 py-1.5 font-medium text-sm rounded shadow-sm flex flex-col items-center transition-colors"
          onClick={handleNovoPedido}
        >
          <span>Incluir (F2)</span>
        </button>
        <button 
          onClick={() => printPurchaseOrder(selectedPurchase)}
          className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white px-5 py-1.5 font-medium text-sm rounded shadow-sm flex flex-col items-center transition-colors"
        >
          <span>Imprimir (F4)</span>
        </button>

        <div className="flex-1"></div>

        <button 
          onClick={() => window.history.back()}
          className="bg-slate-800 hover:bg-red-900/40 border border-slate-700 hover:border-red-800 text-slate-300 hover:text-red-400 px-5 py-1.5 font-medium text-sm rounded shadow-sm flex flex-col items-center transition-colors">
          <span>Sair</span>
        </button>
      </div>
    </div>
  );
}
