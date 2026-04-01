import { forwardRef, useEffect, useImperativeHandle, useMemo, useState, type ReactNode } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Bold, Copy, Italic, List, ListOrdered, Plus, Quote, Table, Trash2, Type, Underline, X } from 'lucide-react';
import { clsx } from 'clsx';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyleKit } from '@tiptap/extension-text-style';
import { Table as TiptapTable, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import { DOMSerializer } from '@tiptap/pm/model';
import { api } from '../../services/api';
import { titleCase, numberToExtenso } from '../../utils/textUtils';
import { resolveCssColor } from '../../utils/themeColors';
import './rich-text-editor.css';

interface RichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    showVariables?: boolean;
    className?: string;
    readOnly?: boolean;
    minHeight?: number;
}

export interface RichTextEditorHandle {
    focus: () => void;
    getHtml: () => string;
    setHtml: (html: string) => void;
    getSelectionHtml: () => string;
    replaceSelectionHtml: (html: string) => void;
}

type VariableMap = Record<string, Array<{ key: string; label: string }>>;
type BlockStyle = 'paragraph' | 'h1' | 'h2' | 'h3' | 'blockquote';

const BLOCK_OPTIONS = [
    { value: 'paragraph', label: 'Parágrafo' },
    { value: 'h1', label: 'Título principal' },
    { value: 'h2', label: 'Título de seção' },
    { value: 'h3', label: 'Subtítulo' },
    { value: 'blockquote', label: 'Citação / Destaque' },
] as const;

const FONT_FAMILIES = ['Calibri', 'Arial', 'Georgia', 'Times New Roman', 'Verdana', 'Trebuchet MS', 'Garamond'];
const FONT_SIZES = ['10', '11', '12', '14', '16', '18', '20', '24', '28', '32', '36'];
const DEFAULT_TEXT_COLOR = '#0f172a';
const DEFAULT_BACKGROUND_COLOR = '#fff3b0';

function normalizeHtml(html?: string | null) {
    return String(html || '').replace(/<p><\/p>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function stripQuotes(value?: string | null) {
    return String(value || '').replace(/^['"]|['"]$/g, '');
}

function toHexColor(color?: string | null, fallback = DEFAULT_TEXT_COLOR) {
    const resolved = resolveCssColor(color, fallback);
    if (resolved.startsWith('#')) return resolved;
    const parts = resolved.match(/\d+/g);
    if (!parts || parts.length < 3) return fallback;
    const [r, g, b] = parts.slice(0, 3).map(Number);
    return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function getCurrentBlock(editor: Editor | null): BlockStyle {
    if (!editor) return 'paragraph';
    if (editor.isActive('heading', { level: 1 })) return 'h1';
    if (editor.isActive('heading', { level: 2 })) return 'h2';
    if (editor.isActive('heading', { level: 3 })) return 'h3';
    if (editor.isActive('blockquote')) return 'blockquote';
    return 'paragraph';
}

function getSelectedText(editor: Editor | null) {
    if (!editor) return '';
    const { from, to, empty } = editor.state.selection;
    if (empty) return '';
    return editor.state.doc.textBetween(from, to, ' ').trim();
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function RichTextEditor(
    { value, onChange, placeholder = 'Comece a criar seu modelo aqui.', showVariables = false, className, readOnly = false, minHeight = 720 },
    ref,
) {
    const [variables, setVariables] = useState<VariableMap>({});
    const [variableQuery, setVariableQuery] = useState('');
    const [tableRows, setTableRows] = useState(3);
    const [tableCols, setTableCols] = useState(3);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false, autolink: true } }),
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            TextStyleKit.configure({
                color: { types: ['textStyle'] },
                backgroundColor: { types: ['textStyle'] },
                fontFamily: { types: ['textStyle'] },
                fontSize: { types: ['textStyle'] },
                lineHeight: false,
            }),
            TiptapTable.configure({ resizable: true, HTMLAttributes: { class: 'rich-text-table' } }),
            TableRow,
            TableHeader,
            TableCell,
            Placeholder.configure({ placeholder }),
            CharacterCount,
        ],
        content: value || '',
        editable: !readOnly,
        immediatelyRender: false,
        shouldRerenderOnTransaction: true,
        editorProps: { attributes: { class: 'rich-text-prose', spellcheck: 'true', autocorrect: 'on', autocapitalize: 'sentences' } },
        onUpdate({ editor: currentEditor }) {
            onChange(currentEditor.isEmpty ? '' : currentEditor.getHTML());
        },
    });

    useEffect(() => {
        if (!showVariables) {
            setVariables({});
            return;
        }
        api.get('/documents/variables').then((res) => setVariables(res.data || {})).catch(console.error);
    }, [showVariables]);

    useEffect(() => {
        if (editor) editor.setEditable(!readOnly);
    }, [editor, readOnly]);

    useEffect(() => {
        if (!editor) return;
        if (normalizeHtml(editor.getHTML()) === normalizeHtml(value)) return;
        editor.commands.setContent(value || '', { emitUpdate: false });
    }, [editor, value]);

    useImperativeHandle(ref, () => ({
        focus: () => editor?.chain().focus().run(),
        getHtml: () => (editor?.isEmpty ? '' : editor?.getHTML() || ''),
        setHtml: (html: string) => { if (editor && !readOnly) editor.commands.setContent(html || '', { emitUpdate: true }); },
        getSelectionHtml: () => {
            if (!editor) return '';
            const { from, to, empty } = editor.state.selection;
            if (empty) return '';
            const fragment = editor.state.doc.slice(from, to).content;
            const serializer = DOMSerializer.fromSchema(editor.schema);
            const container = document.createElement('div');
            container.appendChild(serializer.serializeFragment(fragment));
            return container.innerHTML;
        },
        replaceSelectionHtml: (html: string) => { if (editor && !readOnly) editor.chain().focus().insertContent(html).run(); },
    }), [editor, readOnly]);

    const attrs = editor?.getAttributes('textStyle') || {};
    const currentBlock = getCurrentBlock(editor);
    const currentFontFamily = stripQuotes(attrs.fontFamily || '');
    const currentFontSize = String(attrs.fontSize || '').replace('px', '');
    const currentTextColor = toHexColor(attrs.color, DEFAULT_TEXT_COLOR);
    const currentBackgroundColor = toHexColor(attrs.backgroundColor, DEFAULT_BACKGROUND_COLOR);
    const words = editor?.storage.characterCount?.words() || 0;
    const characters = editor?.storage.characterCount?.characters() || 0;

    const variableGroups = useMemo(() => {
        const query = variableQuery.trim().toLowerCase();
        return Object.entries(variables).map(([category, items]) => [category, items.filter((item) => {
            const label = String(item?.label || '').toLowerCase();
            const key = String(item?.key || '').toLowerCase();
            return !query || label.includes(query) || key.includes(query);
        })] as const).filter(([, items]) => items.length > 0);
    }, [variableQuery, variables]);

    const run = (callback: (currentEditor: Editor) => void) => {
        if (!editor || readOnly) return;
        callback(editor);
    };

    const applyBlockStyle = (block: BlockStyle) => {
        run((currentEditor) => {
            const chain = currentEditor.chain().focus();
            if (block === 'paragraph') return void chain.setParagraph().run();
            if (block === 'blockquote') return void chain.toggleBlockquote().run();
            const level = Number(block.replace('h', '')) as 1 | 2 | 3;
            chain.setHeading({ level }).run();
        });
    };

    const insertVariable = (key: string) => {
        run((currentEditor) => currentEditor.chain().focus().insertContent(`{{${key}}}`).run());
    };

    const insertQuickBlock = (preset: string) => {
        const snippets: Record<string, string> = {
            centeredTitle: '<h1 style="text-align:center; font-size:18pt; line-height:1.3; text-transform:uppercase; letter-spacing:0.08em; margin:0 0 18px;"><strong>TÍTULO DO DOCUMENTO</strong></h1><p></p>',
            subtitle: '<h2 style="text-align:center; font-size:13pt; margin:0 0 14px; color:#334155;"><strong>Subtítulo / Complemento</strong></h2><p></p>',
            clause: '<h3 style="font-size:13pt; margin:24px 0 8px;"><strong>CLÁUSULA 1 - TÍTULO</strong></h3><p>Descreva aqui o conteúdo da cláusula.</p>',
            callout: '<p style="margin:16px 0; padding:12px 14px; border-left:4px solid #6366f1; background:#eef2ff; color:#312e81;"><strong>Observação importante:</strong> descreva aqui o destaque que precisa aparecer no modelo.</p><p></p>',
            signature: '<p style="margin-top:48px; text-align:center;">____________________________________<br /><strong>NOME / ASSINATURA</strong></p><p></p>',
            pageBreak: '<div data-page-break="true" style="page-break-after:always; break-after:page; border-top:2px dashed #cbd5e1; margin:32px 0 0; padding-top:8px; text-align:center; font-size:11px; color:#64748b;">Quebra de página</div><p></p>',
        };
        const snippet = snippets[preset];
        if (!snippet) return;
        run((currentEditor) => currentEditor.chain().focus().insertContent(snippet).run());
    };

    const transformSelectionText = (mode: 'uppercase' | 'lowercase' | 'capitalize' | 'extenso') => {
        const selectedText = getSelectedText(editor);
        if (!selectedText) return;

        let nextText = selectedText;
        if (mode === 'uppercase') nextText = selectedText.toUpperCase();
        if (mode === 'lowercase') nextText = selectedText.toLowerCase();
        if (mode === 'capitalize') nextText = titleCase(selectedText);
        if (mode === 'extenso') {
            const numericText = selectedText.replace(/[^0-9,.]/g, '');
            if (!numericText) return;
            const cleanNumber = numericText.replace(/\./g, '').replace(',', '.');
            const extended = numberToExtenso(cleanNumber);
            if (!extended) return;
            nextText = `${selectedText} (${extended})`;
        }

        run((currentEditor) => currentEditor.chain().focus().insertContent(nextText).run());
    };

    const clearFormatting = () => {
        run((currentEditor) => currentEditor.chain().focus().unsetAllMarks().clearNodes().unsetTextAlign().run());
    };

    const canEditTable = Boolean(editor?.isActive('table'));

    return (
        <div className={clsx('rich-text-shell flex min-h-0 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950', className)}>
            <div className="flex min-w-0 flex-1 flex-col">
                <div className={clsx('sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 backdrop-blur', readOnly && 'opacity-70')}>
                    <div className="flex flex-wrap items-end gap-2 px-3 py-3">
                        <ToolbarSelect label="Bloco" value={currentBlock} onChange={applyBlockStyle} disabled={!editor || readOnly} options={BLOCK_OPTIONS as any} />
                        <ToolbarSelect label="Fonte" value={currentFontFamily} onChange={(fontFamily) => run((currentEditor) => fontFamily ? currentEditor.chain().focus().setFontFamily(fontFamily).run() : currentEditor.chain().focus().unsetFontFamily().run())} disabled={!editor || readOnly} options={[{ value: '', label: 'Padrão do documento' }, ...FONT_FAMILIES.map((font) => ({ value: font, label: font }))]} wide />
                        <ToolbarSelect label="Tamanho" value={currentFontSize} onChange={(fontSize) => run((currentEditor) => fontSize ? currentEditor.chain().focus().setFontSize(`${fontSize}px`).run() : currentEditor.chain().focus().unsetFontSize().run())} disabled={!editor || readOnly} options={[{ value: '', label: 'Auto' }, ...FONT_SIZES.map((size) => ({ value: size, label: `${size}px` }))]} />
                        <ToolbarSelect label="Blocos prontos" value="" onChange={insertQuickBlock} disabled={!editor || readOnly} options={[{ value: '', label: 'Inserir...' }, { value: 'centeredTitle', label: 'Título centralizado' }, { value: 'subtitle', label: 'Subtítulo refinado' }, { value: 'clause', label: 'Cláusula / seção' }, { value: 'callout', label: 'Caixa de destaque' }, { value: 'signature', label: 'Assinatura' }, { value: 'pageBreak', label: 'Quebra de página' }]} wide resetAfterChange />
                        <ToolbarColorField label="Texto" value={currentTextColor} disabled={!editor || readOnly} onChange={(color) => run((currentEditor) => currentEditor.chain().focus().setColor(color).run())} onClear={() => run((currentEditor) => currentEditor.chain().focus().unsetColor().run())} />
                        <ToolbarColorField label="Destaque" value={currentBackgroundColor} disabled={!editor || readOnly} onChange={(color) => run((currentEditor) => currentEditor.chain().focus().setBackgroundColor(color).run())} onClear={() => run((currentEditor) => currentEditor.chain().focus().unsetBackgroundColor().run())} />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 border-t border-slate-900 px-3 py-2">
                        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 px-2 py-1">
                            <ToolbarButton label="B" title="Negrito" active={Boolean(editor?.isActive('bold'))} disabled={!editor || readOnly} onClick={() => run((currentEditor) => currentEditor.chain().focus().toggleBold().run())} />
                            <ToolbarButton label="I" title="Itálico" active={Boolean(editor?.isActive('italic'))} disabled={!editor || readOnly} onClick={() => run((currentEditor) => currentEditor.chain().focus().toggleItalic().run())} />
                            <ToolbarButton label={<Underline size={15} />} title="Sublinhado" active={Boolean(editor?.isActive('underline'))} disabled={!editor || readOnly} onClick={() => run((currentEditor) => currentEditor.chain().focus().toggleUnderline().run())} />
                            <ToolbarButton label="S" title="Riscado" active={Boolean(editor?.isActive('strike'))} disabled={!editor || readOnly} onClick={() => run((currentEditor) => currentEditor.chain().focus().toggleStrike().run())} />
                        </div>

                        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 px-2 py-1">
                            <ToolbarButton label={<AlignLeft size={15} />} title="Alinhar à esquerda" active={Boolean(editor?.isActive({ textAlign: 'left' }))} disabled={!editor || readOnly} onClick={() => run((currentEditor) => currentEditor.chain().focus().setTextAlign('left').run())} />
                            <ToolbarButton label={<AlignCenter size={15} />} title="Centralizar" active={Boolean(editor?.isActive({ textAlign: 'center' }))} disabled={!editor || readOnly} onClick={() => run((currentEditor) => currentEditor.chain().focus().setTextAlign('center').run())} />
                            <ToolbarButton label={<AlignRight size={15} />} title="Alinhar à direita" active={Boolean(editor?.isActive({ textAlign: 'right' }))} disabled={!editor || readOnly} onClick={() => run((currentEditor) => currentEditor.chain().focus().setTextAlign('right').run())} />
                            <ToolbarButton label="J" title="Justificar" active={Boolean(editor?.isActive({ textAlign: 'justify' }))} disabled={!editor || readOnly} onClick={() => run((currentEditor) => currentEditor.chain().focus().setTextAlign('justify').run())} />
                        </div>

                        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 px-2 py-1">
                            <ToolbarButton label={<List size={15} />} title="Lista com marcadores" active={Boolean(editor?.isActive('bulletList'))} disabled={!editor || readOnly} onClick={() => run((currentEditor) => currentEditor.chain().focus().toggleBulletList().run())} />
                            <ToolbarButton label={<ListOrdered size={15} />} title="Lista numerada" active={Boolean(editor?.isActive('orderedList'))} disabled={!editor || readOnly} onClick={() => run((currentEditor) => currentEditor.chain().focus().toggleOrderedList().run())} />
                            <ToolbarButton label={<Quote size={15} />} title="Citação / destaque" active={Boolean(editor?.isActive('blockquote'))} disabled={!editor || readOnly} onClick={() => run((currentEditor) => currentEditor.chain().focus().toggleBlockquote().run())} />
                        </div>

                        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-2 py-1">
                            <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-slate-500"><Table size={14} /> Tabela</div>
                            <input type="number" min="1" max="12" value={tableRows} onChange={(e) => setTableRows(Number(e.target.value) || 1)} disabled={!editor || readOnly} className="w-14 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white outline-none focus:border-indigo-500" title="Linhas" />
                            <span className="text-slate-500">x</span>
                            <input type="number" min="1" max="8" value={tableCols} onChange={(e) => setTableCols(Number(e.target.value) || 1)} disabled={!editor || readOnly} className="w-14 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white outline-none focus:border-indigo-500" title="Colunas" />
                            <button type="button" disabled={!editor || readOnly} onMouseDown={(event) => event.preventDefault()} onClick={() => run((currentEditor) => currentEditor.chain().focus().insertTable({ rows: tableRows, cols: tableCols, withHeaderRow: true }).run())} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">
                                <Plus size={14} /> Inserir
                            </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 px-2 py-1">
                            <ToolbarButton label="Aa" title="Capitalizar" disabled={!editor || readOnly} onClick={() => transformSelectionText('capitalize')} />
                            <ToolbarButton label="AA" title="Maiúsculas" disabled={!editor || readOnly} onClick={() => transformSelectionText('uppercase')} />
                            <ToolbarButton label="aa" title="Minúsculas" disabled={!editor || readOnly} onClick={() => transformSelectionText('lowercase')} />
                            <ToolbarButton label="123" title="Número por extenso" disabled={!editor || readOnly} onClick={() => transformSelectionText('extenso')} />
                        </div>

                        <div className="ml-auto flex flex-wrap items-center gap-1">
                            <ToolbarButton label="Limpar" title="Limpar formatação" disabled={!editor || readOnly} onClick={clearFormatting} />
                            <ToolbarButton label="Desfazer" title="Desfazer" disabled={!editor || readOnly || !editor?.can().undo()} onClick={() => run((currentEditor) => currentEditor.chain().focus().undo().run())} />
                            <ToolbarButton label="Refazer" title="Refazer" disabled={!editor || readOnly || !editor?.can().redo()} onClick={() => run((currentEditor) => currentEditor.chain().focus().redo().run())} />
                        </div>
                    </div>

                    {canEditTable && (
                        <div className="flex flex-wrap items-center gap-2 border-t border-slate-900 px-3 py-2">
                            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-indigo-300">Ações da tabela</span>
                            <ToolbarButton label="Linha +" title="Adicionar linha" disabled={!editor || readOnly || !editor?.can().addRowAfter()} onClick={() => run((currentEditor) => currentEditor.chain().focus().addRowAfter().run())} />
                            <ToolbarButton label="Linha -" title="Excluir linha" disabled={!editor || readOnly || !editor?.can().deleteRow()} onClick={() => run((currentEditor) => currentEditor.chain().focus().deleteRow().run())} />
                            <ToolbarButton label="Coluna +" title="Adicionar coluna" disabled={!editor || readOnly || !editor?.can().addColumnAfter()} onClick={() => run((currentEditor) => currentEditor.chain().focus().addColumnAfter().run())} />
                            <ToolbarButton label="Coluna -" title="Excluir coluna" disabled={!editor || readOnly || !editor?.can().deleteColumn()} onClick={() => run((currentEditor) => currentEditor.chain().focus().deleteColumn().run())} />
                            <ToolbarButton label="Cabeçalho" title="Alternar linha de cabeçalho" disabled={!editor || readOnly} onClick={() => run((currentEditor) => currentEditor.chain().focus().toggleHeaderRow().run())} />
                            <ToolbarButton label="Mesclar" title="Mesclar células" disabled={!editor || readOnly || !editor?.can().mergeCells()} onClick={() => run((currentEditor) => currentEditor.chain().focus().mergeCells().run())} />
                            <ToolbarButton label="Separar" title="Separar células" disabled={!editor || readOnly || !editor?.can().splitCell()} onClick={() => run((currentEditor) => currentEditor.chain().focus().splitCell().run())} />
                            <ToolbarButton label={<span className="inline-flex items-center gap-1"><Trash2 size={14} /> Tabela</span>} title="Excluir tabela" disabled={!editor || readOnly || !editor?.can().deleteTable()} onClick={() => run((currentEditor) => currentEditor.chain().focus().deleteTable().run())} />
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto bg-slate-900/60 p-4 md:p-6">
                    <div className="mx-auto w-full max-w-[980px] rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
                        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 text-xs text-slate-500">
                            <div className="flex items-center gap-2"><Type size={14} /> Documento editável</div>
                            <div className="flex items-center gap-3"><span>{words} palavras</span><span>{characters} caracteres</span><span className="hidden md:inline">Atalhos: Ctrl+B, Ctrl+I, Ctrl+U</span></div>
                        </div>
                        <EditorContent editor={editor} className="rich-text-editor" style={{ ['--editor-min-height' as string]: `${minHeight}px` }} />
                    </div>
                </div>
            </div>

            {showVariables && (
                <aside className="flex w-[300px] flex-col border-l border-slate-800 bg-slate-950/95">
                    <div className="border-b border-slate-800 px-4 py-3">
                        <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Variáveis dinâmicas</div>
                        <p className="mt-1 text-xs text-slate-500">Clique para inserir no ponto do cursor.</p>
                        <input type="text" value={variableQuery} onChange={(e) => setVariableQuery(e.target.value)} placeholder="Buscar variável..." className="mt-3 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-500" />
                    </div>

                    <div className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
                        {variableGroups.length === 0 && <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-500">Nenhuma variável encontrada.</div>}
                        {variableGroups.map(([category, items]) => (
                            <div key={category} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
                                <div className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-indigo-300">{category}</div>
                                <div className="space-y-2">
                                    {items.map((item) => (
                                        <button key={item.key} type="button" onClick={() => insertVariable(item.key)} className="group flex w-full items-start justify-between gap-3 rounded-xl border border-transparent bg-slate-950/80 px-3 py-2 text-left transition hover:border-indigo-500/40 hover:bg-slate-900" title={item.key}>
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-medium text-slate-200">{item.label}</div>
                                                <div className="truncate text-[11px] text-slate-500">{`{{${item.key}}}`}</div>
                                            </div>
                                            <Copy size={14} className="mt-0.5 shrink-0 text-slate-600 transition group-hover:text-indigo-300" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </aside>
            )}
        </div>
    );
});

interface ToolbarButtonProps {
    label: ReactNode;
    title: string;
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
}

function ToolbarButton({ label, title, onClick, active = false, disabled = false }: ToolbarButtonProps) {
    return (
        <button
            type="button"
            title={title}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClick}
            className={clsx(
                'inline-flex min-h-[36px] items-center justify-center rounded-lg border px-2.5 py-1.5 text-sm font-semibold transition',
                active ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-100' : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-600 hover:text-white',
                disabled && 'cursor-not-allowed opacity-45 hover:border-slate-700 hover:text-slate-300',
            )}
        >
            {label}
        </button>
    );
}

interface ToolbarSelectProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
    disabled?: boolean;
    wide?: boolean;
    resetAfterChange?: boolean;
}

function ToolbarSelect({ label, value, onChange, options, disabled = false, wide = false, resetAfterChange = false }: ToolbarSelectProps) {
    return (
        <label className={clsx('flex flex-col gap-1', wide ? 'min-w-[220px]' : 'min-w-[140px]')}>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</span>
            <select
                value={value}
                disabled={disabled}
                onChange={(event) => {
                    onChange(event.target.value);
                    if (resetAfterChange) event.target.value = '';
                }}
                className="h-10 rounded-xl border border-slate-800 bg-slate-900 px-3 text-sm text-white outline-none transition focus:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
                {options.map((option) => (
                    <option key={`${label}-${option.value || 'empty'}`} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </label>
    );
}

interface ToolbarColorFieldProps {
    label: string;
    value: string;
    disabled?: boolean;
    onChange: (value: string) => void;
    onClear: () => void;
}

function ToolbarColorField({ label, value, disabled = false, onChange, onClear }: ToolbarColorFieldProps) {
    return (
        <div className="flex min-w-[138px] flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</span>
            <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3">
                <input type="color" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="h-6 w-7 cursor-pointer rounded border-0 bg-transparent p-0 disabled:cursor-not-allowed" title={`Cor de ${label.toLowerCase()}`} />
                <span className="min-w-0 flex-1 truncate text-xs text-slate-300">{value.toUpperCase()}</span>
                <button type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={onClear} className="rounded p-1 text-slate-500 transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40" title={`Limpar cor de ${label.toLowerCase()}`}>
                    <X size={14} />
                </button>
            </div>
        </div>
    );
}
