
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Search } from 'lucide-react';

interface Option {
    label: string;
    value: string;
    description?: string; // Optional subtitle/info
}

interface CreatableSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: Option[];
    placeholder?: string;
    onCreate?: (newValue: string) => void;
    className?: string;
    label?: string;
}

export function CreatableSelect({ 
    value, 
    onChange, 
    options, 
    placeholder = 'Selecione ou digite...', 
    onCreate,
    className = '',
    label
}: CreatableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Initial load: if value exists, try to find label, else show value
    const selectedOption = options.find(o => o.value === value);
    const displayValue = selectedOption ? selectedOption.label : value;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = options.filter(o => 
        o.label.toLowerCase().includes(search.toLowerCase()) || 
        o.value.toLowerCase().includes(search.toLowerCase())
    );

    const handleSelect = (val: string) => {
        onChange(val);
        setIsOpen(false);
        setSearch('');
    };

    const handleCreate = () => {
        if (!search) return;
        // Check if exists case-insensitive
        const exists = options.find(o => o.value.toLowerCase() === search.toLowerCase());
        if (exists) {
            handleSelect(exists.value);
            return;
        }

        if (onCreate) {
            onCreate(search);
        }
        onChange(search); // Optimistically set value
        setIsOpen(false);
        setSearch('');
    };

    return (
        <div className={`relative ${className}`} ref={wrapperRef}>
            {label && <label className="block text-sm font-medium text-slate-400 mb-1">{label}</label>}
            
            {/* Trigger Button */}
            <div 
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white flex items-center justify-between cursor-pointer focus-within:border-indigo-500 transition hover:border-slate-700"
                onClick={() => {
                    setIsOpen(!isOpen);
                    // If opening, maybe clear or set search to current value? 
                    // Let's keep search empty to show all options initially
                }}
            >
                <div className="flex-1 truncate text-sm">
                    {displayValue || <span className="text-slate-500">{placeholder}</span>}
                </div>
                <ChevronDown size={16} className={`text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    
                    {/* Search Input */}
                    <div className="p-2 border-b border-slate-800 relative">
                        <Search className="absolute left-4 top-4.5 text-slate-500" size={14} />
                        <input 
                            autoFocus
                            className="w-full bg-slate-950 border border-slate-800 rounded-md py-1.5 pl-8 pr-3 text-sm text-white focus:outline-none focus:border-indigo-500 lowercase-placeholder"
                            placeholder="Filtrar ou criar novo..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleCreate();
                                }
                            }}
                        />
                    </div>

                    {/* Options List */}
                    <div className="max-h-60 overflow-y-auto">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt) => (
                                <div 
                                    key={opt.value}
                                    onClick={() => handleSelect(opt.value)}
                                    className={`px-3 py-2 text-sm hover:bg-slate-800 cursor-pointer flex flex-col ${value === opt.value ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-300'}`}
                                >
                                    <span className="font-medium">{opt.label}</span>
                                    {opt.description && <span className="text-xs text-slate-500">{opt.description}</span>}
                                </div>
                            ))
                        ) : (
                            <div className="px-3 py-4 text-center text-slate-500 text-sm">
                                {search ? (
                                    <button 
                                        onClick={handleCreate}
                                        className="w-full py-2 bg-indigo-600/20 text-indigo-400 rounded hover:bg-indigo-600/30 transition flex items-center justify-center gap-2"
                                    >
                                        <Plus size={14} />
                                        Criar "{search}"
                                    </button>
                                ) : (
                                    <span>Nenhuma opção encontrada</span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
