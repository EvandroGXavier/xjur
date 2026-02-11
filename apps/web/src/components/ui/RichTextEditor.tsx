
import { useState, useRef, useEffect } from 'react';
import { 
    Bold, Italic, Underline, 
    AlignLeft, AlignCenter, AlignRight, 
    List, ListOrdered, 
    Heading1, Heading2, 
    Type, Copy
} from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '../../services/api';

interface RichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    showVariables?: boolean;
}

export function RichTextEditor({ value, onChange, placeholder, showVariables = true }: RichTextEditorProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const [variables, setVariables] = useState<any>(null);

    useEffect(() => {
        if (showVariables) {
            api.get('/documents/variables').then(res => setVariables(res.data)).catch(console.error);
        }
    }, [showVariables]);

    // Update innerHTML when value changes externally (careful with loops)
    useEffect(() => {
        if (editorRef.current && value !== editorRef.current.innerHTML) {
            // Only update if the editor is NOT focused to avoid cursor jumps
            if (document.activeElement !== editorRef.current) {
                editorRef.current.innerHTML = value;
            }
        }
    }, [value]);

    const handleInput = () => {
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    };

    const execCommand = (command: string, value: string | undefined = undefined) => {
        document.execCommand(command, false, value);
        if (editorRef.current) editorRef.current.focus();
    };

    const insertVariable = (key: string) => {
        if (!editorRef.current) return;
        editorRef.current.focus();
        
        // Modern insert
        const variableTag = `{{${key}}}`;
        document.execCommand('insertText', false, variableTag);
        handleInput();
    };

    return (
        <div className="flex h-[600px] border border-slate-700 rounded-lg overflow-hidden bg-slate-900">
            {/* Main Editor Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Toolbar */}
                <div className="flex items-center gap-1 p-2 border-b border-slate-700 bg-slate-950 flex-wrap">
                    <ToolbarBtn icon={<Bold size={16} />} onClick={() => execCommand('bold')} title="Negrito" />
                    <ToolbarBtn icon={<Italic size={16} />} onClick={() => execCommand('italic')} title="Itálico" />
                    <ToolbarBtn icon={<Underline size={16} />} onClick={() => execCommand('underline')} title="Sublinhado" />
                    <div className="w-px h-6 bg-slate-800 mx-1"></div>
                    <ToolbarBtn icon={<AlignLeft size={16} />} onClick={() => execCommand('justifyLeft')} title="Esquerda" />
                    <ToolbarBtn icon={<AlignCenter size={16} />} onClick={() => execCommand('justifyCenter')} title="Centro" />
                    <ToolbarBtn icon={<AlignRight size={16} />} onClick={() => execCommand('justifyRight')} title="Direita" />
                    <div className="w-px h-6 bg-slate-800 mx-1"></div>
                    <ToolbarBtn icon={<List size={16} />} onClick={() => execCommand('insertUnorderedList')} title="Lista" />
                    <ToolbarBtn icon={<ListOrdered size={16} />} onClick={() => execCommand('insertOrderedList')} title="Lista Numerada" />
                    <div className="w-px h-6 bg-slate-800 mx-1"></div>
                    <ToolbarBtn icon={<Heading1 size={16} />} onClick={() => execCommand('formatBlock', 'H1')} title="Título 1" />
                    <ToolbarBtn icon={<Heading2 size={16} />} onClick={() => execCommand('formatBlock', 'H2')} title="Título 2" />
                    <ToolbarBtn icon={<Type size={16} />} onClick={() => execCommand('formatBlock', 'P')} title="Parágrafo" />
                </div>

                {/* Content Area */}
                <div 
                    ref={editorRef}
                    contentEditable
                    onInput={handleInput}
                    className="flex-1 p-8 text-slate-300 focus:outline-none overflow-y-auto prose prose-invert max-w-none"
                    style={{ minHeight: '300px' }}
                    data-placeholder={placeholder}
                />
            </div>

            {/* Variables Sidebar */}
            {showVariables && variables && (
                <div className="w-64 border-l border-slate-700 bg-slate-950 flex flex-col">
                    <div className="p-3 border-b border-slate-800 font-bold text-slate-400 text-xs uppercase tracking-wider">
                        Variáveis Dinâmicas
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-4">
                        {Object.entries(variables).map(([category, items]: [string, any]) => (
                            <div key={category}>
                                <h4 className="text-xs font-bold text-indigo-400 mb-2 capitalize">{category}</h4>
                                <div className="space-y-1">
                                    {items.map((item: any) => (
                                        <button
                                            key={item.key}
                                            onClick={() => insertVariable(item.key)}
                                            className="w-full text-left flex items-center justify-between px-2 py-1.5 rounded hover:bg-slate-800 group transition-colors"
                                            title={item.key}
                                        >
                                            <span className="text-sm text-slate-300 truncate">{item.label}</span>
                                            <Copy size={12} className="text-slate-600 opacity-0 group-hover:opacity-100" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function ToolbarBtn({ icon, onClick, title, active = false }: any) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            className={clsx(
                "p-2 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors",
                active && "bg-slate-800 text-indigo-400"
            )}
        >
            {icon}
        </button>
    );
}
