import { Layout } from "@/components/Layout";

export function AppLayout({ children }: { children: React.ReactNode }) {
  // Use the existing global layout. 
  // However, the existing Layout component uses <Outlet /> to render content.
  // If we wrap `children` here, we are assuming AppLayout is used *inside* the route that uses Layout,
  // OR we are reusing the sidebar structure.
  
  // Since App.tsx routes "/" to Layout, and Processos is a child route, 
  // Processos is ALREADY inside Layout.
  // So AppLayout might just be a wrapper for consistent padding/styling for Pages.
  
  return (
    <div className="fade-in">
       {children}
    </div>
  );
}
