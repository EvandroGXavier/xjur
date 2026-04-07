
import { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import { Search, Loader2, User, X } from 'lucide-react';
import { clsx } from 'clsx';

interface Contact {
    id: string;
    name: string;
    document?: string;
    email?: string;
}

interface ContactSelectInputProps {
    value: string;
    onChange: (name: string) => void;
    onSelectContact?: (contact: Contact | null) => void;
    placeholder?: string;
    className?: string;
}

export function ContactSelectInput({ 
    value, 
    onChange, 
    onSelectContact,
    placeholder = "Buscar responsável...",
    className
}: ContactSelectInputProps) {
    const [searchTerm, setSearchTerm] = useState(value || '');
    const [isSearching, setIsSearching] = useState(false);
    const [results, setResults] = useState<Contact[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setSearchTerm(value || '');
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!isOpen || searchTerm.length < 2) {
            setResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                setIsSearching(true);
                const res = await api.get(`/contacts?search=${encodeURIComponent(searchTerm)}`);
                const data = res.data?.data || res.data || [];
                setResults(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error('Erro na busca de contatos:', err);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchTerm, isOpen, value]);

    const handleSelect = (contact: Contact) => {
        onChange(contact.name);
        onSelectContact?.(contact);
        setSearchTerm(contact.name);
        setIsOpen(false);
        setResults([]);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearchTerm(val);
        onChange(val); // Permite manter como texto livre se desejar
        onSelectContact?.(null);
        if (!isOpen) setIsOpen(true);
    };

    return (
        <div className={clsx("relative", className)} ref={wrapperRef}>
            <div className="relative">
                <input 
                    type="text"
                    value={searchTerm}
                    onChange={handleInputChange}
                    onFocus={() => setIsOpen(true)}
                    placeholder={placeholder}
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 pl-9 text-white text-sm focus:border-indigo-500 outline-none transition"
                />
                <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
                
                {searchTerm && (
                    <button 
                        type="button"
                        onClick={() => {
                            setSearchTerm('');
                            onChange('');
                            onSelectContact?.(null);
                            setResults([]);
                        }}
                        className="absolute right-3 top-2.5 text-slate-500 hover:text-white"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>

            {isOpen && (results.length > 0 || isSearching) && (
                <div className="absolute z-50 w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-1">
                    {isSearching && results.length === 0 ? (
                        <div className="p-4 flex items-center justify-center gap-2 text-slate-500 text-xs">
                            <Loader2 size={14} className="animate-spin" />
                            Buscando...
                        </div>
                    ) : (
                        results.map(contact => (
                            <button
                                key={contact.id}
                                type="button"
                                onClick={() => handleSelect(contact)}
                                className="w-full text-left px-4 py-2 hover:bg-slate-800 flex items-center gap-3 group transition border-b border-slate-800 last:border-0"
                            >
                                <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500 group-hover:bg-indigo-500/20 group-hover:text-indigo-400 transition uppercase shrink-0">
                                    <User size={12} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-medium text-slate-200 group-hover:text-white transition truncate">{contact.name}</div>
                                    {contact.document && <div className="text-[10px] text-slate-500 font-mono truncate">{contact.document}</div>}
                                </div>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
