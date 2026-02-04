import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { FinancialTransactionForm } from "@/components/financeiro/FinancialTransactionForm";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export function FinancialNew() {
    const navigate = useNavigate();

    return (
        <AppLayout>
            <PageHeader title="Nova Conta" description="Lançamento de Receita ou Despesa">
                 <Button variant="ghost" onClick={() => navigate('/financial')}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar
                 </Button>
            </PageHeader>
            <div className="max-w-3xl mx-auto">
                <FinancialTransactionForm />
            </div>
        </AppLayout>
    )
}
