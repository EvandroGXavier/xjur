import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProcessoConfig } from "@/hooks/useProcessoConfig";
import { Loader2, ArrowLeft, Save, Brain, Zap, FileText, MessageSquare } from "lucide-react";
import { useForm } from "react-hook-form";

export default function ProcessoConfig() {
  const navigate = useNavigate();
  const { config, isLoading, saveConfig, isSaving } = useProcessoConfig();

  const form = useForm({
    defaultValues: {
      auto_capture: true,
      ai_summary: true,
      ai_deadlines: true,
      whatsapp_notif: false,
      status_padrao: config?.status_padrao || "ativo",
    }
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-[#001F3F]" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/processos')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-[#001F3F]">CIP: Central de Inteligência Processual</h1>
            <p className="text-muted-foreground text-sm">Ajuste o comportamento do cérebro DR.X para seus processos.</p>
          </div>
        </div>

        <Tabs defaultValue="ia" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-slate-100 p-1">
            <TabsTrigger value="ia" className="gap-2"><Brain className="h-4 w-4"/> IA & Captura</TabsTrigger>
            <TabsTrigger value="docs" className="gap-2"><FileText className="h-4 w-4"/> Modelos (DNA)</TabsTrigger>
            <TabsTrigger value="comms" className="gap-2"><MessageSquare className="h-4 w-4"/> WhatsApp</TabsTrigger>
          </TabsList>

          {/* ABA IA E CAPTURA */}
          <TabsContent value="ia" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Automação e Captura</CardTitle>
                <CardDescription>Como o DR.X deve monitorar os tribunais e processar arquivos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base font-semibold">Monitoramento Automático (DataJud/Crawler)</FormLabel>
                    <FormDescription>Buscar atualizações nos tribunais a cada 24h.</FormDescription>
                  </div>
                  <Switch checked={true} />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base font-semibold">Extração de Prazos via IA</FormLabel>
                    <FormDescription>Analisar intimações e sugerir datas na agenda automaticamente.</FormDescription>
                  </div>
                  <Switch checked={true} />
                </div>

                <div className="grid gap-4">
                    <FormLabel>Token API Tribunal (DataJud)</FormLabel>
                    <Input placeholder="Insira sua chave de acesso pública do CNJ" type="password" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA MODELOS/DNA */}
          <TabsContent value="docs" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>DNA do Caso (Fluxos Padrão)</CardTitle>
                <CardDescription>Defina o que acontece no momento em que um processo é aberto.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                 <div className="grid gap-4">
                    <FormLabel>Status Padrão de Entrada</FormLabel>
                    <Select defaultValue="ativo">
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="triagem">Triagem de IA</SelectItem>
                            <SelectItem value="ativo">Ativo</SelectItem>
                            <SelectItem value="urgente">Urgente</SelectItem>
                        </SelectContent>
                    </Select>
                 </div>

                 <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base font-semibold">Auto-Gerar Procuração</FormLabel>
                    <FormDescription>Criar rascunho na Biblioteca V2 assim que os dados forem capturados.</FormDescription>
                  </div>
                  <Switch checked={true} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA WHATSAPP */}
          <TabsContent value="comms" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Comunicação Automática</CardTitle>
                <CardDescription>Configura o que o cliente recebe no WhatsApp sobre o processo.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base font-semibold">Resumo de Movimentação para o Cliente</FormLabel>
                    <FormDescription>IA traduz o "juridiquês" e envia um zap automático ao cliente.</FormDescription>
                  </div>
                  <Switch />
                </div>

                <div className="grid gap-4">
                    <FormLabel>Tom da Voz da IA</FormLabel>
                    <Select defaultValue="didatico">
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="formal">Extremamente Formal</SelectItem>
                            <SelectItem value="didatico">Didático (Simples e Claro)</SelectItem>
                            <SelectItem value="curto">Apenas o Essencial</SelectItem>
                        </SelectContent>
                    </Select>
                 </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 pt-6 border-t">
          <Button variant="outline" onClick={() => navigate('/processos')}>Cancelar</Button>
          <Button className="bg-[#001F3F] hover:bg-[#003366] text-white">
            <Save className="mr-2 h-4 w-4" />
            Salvar Configurações Master
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
