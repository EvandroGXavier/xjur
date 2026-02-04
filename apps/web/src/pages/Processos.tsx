import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProcessosDataTable } from "@/components/processos/ProcessosDataTable";
import { TagFilter } from "@/components/etiquetas/TagFilter";
import { ProcessoKanbanView } from "@/components/processos/kanban/ProcessoKanbanView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, List, LayoutDashboard } from "lucide-react";
import { useState } from "react";

export default function Processos() {
  const navigate = useNavigate();
  const [comTags, setComTags] = useState<string[]>([]);
  const [semTags, setSemTags] = useState<string[]>([]);

  // Removed manual F8 listener and header logic, replaced with PageHeader

  const handleCreateNew = () => {
    navigate("/processos/novo");
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        
        <PageHeader 
            title="Processos" 
            description="Gestão jurídica assistida por IA"
        >
            <Button onClick={handleCreateNew} className="bg-[#001F3F] hover:bg-[#003366]">
              <Plus className="mr-2 h-4 w-4" />
              Novo Processo
            </Button>
        </PageHeader>

        <Tabs defaultValue="lista" className="space-y-4">
          <TabsList className="bg-[#f4f4f5] border-b">
            <TabsTrigger value="lista" className="gap-2">
              <List className="h-4 w-4" />
              Lista
            </TabsTrigger>
            <TabsTrigger value="kanban" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Kanban
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="lista" className="space-y-4">
            <TagFilter
              value=""
              onChange={() => {}}
              comTags={comTags}
              semTags={semTags}
              onComTagsChange={setComTags}
              onSemTagsChange={setSemTags}
            />
            <ProcessosDataTable 
              onCreateNew={handleCreateNew} 
              tagFilters={{ comTags, semTags }}
            />
          </TabsContent>
          
          <TabsContent value="kanban">
            <ProcessoKanbanView />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
