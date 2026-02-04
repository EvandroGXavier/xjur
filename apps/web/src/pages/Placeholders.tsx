
<<<<<<< HEAD
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
=======


export function Processes() {
  return <div className="p-4"><h1 className="text-2xl font-bold mb-4">Processos</h1><p>Gestão de Processos em construção...</p></div>;
}

export function Clients() {
    return <div className="p-4"><h1 className="text-2xl font-bold mb-4">Clientes</h1><p>Base de Clientes em construção...</p></div>;
}
  
export function AI() {
    return <div className="p-4"><h1 className="text-2xl font-bold mb-4">Inteligência Artificial</h1><p>Configurações de IA em construção...</p></div>;
>>>>>>> f67fa9245bfe51c68d57fe11522543ec186b9f69
}
