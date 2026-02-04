import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, DollarSign, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function Financial() {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    api.get('/financial/dashboard').then(res => setData(res.data)).catch(console.error);
  }, []);

  return (
      <AppLayout>
          <PageHeader title="Financeiro" description="Controle de Honorários e Contas">
              <Button onClick={() => navigate('/financial/new')} className="bg-[#001F3F]">
                <Plus className="mr-2 h-4 w-4" />
                Nova Conta
              </Button>
          </PageHeader>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Saldo Total</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                        {data ? `R$ ${Number(data.totalBalance).toFixed(2)}` : '...'}
                    </div>
                  </CardContent>
              </Card>
              
              <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Contas</CardTitle>
                    <div className="text-sm text-muted-foreground">{data?.accounts?.length || 0}</div>
                  </CardHeader>
                  <CardContent>
                      <div className="text-xs text-muted-foreground">Contas Bancárias cadastradas</div>
                  </CardContent>
              </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <Card>
                <CardHeader><CardTitle>Contas Bancárias</CardTitle></CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {data?.accounts?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada.</p>}
                        {data?.accounts?.map((acc: any) => (
                            <div key={acc.id} className="flex justify-between items-center border-b pb-2">
                                <div>
                                    <p className="font-medium">{acc.name}</p>
                                    <p className="text-xs text-muted-foreground">Inicial: R$ {acc.initialBalance}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold">R$ {Number(acc.balance).toFixed(2)}</p>
                                    <div className="flex gap-2 text-xs">
                                        <span className="text-green-600">+{Number(acc.income).toFixed(2)}</span>
                                        <span className="text-red-600">-{Number(acc.expense).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
             </Card>

             <Card>
                <CardHeader><CardTitle>Últimas Movimentações</CardTitle></CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {data?.recentTransactions?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma movimentação.</p>}
                        {data?.recentTransactions?.map((trx: any) => (
                            <div key={trx.id} className="flex justify-between items-center border-b pb-2">
                                <div className="flex items-center gap-2">
                                    {trx.type === 'INCOME' ? <ArrowUpCircle className="text-green-500 h-4 w-4"/> : <ArrowDownCircle className="text-red-500 h-4 w-4"/>}
                                    <div>
                                        <p className="font-medium">{trx.description}</p>
                                        <p className="text-xs text-muted-foreground">{trx.category?.name || 'Sem Categoria'}</p>
                                    </div>
                                </div>
                                <span className={trx.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}>
                                    {trx.type === 'INCOME' ? '+' : '-'} R$ {Number(trx.amount).toFixed(2)}
                                </span>
                            </div>
                        ))}
                    </div>
                </CardContent>
             </Card>
          </div>
      </AppLayout>
  )
}
