import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { X, HelpCircle, FileText, ShoppingCart, Box, TrendingUp, DollarSign } from "lucide-react";

export function InventoryHelpModal() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + F1
      if (e.ctrlKey && e.key === "F1") {
        e.preventDefault();
        // Apenas mostrar se estiver no módulo de estoque
        if (location.pathname.startsWith("/inventory")) {
          setIsOpen((prev) => !prev);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [location.pathname]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-slate-900 border border-teal-500/30 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-5">
        
        {/* Header */}
        <div className="bg-slate-800 border-b border-slate-700 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-teal-500/20 p-2 rounded-lg text-teal-400">
              <HelpCircle size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Central de Ajuda - Estoque & Comercial</h2>
              <p className="text-sm text-slate-400">Guia rápido de uso, atalhos e boas práticas.</p>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="text-slate-400 hover:text-white hover:bg-slate-700 p-2 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* Section: Navegação e Onde Estou */}
          <section className="space-y-4">
            <h3 className="text-lg font-bold text-teal-400 border-b border-slate-800 pb-2 flex items-center gap-2">
              <TrendingUp size={20} /> Como Navegar no Módulo
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
                <div className="flex items-center gap-2 text-white font-semibold mb-2">
                  <Box className="text-blue-400" size={18} /> Cadastros Rápidos (Catálogo)
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Acesse <strong>Produtos / Catálogo</strong> no menu lateral para registrar serviços ou mercadorias. Lá você define nomes, preços base e categorias.
                </p>
              </div>
              <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
                <div className="flex items-center gap-2 text-white font-semibold mb-2">
                  <ShoppingCart className="text-purple-400" size={18} /> Compras / Entradas (XML)
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Acesse <strong>Compras</strong> para registrar notas de entrada ou arrastar um XML. O sistema cadastra o fornecedor, os produtos, movimenta o estoque para cima (+) e já gera os títulos no Financeiro a Pagar.
                </p>
              </div>
              <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
                <div className="flex items-center gap-2 text-white font-semibold mb-2">
                  <FileText className="text-emerald-400" size={18} /> Orçamentos / Pedidos
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Acesse <strong>Orçamentos</strong> para gerar vendas. Crie propostas em segundos. E, ao clicar em "Aprovar (Faturar)", o sistema movimenta o estoque para baixo (-) e gera os títulos no Financeiro a Receber.
                </p>
              </div>
              <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
                <div className="flex items-center gap-2 text-white font-semibold mb-2">
                  <DollarSign className="text-amber-400" size={18} /> Faturamento e Financeiro
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Tudo que nasce no Estoque impacta o <strong>Financeiro</strong>. Toda ação é listada nos detalhes (quadrantes "Títulos a Pagar/Receber"). Excluir um pedido Aprovado faz o estorno reverso automático!
                </p>
              </div>
            </div>
          </section>

          {/* Section: Atalhos */}
          <section className="space-y-4">
            <h3 className="text-lg font-bold text-teal-400 border-b border-slate-800 pb-2">
              ⌨️ Atalhos de Alta Produtividade
            </h3>
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-sm">
              <ul className="space-y-3">
                <li className="flex items-center gap-4">
                  <kbd className="bg-slate-800 border border-slate-700 px-2 py-1 rounded text-teal-300">F2 / Numpad +</kbd>
                  <span className="text-slate-300">Novo Registro (Abre painel de inclusões instantaneamente).</span>
                </li>
                <li className="flex items-center gap-4">
                  <kbd className="bg-slate-800 border border-slate-700 px-2 py-1 rounded text-teal-300">ESC</kbd>
                  <span className="text-slate-300">Fecha painéis, modais e formulários sem salvar alterações.</span>
                </li>
                <li className="flex items-center gap-4">
                  <kbd className="bg-slate-800 border border-slate-700 px-2 py-1 rounded text-teal-300"><span className="text-xs">Duplo Clique</span></kbd>
                  <span className="text-slate-300">Edição instantânea no item direto da tabela.</span>
                </li>
                <li className="flex items-center gap-4">
                  <kbd className="bg-slate-800 border border-slate-700 px-2 py-1 rounded text-teal-300">F4</kbd>
                  <span className="text-slate-300">Impressão Rápida (Abre e já seleciona a janela de impressão aplicável).</span>
                </li>
                <li className="flex items-center gap-4">
                  <kbd className="bg-slate-800 border border-slate-700 px-2 py-1 rounded text-teal-300">Ctrl + F1</kbd>
                  <span className="text-slate-300">Abre esta Central de Ajuda.</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Section: Dicas */}
          <section className="space-y-4">
            <h3 className="text-lg font-bold text-teal-400 border-b border-slate-800 pb-2">
              💡 Dicas e Segurança
            </h3>
            <ul className="list-disc list-inside text-slate-300 space-y-2 text-sm leading-relaxed">
              <li>A <strong className="text-white">Trava Financeira</strong> do sistema não permitirá que você salve um Orçamento (ou Compra) se a soma das parcelas diferir do Total dos Produtos.</li>
              <li>Sua importação de <strong>NF-e (XML)</strong> inteligente também cadastra automaticamente o transporte e tributos no plano de fundo.</li>
              <li>Acesse a engrenagem no Dashboard de Estoque para configurar a sua <strong>Margem de Lucro Padrão (%)</strong>. O sistema usará isso para re-precificar sozinho produtos carregados na entrada de nota XML.</li>
            </ul>
          </section>

        </div>

        {/* Footer */}
        <div className="bg-slate-900 border-t border-slate-800 p-4 flex justify-between items-center text-xs font-medium text-slate-500">
          <span>Pressione <kbd className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-slate-400">ESC</kbd> para sair</span>
          <button 
            onClick={() => setIsOpen(false)}
            className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2 rounded transition-colors"
          >
            Entendi
          </button>
        </div>

      </div>
    </div>
  );
}
