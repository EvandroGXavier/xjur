import { useState, useEffect } from "react";
import { api } from "../../services/api";
import { Plus, Search, Check, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ContactPickerGlobal } from "../../components/contacts/ContactPickerGlobal";
import { usePaymentConditions } from "../../hooks/usePaymentConditions";
import { useHotkeys } from "../../hooks/useHotkeys";
import { embeddedContentColor } from "../../utils/themeColors";
import { CreatableSelect } from "../../components/ui/CreatableSelect";

export function ProposalsPage({
  mode = "open",
}: {
  mode?: "open" | "approved";
}) {
  const isSalesMode = mode === "approved";
  const [proposals, setProposals] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  const [selectedProposal, setSelectedProposal] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { conditions: paymentConditions, fetchConditions } =
    usePaymentConditions();

  // Form State
  const [formData, setFormData] = useState<any>({
    contactId: "",
    sellerId: "", // Added
    salesperson: "",
    validUntil: "",
    deliveryDate: "",
    special: false,
    paymentConditionId: "",
    paymentCondition: "",
    notes: "",
    items: [],
    financialInstallments: [],
  });

  const [defaultSeller, setDefaultSeller] = useState<any>(null);
  const [defaultConfigs, setDefaultConfigs] = useState<any>(null);
  const pageTitle = isSalesMode ? "Vendas" : "Orcamentos / Pedidos";
  const selectedItemLabel = isSalesMode ? "uma venda" : "um orcamento";

  useEffect(() => {
    loadProposals();
    loadDependencies();
    fetchConditions();
    loadUsers();
  }, []);

  const searchPlaceholder = isSalesMode
    ? "Buscar vendas..."
    : "Buscar orcamentos...";

  const loadUsers = async () => {
    try {
      const res = await api.get("/users");
      setUsers(res.data);
    } catch {
      console.error("Erro ao carregar usuÃ¡rios");
    }
  };

  const handleNovaProposta = async () => {
    setSelectedProposal(null);
    
    let initialSellerId = "";
    let initialSeller = null;
    let initialNotes = "";
    let initialValidity = "";
    let initialConditionId = "";

    try {
      const res = await api.get("/stock/config");
      const config = res.data;
      if (config) {
        initialSellerId = config.defaultSellerId || "";
        initialSeller = config.defaultSeller || null;
        initialNotes = config.defaultNotes || "";
        initialConditionId = config.defaultPaymentConditionId || "";
        
        if (config.defaultValidityDays) {
          const d = new Date();
          d.setDate(d.getDate() + Number(config.defaultValidityDays));
          initialValidity = d.toISOString().split("T")[0];
        }
      }
    } catch (err) {
      console.error("Erro ao buscar configuracoes de estoque", err);
    }

    setFormData({
      contactId: "",
      sellerId: initialSellerId,
      salesperson: "",
      validUntil: initialValidity,
      deliveryDate: "",
      special: false,
      paymentConditionId: initialConditionId,
      paymentCondition: "",
      notes: initialNotes,
      items: [],
      financialInstallments: [],
    });
    setDefaultSeller(initialSeller);
    setIsEditing(true);
  };

  const printProposal = (proposal: any) => {
    if (!proposal) return;

    const printContents = `
      <html>
        <head>
          <title>OrÃ§amento #${String(proposal.code).padStart(6, "0")}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: ${embeddedContentColor.text}; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid ${embeddedContentColor.text}; padding-bottom: 20px; margin-bottom: 30px; }
            .title { font-size: 24px; font-weight: bold; margin: 0; color: ${embeddedContentColor.textStrong}; text-transform: uppercase; }
            .subtitle { color: ${embeddedContentColor.textMuted}; font-size: 14px; margin-top: 5px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .info-box { border: 1px solid ${embeddedContentColor.borderSoft}; padding: 15px; border-radius: 4px; background: ${embeddedContentColor.surfaceMuted}; }
            .info-box strong { display: block; margin-bottom: 5px; color: ${embeddedContentColor.textStrong}; border-bottom: 1px solid ${embeddedContentColor.surfaceSoft}; padding-bottom: 5px; }
            .info-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { text-align: left; padding: 10px; border-bottom: 2px solid ${embeddedContentColor.borderSoft}; background: ${embeddedContentColor.surfaceSoft}; font-size: 12px; text-transform: uppercase; color: ${embeddedContentColor.textMuted}; }
            td { padding: 10px; border-bottom: 1px solid ${embeddedContentColor.surfaceSoft}; font-size: 14px; }
            .text-right { text-align: right; }
            .totals { width: 300px; float: right; margin-bottom: 30px; }
            .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
            .total-row.grand-total { border-top: 2px solid ${embeddedContentColor.text}; font-weight: bold; font-size: 18px; margin-top: 10px; padding-top: 10px; }
            .clear { clear: both; }
            .notes { border-top: 1px solid ${embeddedContentColor.borderSoft}; padding-top: 20px; font-size: 13px; color: ${embeddedContentColor.textMuted}; }
            .status-badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px; border: 1px solid ${embeddedContentColor.text}; }
            .financial-table th, .financial-table td { font-size: 12px; padding: 6px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">OrÃ§amento / Proposta</h1>
              <div class="subtitle">NÂº ${String(proposal.code).padStart(6, "0")}</div>
            </div>
            <div style="text-align: right;">
              <div class="subtitle">Data: ${new Date(proposal.createdAt).toLocaleDateString()}</div>
              <div class="status-badge">${proposal.status === "APPROVED" ? "APROVADO" : proposal.status}</div>
            </div>
          </div>
          
          <div class="info-grid">
            <div class="info-box" style="grid-column: span 2;">
              <strong>Para</strong>
              <div style="font-size: 14px; line-height: 1.6;">
                <div style="font-weight: bold; font-size: 16px;">${proposal.contact?.name || "-"}</div>
                <div>${proposal.contact?.document ? (proposal.contact.personType === 'PJ' ? 'CNPJ: ' : 'CPF: ') + proposal.contact.document : "-"} ${proposal.contact?.stateRegistration ? `| IE: ${proposal.contact.stateRegistration}` : ""}</div>
                <div>${[proposal.contact?.address, proposal.contact?.number, proposal.contact?.complement].filter(Boolean).join(", ")}</div>
                <div>${[proposal.contact?.neighborhood, proposal.contact?.city, proposal.contact?.state].filter(Boolean).join(" - ")}</div>
                <div>${proposal.contact?.zipCode ? `CEP: ${proposal.contact.zipCode}` : ""}</div>
                <div style="margin-top: 5px;">
                  ${proposal.contact?.phone ? `Celular: ${proposal.contact.phone}` : ""} 
                  ${proposal.contact?.email ? ` | E-mail: ${proposal.contact.email}` : ""}
                </div>
              </div>
            </div>
            <div class="info-box" style="grid-column: span 2; margin-top: 10px;">
              <strong>InformaÃ§Ãµes Comerciais</strong>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div class="info-row"><span>Vendedor / Atendimento:</span> <span>${proposal.seller?.name || proposal.salesperson || "-"}</span></div>
                <div class="info-row"><span>Validade:</span> <span>${proposal.validUntil ? new Date(proposal.validUntil).toLocaleDateString() : "-"}</span></div>
                <div class="info-row"><span>CondiÃ§Ã£o Pagto:</span> <span>${proposal.paymentConditionId ? proposal.paymentCondition : "-"}</span></div>
                <div class="info-row"><span>PrevisÃ£o Entrega:</span> <span>${proposal.deliveryDate ? new Date(proposal.deliveryDate).toLocaleDateString() : "-"}</span></div>
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>CÃ³digo</th>
                <th>DescriÃ§Ã£o</th>
                <th class="text-right">Qtd</th>
                <th class="text-right">V. Unit</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${proposal.items?.map((item: any) => `
                <tr>
                  <td>${item.product?.sku || item.productId.substring(0, 6)}</td>
                  <td>${item.product?.name || "-"}</td>
                  <td class="text-right">${item.quantity}</td>
                  <td class="text-right">R$ ${Number(item.unitPrice).toFixed(2)}</td>
                  <td class="text-right">R$ ${Number(item.total).toFixed(2)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>

          <div class="totals">
            <div class="total-row grand-total">
              <span>Total do OrÃ§amento:</span>
              <span>R$ ${Number(proposal.totalAmount).toFixed(2)}</span>
            </div>
          </div>
          <div class="clear"></div>

          ${proposal.financialRecords && proposal.financialRecords.length > 0 ? `
            <h4 style="margin-bottom: 10px; color: ${embeddedContentColor.text};">PrevisÃ£o Financeira</h4>
            <table class="financial-table" style="width: 50%;">
              <thead>
                <tr>
                  <th>Parcela</th>
                  <th>Vencimento</th>
                  <th class="text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                ${proposal.financialRecords.map((fr: any, index: number) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${new Date(fr.dueDate).toLocaleDateString()}</td>
                    <td class="text-right">R$ ${Number(fr.amount).toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}

          ${proposal.notes ? `
            <div class="notes">
              <strong>ObservaÃ§Ãµes:</strong><br/>
              ${proposal.notes.replace(/\n/g, '<br/>')}
            </div>
          ` : ''}
          
          <div style="margin-top: 50px; text-align: center; border-top: 1px dashed ${embeddedContentColor.borderSoft}; padding-top: 20px;">
            ___________________________________________________<br/>
            Assinatura do Cliente
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContents);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  };

  useHotkeys({
    onNew: () => {
      if (!isSalesMode) {
        handleNovaProposta();
      }
    },
    onCancel: () => {
      if (isEditing) setIsEditing(false);
    },
    onPrint: () => {
      if (selectedProposal && !isEditing) {
        printProposal(selectedProposal);
      } else if (!isEditing) {
        toast.warning("Selecione um orÃ§amento para imprimir.");
      }
    }
  });

  const loadProposals = async () => {
    try {
      const res = await api.get("/proposals");
      setProposals(res.data);
    } catch {
      toast.error("Erro ao buscar orÃ§amentos");
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

  const loadProposalDetails = async (id: string) => {
    try {
      const res = await api.get(`/proposals/${id}`);
      setSelectedProposal(res.data);
      setFormData({
        contactId: res.data.contactId,
        salesperson: res.data.salesperson || "",
        validUntil: res.data.validUntil
          ? new Date(res.data.validUntil).toISOString().split("T")[0]
          : "",
        deliveryDate: res.data.deliveryDate
          ? new Date(res.data.deliveryDate).toISOString().split("T")[0]
          : "",
        special: res.data.special || false,
        paymentConditionId: res.data.paymentConditionId || "",
        paymentCondition: "",
        financialInstallments: res.data.paymentCondition?.startsWith("[")
          ? JSON.parse(res.data.paymentCondition)
          : [],
        notes: res.data.notes || "",
        items: res.data.items || [],
        sellerId: res.data.sellerId || "",
      });
      setDefaultSeller(res.data.seller || null);
    } catch {
      toast.error("Erro ao carregar detalhes do orÃ§amento");
    }
  };

  const handleApprove = async (id: string) => {
    if (selectedProposal?.status === "APPROVED") {
      toast.info("Este orÃƒÂ§amento jÃƒÂ¡ foi aprovado.");
      return;
    }

    try {
      await api.patch(`/proposals/${id}/status`, { status: "APPROVED" });
      toast.success("OrÃ§amento aprovado. Financeiro e estoque atualizados!");
      setSelectedProposal(null);
      setIsEditing(false);
      loadProposals();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao aprovar");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir este orÃ§amento?")) return;
    try {
      await api.delete(`/proposals/${id}`);
      toast.success("OrÃ§amento excluÃ­do com sucesso");
      setSelectedProposal(null);
      loadProposals();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao excluir");
    }
  };

  const handleSave = async (shouldClose = true) => {
    if (selectedProposal?.status === "APPROVED") {
      toast.error("OrÃƒÂ§amentos aprovados nÃƒÂ£o podem ser editados.");
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
          toast.warning(`A soma das parcelas (R$ ${totalInstallments.toFixed(2)}) nÃ£o pode ser diferente do total do pedido (R$ ${totalAmount.toFixed(2)}).`);
          return;
        }
      }

      const payload = {
        ...formData,
        sellerId: formData.sellerId,
        paymentCondition: JSON.stringify(formData.financialInstallments),
        totalAmount,
      };

      if (selectedProposal && selectedProposal.id) {
        await api.put(`/proposals/${selectedProposal.id}`, payload);
        toast.success("OrÃ§amento atualizado");
      } else {
        await api.post("/proposals", payload);
        toast.success("OrÃ§amento criado com sucesso");
      }
      if (shouldClose) {
        setIsEditing(false);
        setSelectedProposal(null);
      }
      loadProposals();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao salvar");
    }
  };

  const handleAddItem = () => {
    const newItems = [
      ...formData.items,
      { productId: "", quantity: 1, unitPrice: 0, discount: 0, total: 0 },
    ];
    setFormData((prev: any) => ({
      ...prev,
      items: newItems,
    }));
    // Se tiver condiÃƒÂ§ÃƒÂ£o de pgto, recalcula parcelas
    if (formData.paymentConditionId) {
       setTimeout(() => handlePaymentConditionChange(formData.paymentConditionId, newItems), 0);
    }
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData((prev: any) => ({ ...prev, items: newItems }));
    // Se tiver condiÃƒÂ§ÃƒÂ£o de pgto, recalcula parcelas
    if (formData.paymentConditionId) {
       setTimeout(() => handlePaymentConditionChange(formData.paymentConditionId, newItems), 0);
    }
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;

    if (field === "productId") {
      const prod = products.find((p) => p.id === value);
      if (prod) {
        newItems[index].unitPrice = Number(prod.sellPrice) || 0;
        // Update total
        newItems[index].total =
          newItems[index].unitPrice * newItems[index].quantity -
          Number(newItems[index].discount || 0);
      }
    }

    if (["quantity", "unitPrice", "discount"].includes(field)) {
      newItems[index].total =
        Number(newItems[index].unitPrice) * Number(newItems[index].quantity) -
        Number(newItems[index].discount || 0);
    }

    setFormData((prev: any) => ({ ...prev, items: newItems }));
    
    // Se tiver condiÃƒÂ§ÃƒÂ£o de pgto, recalcula parcelas
    if (formData.paymentConditionId) {
       setTimeout(() => handlePaymentConditionChange(formData.paymentConditionId, newItems), 0);
    }
  };

  const handlePaymentConditionChange = (condId: string, currentItems?: any[]) => {
    const itemsToUse = currentItems || formData.items;
    if (!condId) {
      setFormData((prev: any) => ({
        ...prev,
        paymentConditionId: "",
        financialInstallments: [],
      }));
      return;
    }
    const cond = paymentConditions.find((c) => c.id === condId);
    if (cond && cond.installments) {
      const total = itemsToUse.reduce(
        (acc: number, item: any) => acc + Number(item.total),
        0,
      );
      const baseDateStr =
        formData.deliveryDate ||
        formData.validUntil ||
        new Date().toISOString().split("T")[0];
      const baseDate = new Date(baseDateStr);
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
      setFormData((prev: any) => ({
        ...prev,
        paymentConditionId: condId,
        financialInstallments: insts,
      }));
    }
  };

  const filteredProposals = proposals.filter((p) => {
    const proposalStatus = String(p.status || "").toUpperCase();
    const matchesMode = isSalesMode
      ? proposalStatus === "APPROVED" || proposalStatus === "INVOICED"
      : proposalStatus !== "APPROVED" && proposalStatus !== "INVOICED";

    if (!matchesMode) {
      return false;
    }

    const contactName = String(p.contact?.name || "").toLowerCase();
    return (
      contactName.includes(searchQuery.toLowerCase()) ||
      String(p.code || "").includes(searchQuery)
    );
  });

  if (isEditing) {
    // Tela de InclusÃ£o/EdiÃ§Ã£o PadrÃ£o Vencedor (Segundo Anexo)
    const productItems = formData.items;
    const totalItemsAmount = productItems.reduce(
      (acc: number, item: any) => acc + Number(item.total),
      0,
    );

    return (
      <div className="h-[calc(100vh-80px)] flex flex-col bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
        <div className="bg-slate-800/50 text-white px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-teal-400">
            Novo OrÃ§amento / Pedido
          </h2>
          <button
            onClick={() => setIsEditing(false)}
            className="text-slate-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-sm scrollbar-hide">
          {/* Top Panel - Info do Pedido */}
          <div className="bg-slate-800/80 border text-xs sm:text-sm border-slate-700/50 p-4 rounded-xl shadow-xl grid grid-cols-1 md:grid-cols-3 gap-6 relative overflow-hidden backdrop-blur-md">
            {/* Background Accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none"></div>
            
            {/* Linha 0: Fornecedor / Emissor (NOVO - ACIMA DO CLIENTE) */}
            <div className="md:col-span-3 flex flex-col gap-2 bg-slate-900/40 p-4 rounded-lg border border-slate-700/30">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
                <label className="font-bold text-slate-300 text-[10px] uppercase tracking-widest">
                  Fornecedor / Emissor da Venda
                </label>
              </div>
              <div className="flex-1 w-full relative z-[50] bg-slate-950/80 rounded-lg border border-slate-700/50 pointer-events-auto shadow-inner hover:border-purple-500/50 transition-all group">
                <ContactPickerGlobal
                  onAdd={async () => {}}
                  hideRole={true}
                  hideQualification={true}
                  showAction={false}
                  hideContactLabel={true}
                  onSelectContact={(id) =>
                    setFormData({ ...formData, sellerId: id })
                  }
                  defaultContact={defaultSeller}
                  className="!p-1 !bg-transparent !border-none !shadow-none"
                  placeholder="Selecione o Fornecedor/Vendedor..."
                />
              </div>
            </div>

            {/* Linha 1: Cliente (Destaque Total) */}
            <div className="md:col-span-3 flex flex-col gap-2 bg-slate-900/40 p-4 rounded-lg border border-slate-700/30">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-teal-500"></div>
                <label className="font-bold text-slate-300 text-[10px] uppercase tracking-widest">
                  Cliente / DestinatÃ¡rio
                </label>
              </div>
              <div className="flex-1 w-full relative z-[45] bg-slate-950/80 rounded-lg border border-slate-700/50 pointer-events-auto shadow-inner hover:border-teal-500/40 transition-all">
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
                    selectedProposal?.contact && formData.contactId === selectedProposal.contact.id
                      ? {
                          id: selectedProposal.contact.id,
                          name: selectedProposal.contact.name,
                          document: selectedProposal.contact.document,
                        }
                      : null
                  }
                  className="!p-1 !bg-transparent !border-none !shadow-none"
                  placeholder="Selecione o Cliente..."
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="font-semibold text-slate-400 w-20">
                Pedido:
              </label>
              <input
                className="border border-slate-700 bg-slate-950 text-white px-2 py-1 rounded w-full font-mono font-bold outline-none"
                disabled
                value={
                  selectedProposal
                    ? String(selectedProposal.code).padStart(6, "0")
                    : "NOVO"
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="font-semibold text-slate-400 w-20">
                Vendedor:
              </label>
              <div className="flex-1 w-full relative z-30">
                <CreatableSelect
                  options={users.map(u => ({ label: u.name, value: u.name }))}
                  value={formData.salesperson}
                  onChange={(val) => setFormData((prev: any) => ({ ...prev, salesperson: val }))}
                  placeholder="Vendedor..."
                  className="!bg-slate-950 font-medium"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="font-semibold text-slate-400 w-20">
                Entrega:
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
                Validade:
              </label>
              <input
                type="date"
                className="border border-slate-700 bg-slate-950 text-white px-2 py-1 rounded w-full outline-none"
                value={formData.validUntil}
                onChange={(e) =>
                  setFormData({ ...formData, validUntil: e.target.value })
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
            <div className="flex items-center gap-2 md:col-start-3">
              <input
                type="checkbox"
                id="especial"
                checked={formData.special}
                onChange={(e) =>
                  setFormData({ ...formData, special: e.target.checked })
                }
              />
              <label
                htmlFor="especial"
                className="font-semibold text-slate-400"
              >
                Especial
              </label>
            </div>
          </div>

          <div className="flex gap-4 flex-1 min-h-[300px]">
            {/* Left Side grids */}
            <div className="flex-1 flex flex-col gap-4">
              {/* Produtos */}
              <div className="flex-1 bg-slate-800/50 border border-slate-800 rounded shadow-sm flex flex-col">
                <div className="bg-slate-900 border-b border-slate-800 px-2 py-1 font-semibold text-slate-300 flex justify-between items-center">
                  Produtos / ServiÃ§os
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
                          Valor Un.
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
                            <div className="relative z-10">
                              <CreatableSelect 
                                value={item.productId}
                                onChange={(val) => handleItemChange(idx, "productId", val)}
                                options={products.map(p => ({ 
                                  label: p.name, 
                                  value: p.id, 
                                  description: `SKU: ${p.sku} | R$ ${p.sellPrice}` 
                                }))}
                                placeholder="Consultar produto..."
                                className="!bg-transparent border-none"
                              />
                            </div>
                          </td>
                          <td className="p-1 px-2 border-r border-slate-800">
                            <input
                              type="number"
                              className="w-full bg-transparent outline-none"
                              value={item.unitPrice}
                              onChange={(e) =>
                                handleItemChange(
                                  idx,
                                  "unitPrice",
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

              {/* ObservaÃ§Ãµes */}
              <div className="h-32 bg-slate-800/50 border border-slate-800 rounded shadow-sm flex flex-col">
                <div className="bg-slate-900 border-b border-slate-800 px-2 py-1 font-semibold text-slate-300">
                  ObservaÃ§Ãµes
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
              {/* Totais */}
              <div className="bg-teal-900/20 border border-teal-800/50 p-4 rounded shadow-sm flex flex-col gap-2">
                <div className="flex justify-between font-semibold text-slate-300">
                  <span>Soma dos Produtos:</span>
                  <span>R$ {totalItemsAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg text-teal-400 border-t border-teal-800/50 pt-2 mt-2">
                  <span>Valor Total:</span>
                  <span>R$ {totalItemsAmount.toFixed(2)}</span>
                </div>
              </div>
              {/* Instllments / Faturamento */}
              <div className="bg-teal-900/20 border border-teal-800/50 p-4 rounded shadow-sm flex flex-col gap-2">
                <h4 className="text-teal-400 font-semibold mb-2">
                  PrevisÃ£o Financeira
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
                    Nenhuma parcela. Valor serÃ¡ Ã  vista.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="bg-slate-900 border-t border-slate-800 p-3 flex justify-end gap-2">
          <button
            className="bg-slate-800 border border-slate-700 text-slate-300 px-4 py-2 font-medium flex items-center gap-2 rounded shadow-sm hover:bg-slate-700 transition-colors"
            onClick={() => setIsEditing(false)}
          >
            <X size={18} className="text-red-400" /> Cancelar (ESC)
          </button>
          <button
            className="bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 px-6 py-2 font-medium flex items-center gap-2 rounded shadow-sm transition-colors"
            onClick={() => handleSave(false)}
          >
            Salvar
          </button>
          <button
            className="bg-teal-600 border border-teal-700 text-white px-6 py-2 font-medium flex items-center gap-2 rounded shadow-sm hover:bg-teal-700 transition-colors"
            onClick={() => handleSave(true)}
          >
            <Check size={18} /> Salvar e Sair
          </button>
        </div>
      </div>
    );
  }

  // Tela de Grid Principal (Primeiro Anexo)
  return (
    <div className="h-[calc(100vh-80px)] flex flex-col bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
      <div className="bg-slate-800/50 text-white px-4 py-2 flex items-center justify-between border-b-2 border-teal-500">
        <h1 className="text-lg font-bold text-teal-400">{pageTitle}</h1>
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
            placeholder={searchPlaceholder}
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
                  Cliente
                </th>
              </tr>
            </thead>
            <tbody className="overflow-y-auto block h-full">
              {/*  Making only body scrollable is complex with simple table, but good enough for layout demo */}
            </tbody>
          </table>
          <div className="flex-1 overflow-y-auto w-full">
            <table className="w-full text-left text-sm table-fixed">
              <tbody>
                {filteredProposals.map((p) => (
                  <tr
                    key={p.id}
                    className={`cursor-pointer transition-colors ${selectedProposal?.id === p.id ? "bg-teal-600/20 text-teal-400 border-l-2 border-l-teal-500" : "text-slate-300 hover:bg-slate-800/50 border-b border-slate-800"}`}
                    onClick={() => loadProposalDetails(p.id)}
                    onDoubleClick={() => {
                      if (isSalesMode || p.status === "APPROVED") {
                        toast.info("OrÃƒÂ§amentos aprovados nÃƒÂ£o podem ser editados.");
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
          {selectedProposal ? (
            <>
              {/* Top Info Panel */}
              <div className="flex gap-4">
                <div className="flex-1 bg-slate-800/50 border border-slate-800 p-4 shadow-sm rounded-lg">
                  <h3 className="text-slate-400 font-semibold mb-3 pb-2 border-b border-slate-700 text-xs uppercase tracking-wider">
                    InformaÃ§Ãµes do Pedido/OrÃ§amento
                  </h3>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm text-white">
                    <div>
                      <span className="text-slate-500 mr-2">Data:</span>{" "}
                      {new Date(
                        selectedProposal.createdAt,
                      ).toLocaleDateString()}
                    </div>
                    <div>
                      <span className="text-slate-500 mr-2">Validade:</span>{" "}
                      {selectedProposal.validUntil
                        ? new Date(
                            selectedProposal.validUntil,
                          ).toLocaleDateString()
                        : "N/A"}
                    </div>
                    <div>
                      <span className="text-slate-500 mr-2">Valor Total:</span>{" "}
                      <span className="font-medium text-teal-400">
                        R$ {Number(selectedProposal.totalAmount).toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 mr-2">Status:</span>{" "}
                      <strong
                        className={
                          selectedProposal.status === "APPROVED"
                            ? "text-teal-400"
                            : "text-blue-400"
                        }
                      >
                        {selectedProposal.status}
                      </strong>
                    </div>
                    <div className="col-span-2 mt-1">
                      {selectedProposal.special && (
                        <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 text-xs rounded mr-2 font-bold">
                          Especial
                        </span>
                      )}
                      <span className="text-slate-500 mr-2">Cliente:</span>
                      <span className="font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                        {selectedProposal.contact?.name}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500 mr-2">Vendedor:</span>{" "}
                      {selectedProposal.salesperson || "N/A"}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 w-48">
                  {!isSalesMode && (
                    <button
                      className="bg-slate-800 hover:bg-slate-700 border border-slate-700 shadow-sm py-2 text-sm font-semibold text-slate-300 rounded transition-colors disabled:opacity-50"
                      onClick={() => handleApprove(selectedProposal.id)}
                      disabled={selectedProposal.status === "APPROVED"}
                    >
                      Aprovar (Faturar)
                    </button>
                  )}
                  {!isSalesMode && (
                    <button
                      className="bg-slate-800 hover:bg-slate-700 border border-slate-700 shadow-sm py-2 text-sm font-semibold text-slate-300 rounded transition-colors disabled:opacity-50"
                      onClick={() => {
                        if (selectedProposal.status === "APPROVED") {
                          toast.info("Orcamentos aprovados nao podem ser editados.");
                          return;
                        }
                        setIsEditing(true);
                      }}
                      disabled={selectedProposal.status === "APPROVED"}
                    >
                      Editar Orcamento
                    </button>
                  )}
                  {!isSalesMode && (
                    <button
                      className="bg-slate-800 hover:bg-red-900/40 border border-slate-700 hover:border-red-800 hover:text-red-400 shadow-sm py-2 text-sm font-semibold text-slate-300 rounded transition-colors"
                      onClick={() => handleDelete(selectedProposal.id)}
                    >
                      Excluir Orcamento
                    </button>
                  )}
                  <button 
                    onClick={() => printProposal(selectedProposal)}
                    className="bg-slate-800 hover:bg-slate-700 border border-slate-700 shadow-sm py-2 text-sm font-semibold text-slate-300 rounded transition-colors"
                  >
                    Imprimir OrÃ§amento
                  </button>
                  {selectedProposal.financialRecords && selectedProposal.financialRecords.length > 0 && (
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
                  Produtos / ServiÃ§os da Proposta
                </h3>
                <div className="p-0 overflow-auto flex-1">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-blue-600 text-white">
                      <tr>
                        <th className="px-3 py-2 border-b border-blue-800">
                          CÃ³digo
                        </th>
                        <th className="px-3 py-2 border-b border-blue-800">
                          DescriÃ§Ã£o
                        </th>
                        <th className="px-3 py-2 border-b border-blue-800 w-24 text-right">
                          Qtd
                        </th>
                        <th className="px-3 py-2 border-b border-blue-800 w-32 text-right">
                          Valor Un.
                        </th>
                        <th className="px-3 py-2 border-b border-blue-800 w-32 text-right">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-300">
                      {selectedProposal.items &&
                        selectedProposal.items.map((item: any) => (
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
                              R$ {Number(item.unitPrice).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-white">
                              R$ {Number(item.total).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      {(!selectedProposal.items ||
                        selectedProposal.items.length === 0) && (
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

              {/* Grids Bottom - Financeiro (Contas a Receber geradas) */}
              <div className="flex-[0.8] bg-slate-800/50 border border-slate-800 shadow-sm rounded-lg flex flex-col overflow-hidden">
                <h3 className="text-slate-400 font-semibold px-4 py-2 border-b border-slate-800 text-xs uppercase tracking-wider bg-slate-900/50 text-left">
                  TÃ­tulos a Receber (Financeiro)
                </h3>
                <div className="p-0 overflow-auto flex-1">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-blue-600 text-white">
                      <tr>
                        <th className="px-3 py-2 border-b border-blue-800">Parcela</th>
                        <th className="px-3 py-2 border-b border-blue-800">Vencimento</th>
                        <th className="px-3 py-2 border-b border-blue-800 text-right">Valor</th>
                        <th className="px-3 py-2 border-b border-blue-800 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-300">
                      {selectedProposal.financialRecords && selectedProposal.financialRecords.map((fin: any) => (
                          <tr
                            key={fin.id}
                            className="border-b border-slate-800 hover:bg-slate-800 transition-colors"
                          >
                            <td className="px-3 py-2 font-mono">
                              {fin.installmentNumber ? `${fin.installmentNumber}/${fin.totalInstallments || 1}` : 'Ãšnica'}
                            </td>
                            <td className="px-3 py-2">
                              {new Date(fin.dueDate).toLocaleDateString()}
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-white">
                              R$ {Number(fin.amount).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {fin.status === 'PENDING' ? (
                                <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded text-xs px-2">A Receber</span>
                              ) : fin.status === 'PAID' ? (
                                <span className="bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded text-xs px-2">Liquidado</span>
                              ) : (
                                <span className="bg-slate-500/10 text-slate-400 border border-slate-500/20 px-2 py-0.5 rounded text-xs px-2">{fin.status}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      {(!selectedProposal.financialRecords || selectedProposal.financialRecords.length === 0) && (
                        <tr>
                          <td colSpan={4} className="text-center p-8 text-slate-500">
                            {selectedProposal.status === 'APPROVED' 
                                ? 'Nenhum lanÃ§amento financeiro encontrado.'
                                : 'Contas a Receber serÃ£o geradas ao Aprovar este orÃ§amento.'}
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
              Selecione {selectedItemLabel} a esquerda para visualizar detalhes
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
        {!isSalesMode && (
          <button
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white px-5 py-1.5 font-medium text-sm rounded shadow-sm flex flex-col items-center transition-colors"
            onClick={handleNovaProposta}
          >
            <span>Incluir (F2)</span>
          </button>
        )}
        <button 
          onClick={() => printProposal(selectedProposal)}
          className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white px-5 py-1.5 font-medium text-sm rounded shadow-sm flex flex-col items-center transition-colors"
        >
          <span>Imprimir (F4)</span>
        </button>

        <div className="flex-1"></div>

        <button 
          onClick={() => window.history.back()}
          className="bg-slate-800 hover:bg-red-900/40 border border-slate-700 hover:border-red-800 text-slate-300 hover:text-red-400 px-5 py-1.5 font-medium text-sm rounded shadow-sm flex flex-col items-center transition-colors"
        >
          <span>Sair</span>
        </button>
      </div>
    </div>
  );
}

