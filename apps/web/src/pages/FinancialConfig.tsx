import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import { api } from "@/services/api";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function FinancialConfig() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [contacts, setContacts] = useState<any[]>([]);

    const form = useForm({
        defaultValues: {
            defaultOfficeContactId: ""
        }
    });

    useEffect(() => {
        api.get('/contacts').then(res => setContacts(Array.isArray(res.data) ? res.data : res.data.data)).catch(console.error);
        api.get('/financial/settings').then(res => {
            if (res.data) {
                form.reset(res.data);
            }
        });
    }, [form]);

    async function onSubmit(data: any) {
        setIsLoading(true);
        try {
            // Need tenantId... but backend usually extracts from token or we pass existing data logic
            // Assuming endpoint handles it based on Context or we send just updates
             await api.put('/financial/settings', {
                 ...data,
                 tenantId: '?' // Need to handle tenantId on frontend? 
                 // Usually tenantId is in the User Context/Token. 
                 // My Controller creates settings if not exist using tenantId query param or auth.
                 // Ideally frontend shouldn't manage tenantId explicitly if auth is there.
                 // But for this environment, I might need to ensure backend gets it.
             });
             alert("Configurações salvas!");
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar");
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <AppLayout>
            <PageHeader title="Configurações Financeiras" description="Ajustes do Módulo Financeiro">
                <Button variant="outline" onClick={() => navigate('/financial')}>Voltar</Button>
            </PageHeader>

            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle>Padrões de Lançamento</CardTitle>
                    <CardDescription>Defina quem é o escritório para agilizar os lançamentos de Crédito/Débito.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="defaultOfficeContactId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Contato do Escritório (Você)</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value || ""}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione..." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {contacts.map(c => (
                                                    <SelectItem key={c.id} value={c.id}>{c.name || c.nome_fantasia}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" disabled={isLoading} className="bg-[#001F3F]">
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salvar
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </AppLayout>
    )
}
