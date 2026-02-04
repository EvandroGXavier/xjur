import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { api } from "@/services/api";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface TransactionFormDetails {
  description: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  dueDate: string;
  bankAccountId: string;
  categoryId: string;
  creditorId: string;
  debtorId: string;
  
  // Advanced
  isRecurring?: boolean;
  frequency?: "MONTHLY" | "WEEKLY" | "YEARLY";
  dayOfMonth?: number;
  
  isInstallment?: boolean;
  totalInstallments?: number;
  
  interest?: number;
  fine?: number;
  discount?: number;
}

export function FinancialTransactionForm() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);

  const form = useForm<TransactionFormDetails>({
    defaultValues: {
      description: "",
      amount: 0,
      type: "EXPENSE",
      dueDate: new Date().toISOString().split('T')[0],
      bankAccountId: "",
      categoryId: "",
      creditorId: "",
      debtorId: "",
      isRecurring: false,
      isInstallment: false,
      totalInstallments: 1
    }
  });

  const type = form.watch("type");
  const isRecurring = form.watch("isRecurring");
  const isInstallment = form.watch("isInstallment");

  // Load Data
  useEffect(() => {
    async function loadData() {
      try {
        const [accRes, catRes, setRes, contRes] = await Promise.all([
          api.get('/financial/accounts'),
          api.get('/financial/categories'),
          api.get('/financial/settings'),
          api.get('/contacts')
        ]);

        setAccounts(accRes.data || []);
        setCategories(catRes.data || []);
        setSettings(setRes.data || {});
        // Adjust for potential pagination structure
        setContacts(Array.isArray(contRes.data) ? contRes.data : contRes.data.data || []); 

      } catch (error) {
        console.error("Failed to load financial data", error);
      }
    }
    loadData();
  }, []);

  // Update logic: Creditor/Debtor defaults
  useEffect(() => {
    if (!settings) return;
    
    const officeContactId = settings.defaultOfficeContactId;

    if (type === "EXPENSE") {
       if (officeContactId) form.setValue("debtorId", officeContactId);
       form.setValue("creditorId", "");
    } else {
       if (officeContactId) form.setValue("creditorId", officeContactId);
       form.setValue("debtorId", "");
    }
  }, [type, settings, form]);

  async function onSubmit(data: TransactionFormDetails) {
    setIsLoading(true);
    try {
      // Ensure IDs are null if empty string
      const payload = {
          ...data,
          bankAccountId: data.bankAccountId || null,
          processId: null, // Optional
          status: "PENDING"
      };

      await api.post('/financial/transactions', payload);
      navigate('/financial');
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar movimentação");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            {/* TYPE & AMOUNT */}
            <div className="grid grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        <SelectItem value="INCOME">Receita</SelectItem>
                        <SelectItem value="EXPENSE">Despesa</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />

                <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Valor (R$)</FormLabel>
                    <FormControl>
                        <Input type="number" step="0.01" {...field} onChange={e => field.onChange(Number(e.target.value))} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>

            {/* DESCRIPTION */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Ex: Pagamento Energia" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ACCOUNT & CATEGORY */}
            <div className="grid grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="bankAccountId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Conta Bancária</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {accounts.map(acc => (
                            <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />

                <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {categories.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>

            {/* PARTIES */}
            <div className="grid grid-cols-2 gap-4 p-4 border rounded bg-slate-50">
               <FormField
                control={form.control}
                name="creditorId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Credor (Quem recebe)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {contacts.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name || c.nome_fantasia || "Sem Nome"}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />

               <FormField
                control={form.control}
                name="debtorId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Devedor (Quem paga)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {contacts.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name || c.nome_fantasia || "Sem Nome"}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>

            {/* === ADVANCED OPTIONS GRID === */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border rounded-lg bg-slate-50">
               {/* 1. RECURRENCE */}
               <div className="space-y-4">
                  <div className="flex items-center justify-between">
                      <FormLabel className="text-base font-semibold">Despesa Recorrente?</FormLabel>
                      <FormField
                        control={form.control}
                        name="isRecurring"
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                            </FormItem>
                        )}
                      />
                  </div>
                  {isRecurring && (
                      <div className="grid grid-cols-2 gap-2">
                          <FormField
                            control={form.control}
                            name="frequency"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Frequência</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="MONTHLY">Mensal</SelectItem>
                                            <SelectItem value="WEEKLY">Semanal</SelectItem>
                                            <SelectItem value="YEARLY">Anual</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                          />
                           <FormField
                            control={form.control}
                            name="dayOfMonth"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Dia Venc.</FormLabel>
                                    <FormControl><Input type="number" min="1" max="31" {...field} onChange={e => field.onChange(Number(e.target.value))}/></FormControl>
                                </FormItem>
                            )}
                          />
                      </div>
                  )}
               </div>

               {/* 2. INSTALLMENTS */}
               <div className="space-y-4 border-l pl-4">
                   <div className="flex items-center justify-between">
                      <FormLabel className="text-base font-semibold">Parcelado?</FormLabel>
                      <FormField
                        control={form.control}
                        name="isInstallment"
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                            </FormItem>
                        )}
                      />
                  </div>
                  {isInstallment && (
                      <FormField
                        control={form.control}
                        name="totalInstallments"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Número de Parcelas</FormLabel>
                                <FormControl>
                                    <Input type="number" min="2" {...field} onChange={e => field.onChange(Number(e.target.value))} />
                                </FormControl>
                                <FormDescription>O valor total será dividido.</FormDescription>
                            </FormItem>
                        )}
                      />
                  )}
               </div>
            </div>

            {/* 3. ADJUSTMENTS */}
            <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="interest"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Juros (R$)</FormLabel>
                      <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl>
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="fine"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Multa (R$)</FormLabel>
                      <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl>
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="discount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Desconto (R$)</FormLabel>
                      <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl>
                    </FormItem>
                  )}
                />
            </div>

            {/* DUE DATE */}
            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data Vencimento {isInstallment ? '(1ª Parcela)' : ''}</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => navigate('/financial')}>Cancelar</Button>
                <Button type="submit" disabled={isLoading} className="bg-[#001F3F]">
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar Conta
                </Button>
            </div>

          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
