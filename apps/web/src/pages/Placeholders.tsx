
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";

export function Financial() {
  return (
    <AppLayout>
        <PageHeader title="Financeiro" description="Controle de Honorários e Despesas" />
        <div className="p-4 border rounded bg-white">
            <p>Módulo Financeiro em construção...</p>
        </div>
    </AppLayout>
  );
}

export function Clients() {
    return (
        <AppLayout>
            <PageHeader title="Clientes" description="Base de Contatos" />
            <div className="p-4 border rounded bg-white">
                <p>Base de Clientes em construção...</p>
            </div>
        </AppLayout>
    );
}
  
export function AI() {
    return (
        <AppLayout>
            <PageHeader title="Inteligência Artificial" description="Status da Neural Engine do Dr.X" />
            <div className="p-4 border rounded bg-white">
                <p>Monitor de IA em construção...</p>
            </div>
        </AppLayout>
    );
}
