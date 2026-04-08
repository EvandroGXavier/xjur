import { useState } from "react";
import {
  Package,
  ShoppingCart,
  FileText,
  Receipt,
  LayoutDashboard,
  Landmark,
  ClipboardList,
} from "lucide-react";
import { clsx } from "clsx";
import { InventoryDashboard } from "./InventoryDashboard";
import { ProductsList } from "../products/ProductsList";
import { ProposalsPage } from "./ProposalsPage";
import { PurchasesPage } from "./PurchasesPage";
import { FiscalPage } from "./FiscalPage";

export function Inventory() {
  const [view, setView] = useState<
    | "dashboard"
    | "products"
    | "proposals"
    | "sales"
    | "quotes"
    | "purchases"
    | "fiscal"
  >("dashboard");

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-600/20 rounded-lg flex items-center justify-center text-teal-400 border border-teal-600/30">
            <Package size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Estoque</h1>
            <p className="text-slate-500 text-xs">
              Gestao de produtos, suprimentos, compras e vendas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 w-full sm:w-auto overflow-x-auto no-scrollbar">
          <button
            onClick={() => setView("dashboard")}
            className={clsx(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap",
              view === "dashboard"
                ? "bg-teal-600 text-white shadow-lg shadow-teal-900/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800",
            )}
          >
            <LayoutDashboard size={16} />
            Dashboard
          </button>
          <button
            onClick={() => setView("products")}
            className={clsx(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap",
              view === "products"
                ? "bg-teal-600 text-white shadow-lg shadow-teal-900/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800",
            )}
          >
            <Package size={16} />
            Produtos
          </button>
          <button
            onClick={() => setView("proposals")}
            className={clsx(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap",
              view === "proposals"
                ? "bg-teal-600 text-white shadow-lg shadow-teal-900/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800",
            )}
          >
            <FileText size={16} />
            Orcamentos
          </button>
          <button
            onClick={() => setView("sales")}
            className={clsx(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap",
              view === "sales"
                ? "bg-teal-600 text-white shadow-lg shadow-teal-900/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800",
            )}
          >
            <Landmark size={16} />
            Vendas
          </button>
          <button
            onClick={() => setView("quotes")}
            className={clsx(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap",
              view === "quotes"
                ? "bg-teal-600 text-white shadow-lg shadow-teal-900/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800",
            )}
          >
            <ClipboardList size={16} />
            Cotacao
          </button>
          <button
            onClick={() => setView("purchases")}
            className={clsx(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap",
              view === "purchases"
                ? "bg-teal-600 text-white shadow-lg shadow-teal-900/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800",
            )}
          >
            <ShoppingCart size={16} />
            Compras
          </button>
          <button
            onClick={() => setView("fiscal")}
            className={clsx(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap",
              view === "fiscal"
                ? "bg-teal-600 text-white shadow-lg shadow-teal-900/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800",
            )}
          >
            <Receipt size={16} />
            Fiscal
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {view === "dashboard" && <InventoryDashboard />}
        {view === "products" && <ProductsList />}
        {view === "proposals" && <ProposalsPage mode="open" />}
        {view === "sales" && <ProposalsPage mode="approved" />}
        {view === "quotes" && <PurchasesPage mode="quotation" />}
        {view === "purchases" && <PurchasesPage mode="received" />}
        {view === "fiscal" && <FiscalPage />}
      </div>
    </div>
  );
}
