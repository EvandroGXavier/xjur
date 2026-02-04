import { Button } from "@/components/ui/button";

export function ProcessosDataTable({ onCreateNew, tagFilters }: any) {
  return (
    <div className="p-4 border rounded-md bg-white">
      <div className="mb-4 flex justify-between">
        <h2 className="text-lg font-bold">Processos (Lista)</h2>
      </div>
      <div className="h-64 flex items-center justify-center text-gray-500 border-2 border-dashed rounded">
        <span>Tabela de Processos (Stub). Filtros: {JSON.stringify(tagFilters)}</span>
      </div>
    </div>
  );
}
