import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
// Stubs for missing components to ensure it compiles
const StatsCards = () => <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"><div className="p-4 bg-white border rounded">Stats Stub</div></div>;
const RecentProcesses = () => <div className="p-4 bg-white border rounded">Recent Processes Stub</div>;
const QuickActions = () => <div className="flex gap-2 mb-4"><button className="p-2 border rounded">Action Stub</button></div>;
const UpcomingDeadlines = () => <div className="p-4 bg-white border rounded">Deadlines Stub</div>;

export function Dashboard() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader 
            title="Painel de Controle" 
            description="Visão geral do escritório em tempo real."
        />

        <StatsCards />

        <QuickActions />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
          <div className="col-span-4">
            <RecentProcesses />
          </div>
          <div className="col-span-3">
            <UpcomingDeadlines />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
