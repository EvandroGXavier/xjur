
import { useState, useRef, useEffect } from 'react';
import { 
    Bold, Italic, Underline, 
    AlignLeft, AlignCenter, AlignRight, 
    List, ListOrdered, 
    Heading1, Heading2, 
    Type, Copy, Table,
    CaseUpper, CaseLower, CaseSensitive,
    BoxSelect, Circle
} from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '../../services/api';
import { titleCase, numberToExtenso } from '../../utils/textUtils';

interface RichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    showVariables?: boolean;
}

export function RichTextEditor({ value, onChange, placeholder, showVariables = true }: RichTextEditorProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const [variables, setVariables] = useState<any>(null);

    const [showTableInput, setShowTableInput] = useState(false);
    const [tableRows, setTableRows] = useState(2);
    const [tableCols, setTableCols] = useState(2);

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

    const insertTable = () => {
        let rowsHtml = '';
        for (let r = 0; r < tableRows; r++) {
            let colsHtml = '';
            for (let c = 0; c < tableCols; c++) {
                colsHtml += `<td style="border: 1px solid #475569; padding: 8px;">Célula ${r + 1}-${c + 1}</td>`;
            }
            rowsHtml += `<tr>${colsHtml}</tr>`;
        }

         const tableHTML = `
            <table style="width: 100%; border-collapse: collapse; margin: 10px 0; border: 1px solid #475569;">
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
            <p><br/></p>
        `;
        document.execCommand('insertHTML', false, tableHTML);
        handleInput();
        setShowTableInput(false);
    };

    const insertShape = (type: 'rectangle' | 'circle' ) => {
        const borderRadius = type === 'circle' ? '50%' : '4px';
        const shapeHTML = `
            <span style="
                display: inline-block;
                width: 150px;
                height: 100px;
                border: 2px solid #6366f1;
                background-color: rgba(99, 102, 241, 0.1);
                border-radius: ${borderRadius};
                padding: 10px;
                margin: 5px;
                vertical-align: top;
                overflow: hidden;
                resize: both;
            " contenteditable="true">
                Texto...
            </span>
            <span>&nbsp;</span>
        `;
        document.execCommand('insertHTML', false, shapeHTML);
        handleInput();
    };

    const transformText = (type: 'uppercase' | 'lowercase' | 'capitalize') => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const text = range.toString();

        if (!text) return;

        let newText = text;
        if (type === 'uppercase') newText = text.toUpperCase();
        if (type === 'lowercase') newText = text.toLowerCase();
        if (type === 'capitalize') newText = titleCase(text);

        document.execCommand('insertText', false, newText);
        handleInput();
    };

    const transformNumberToExtenso = () => {
         const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const text = range.toString().trim();

        if (!text) return;
        
        // Try to check if it represents a number
        // Remove currency symbols or dots/commas if necessary for parsing (basic implementation)
        const num = text.replace(/[^0-9,.]/g, ''); // Crude cleanup
        
        if (num) {
            // Fix format for JS parsing: 1.000,00 -> 1000.00
            // Assuming BR format: dot is thousand separator, comma is decimal
            let cleanNum = num.replace(/\./g, '').replace(',', '.');
            const fullText = numberToExtenso(cleanNum);
            
            if (fullText) {
                document.execCommand('insertText', false, `${text} (${fullText})`);
                handleInput();
            } else {
                // toast.error?
            }
        }
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
                    <div className="w-px h-6 bg-slate-800 mx-1"></div>
                    <div className="relative">
                        <ToolbarBtn icon={<Table size={16} />} onClick={() => setShowTableInput(!showTableInput)} title="Tabela" active={showTableInput} />
                        {showTableInput && (
                            <div className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-700 p-2 rounded shadow-xl z-50 flex flex-col gap-2 min-w-[200px]">
                                <div className="text-xs font-bold text-slate-300 mb-1">Dimensões</div>
                                <div className="flex gap-2 items-center">
                                    <input 
                                        type="number" min="1" max="10" value={tableRows} 
                                        onChange={e => setTableRows(parseInt(e.target.value))}
                                        className="w-12 bg-slate-900 border border-slate-700 rounded px-1 text-xs text-white"
                                    />
                                    <span className="text-slate-500">x</span>
                                    <input 
                                        type="number" min="1" max="10" value={tableCols} 
                                        onChange={e => setTableCols(parseInt(e.target.value))}
                                        className="w-12 bg-slate-900 border border-slate-700 rounded px-1 text-xs text-white"
                                    />
                                </div>
                                <button 
                                    onClick={insertTable}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs py-1 rounded w-full"
                                >
                                    Inserir Tabela
                                </button>
                            </div>
                        )}
                    </div>
                    
                    <div className="w-px h-6 bg-slate-800 mx-1"></div>
                    
                    {/* Shapes */}
                    <div className="flex items-center gap-1">
                        <ToolbarBtn icon={<BoxSelect size={16} />} onClick={() => insertShape('rectangle')} title="Caixa de Texto (Retângulo)" />
                        <ToolbarBtn icon={<Circle size={16} />} onClick={() => insertShape('circle')} title="Caixa de Texto (Círculo)" />
                    </div>

                    <div className="w-px h-6 bg-slate-800 mx-1"></div>

                    {/* Text Transform Tools */}
                    <ToolbarBtn icon={<CaseUpper size={16} />} onClick={() => transformText('uppercase')} title="MAIÚSCULAS" />
                    <ToolbarBtn icon={<CaseLower size={16} />} onClick={() => transformText('lowercase')} title="minúsculas" />
                    <ToolbarBtn icon={<CaseSensitive size={16} />} onClick={() => transformText('capitalize')} title="Capitalizar" />

                    <div className="w-px h-6 bg-slate-800 mx-1"></div>
                    
                    <ToolbarBtn 
                        icon={<span className="text-xs font-bold">123</span>} 
                        onClick={transformNumberToExtenso} 
                        title="Converter Número para Extenso" 
                    />
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
