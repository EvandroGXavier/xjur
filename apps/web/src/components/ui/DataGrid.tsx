
import { useState } from 'react';
import { ArrowUp, ArrowDown, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight, MoreHorizontal, Check } from 'lucide-react';

interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
}

interface DataGridProps<T> {
  data: T[];
  columns: Column<T>[];
  pageSize?: number;
  totalItems?: number;
  isLoading?: boolean;
  onSort?: (field: string, direction: 'asc' | 'desc') => void;
  onPageChange?: (page: number) => void;
  onSelect?: (selectedIds: string[]) => void;
}

export function DataGrid<T extends { id: string }>({ 
  data, 
  columns, 
  pageSize = 10,
  totalItems = 0,
  isLoading = false,
  onSort,
  onPageChange,
  onSelect
}: DataGridProps<T>) {

  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortField === key) {
      direction = sortDirection === 'asc' ? 'desc' : 'asc';
    }
    setSortField(key);
    setSortDirection(direction);
    onSort?.(key, direction);
  };

  const handleSelectAll = (checked: boolean) => {
    const ids = checked ? data.map(d => d.id) : [];
    setSelectedIds(ids);
    onSelect?.(ids);
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    let newSelected = [...selectedIds];
    if (checked) {
      newSelected.push(id);
    } else {
      newSelected = newSelected.filter(sid => sid !== id);
    }
    setSelectedIds(newSelected);
    onSelect?.(newSelected);
  };

  // Pagination Logic
  const totalPages = Math.ceil(totalItems / pageSize);
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col h-full shadow-lg">
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-sm text-slate-400">
          <thead className="bg-slate-950 text-slate-300 font-medium sticky top-0 z-10 shadow-sm border-b border-slate-800">
            <tr>
              {/* Checkbox Column */}
              <th className="px-6 py-4 w-12">
                <input 
                  type="checkbox" 
                  className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500/20"
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  checked={data.length > 0 && selectedIds.length === data.length}
                />
              </th>
              
              {/* Data Columns */}
              {columns.map((col) => (
                <th 
                  key={col.key} 
                  className={`px-6 py-4 cursor-pointer hover:text-white transition-colors group select-none ${col.sortable ? '' : 'cursor-defaultPointerEventsNone'}`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center gap-2">
                    {col.label}
                    {col.sortable && sortField === col.key && (
                      sortDirection === 'asc' ? <ArrowUp size={14} className="text-indigo-400 animate-in slide-in-from-bottom-1" /> : <ArrowDown size={14} className="text-indigo-400 animate-in slide-in-from-top-1" />
                    )}
                  </div>
                </th>
              ))}
              
              {/* End Data Columns */}
            </tr>
          </thead>
          
          <tbody className="divide-y divide-slate-800/50">
            {isLoading ? (
              [...Array(pageSize)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={columns.length + 1} className="px-6 py-4">
                    <div className="h-4 bg-slate-800 rounded w-full opacity-50"></div>
                  </td>
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-6 py-12 text-center text-slate-500">
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr 
                  key={item.id} 
                  className={`hover:bg-slate-800/30 transition-colors group ${selectedIds.includes(item.id) ? 'bg-indigo-500/5' : ''}`}
                >
                  <td className="px-6 py-4">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500/20"
                      checked={selectedIds.includes(item.id)}
                      onChange={(e) => handleSelectOne(item.id, e.target.checked)}
                    />
                  </td>
                  
                  {columns.map((col) => (
                    <td key={col.key} className="px-6 py-4 text-white font-medium">
                      {col.render ? col.render(item) : (item as any)[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="bg-slate-950 border-t border-slate-800 p-4 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-400 select-none">
        
        {/* Page Size Selector */}
        <div className="flex items-center gap-2">
            <span>Mostrar</span>
            <select 
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white focus:outline-none focus:border-indigo-500"
                value={pageSize}
                onChange={(e) => {/* Callback for page size change not implemented in this simplified grid */}}
            >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
            </select>
            <span>por página</span>
        </div>

        {/* Pagination Info */}
        <div className="flex items-center gap-4">
            <span>
                {startItem}-{endItem} de {totalItems}
            </span>
            
            <div className="flex items-center gap-1">
                <button 
                    disabled={currentPage === 1}
                    onClick={() => {
                        const newPage = Math.max(1, currentPage - 1);
                        setCurrentPage(newPage);
                        onPageChange?.(newPage);
                    }}
                    className="p-1 rounded hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <ChevronLeft size={18} />
                </button>
                
                {/* Simplified Page Numbers */}
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                    // Logic to show pages around current page could be complex, simplifying for MVP
                    const pageNum = i + 1; 
                    return (
                        <button
                            key={pageNum}
                            onClick={() => {
                                setCurrentPage(pageNum);
                                onPageChange?.(pageNum);
                            }}
                            className={`w-8 h-8 rounded flex items-center justify-center font-medium transition-colors ${
                                currentPage === pageNum 
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                                    : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                        >
                            {pageNum}
                        </button>
                    );
                })}

                <button 
                    disabled={currentPage === totalPages}
                     onClick={() => {
                        const newPage = Math.min(totalPages, currentPage + 1);
                        setCurrentPage(newPage);
                        onPageChange?.(newPage);
                    }}
                    className="p-1 rounded hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <ChevronRight size={18} />
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}
