import { useContextualConfig } from "@/hooks/useContextualConfig";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode; 
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  const { ConfigButton } = useContextualConfig();

  return (
    <div className="flex items-center justify-between pb-6 border-b mb-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-[#001F3F]">{title}</h1>
        {description && <p className="text-sm text-muted-foreground text-[#777777]">{description}</p>}
      </div>
      
      <div className="flex items-center gap-2">
         {/* Contextual Config Button (F8) */}
         <ConfigButton />

         {/* Additional Buttons (e.g. New Record) */}
         {children}
      </div>
    </div>
  );
}
