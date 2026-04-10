import { useState, useRef, useEffect, useCallback } from 'react';
import { Printer, Copy, Download, X, Receipt, AlertTriangle } from 'lucide-react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface BoletoChargeData {
  id: string;
  chargeType: string;
  status: string;
  amount: number | string;
  dueDate?: string | null;
  digitableLine?: string | null;
  barcode?: string | null;
  pixQrCode?: string | null;
  pixCopyPaste?: string | null;
  bankIntegration?: { displayName: string; provider: string } | null;
  financialRecord?: {
    id: string;
    description: string;
    amount: number;
    dueDate?: string | null;
  } | null;
}

interface BoletoFloatingPanelProps {
  charge: BoletoChargeData;
  tenantName?: string;
  children: React.ReactNode;
  className?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(value: number | string) {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(n)) return 'R$ 0,00';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return '--/--/----';
  try { return format(parseISO(dateStr), 'dd/MM/yyyy', { locale: ptBR }); }
  catch { return dateStr; }
}

function generateBarBars(barcode: string): string {
  const cleaned = barcode.replace(/\D/g, '');
  if (!cleaned) return '';
  let html = '';
  for (let i = 0; i < cleaned.length; i++) {
    const d = parseInt(cleaned[i]);
    const isBar = i % 2 === 0;
    const w = (d % 3) + 1;
    html += `<div style="display:inline-block;width:${w * 2}px;height:100%;background:${isBar ? '#111' : '#fff'};"></div>`;
  }
  return html;
}

// Gera HTML completo do boleto — recebe qrDataUrl gerado pelo canvas React
export function buildBoletoHtml(
  charge: BoletoChargeData,
  tenantName = 'Empresa',
  qrDataUrl?: string | null,
): string {
  const amount  = charge.financialRecord?.amount ?? charge.amount;
  const description = charge.financialRecord?.description || 'Cobrança';
  const dueDate = charge.dueDate || charge.financialRecord?.dueDate;
  const bankName = charge.bankIntegration?.displayName || 'Banco Inter';
  const digitableLine = charge.digitableLine || '';
  const barcode = (charge.barcode || '').replace(/\D/g, '');
  const pixCopyPaste = charge.pixCopyPaste || '';
  const isMock = charge.status?.includes('MOCK');
  const today = format(new Date(), 'dd/MM/yyyy', { locale: ptBR });
  const now   = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  const pixSection = qrDataUrl ? `
    <div style="border-top:2px dashed #aaa;margin-top:16px;padding-top:16px">
      <div style="display:flex;align-items:flex-start;gap:20px">
        <div style="flex:1">
          <div style="font-size:11px;font-weight:bold;color:#007a5e;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">
            Pague também via Pix
          </div>
          <div style="font-size:9px;color:#555;line-height:1.6;margin-bottom:8px">
            Aponte a câmera do seu celular para o QR Code ao lado ou copie e cole o código Pix abaixo para realizar o pagamento instantâneo.
          </div>
          <div style="font-size:9px;color:#444;font-weight:bold;margin-bottom:4px">Pix Copia e Cola:</div>
          <div style="font-family:monospace;font-size:8px;word-break:break-all;background:#f5f5f5;padding:6px 8px;border-radius:4px;border:1px solid #ddd;color:#333;max-width:340px">
            ${pixCopyPaste || '—'}
          </div>
        </div>
        <div style="flex:0 0 130px;display:flex;flex-direction:column;align-items:center;gap:6px">
          <img src="${qrDataUrl}" width="130" height="130" alt="QR Code Pix" style="border:1px solid #ddd;border-radius:4px;padding:4px;background:#fff"/>
          <div style="font-size:8px;color:#666;text-align:center">QR Code Pix<br/><span style="color:#007a5e;font-weight:bold">Válido até ${formatDate(dueDate)}</span></div>
        </div>
      </div>
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Boleto — ${description}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:11px;color:#111;background:#fff;padding:24px}
    .slip{max-width:740px;margin:0 auto;border:1px solid #ccc}
    .warn{background:#fff3cd;border:1px solid #ffc107;color:#856404;padding:8px 14px;margin-bottom:14px;font-size:10px;text-align:center;border-radius:4px}
    .header{display:flex;align-items:stretch;border-bottom:2px solid #333}
    .h-bank{flex:0 0 200px;padding:10px 12px;border-right:2px solid #333;font-size:17px;font-weight:bold;display:flex;align-items:center}
    .h-code{flex:0 0 80px;padding:10px 12px;border-right:2px solid #333;font-size:15px;font-weight:bold;display:flex;align-items:center;justify-content:center}
    .h-line{flex:1;padding:10px 12px;font-family:monospace;font-size:12px;letter-spacing:2px;font-weight:bold;display:flex;align-items:center;word-break:break-all}
    .row{display:flex;border-bottom:1px solid #ccc}
    .field{flex:1;padding:6px 10px;border-right:1px solid #ccc}
    .field:last-child{border-right:none}
    .fl{font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:#555;margin-bottom:2px}
    .fv{font-size:12px;font-weight:600}
    .fv-lg{font-size:16px;font-weight:bold;color:#007a5e}
    .desc{padding:8px 10px;border-bottom:1px solid #ccc}
    .bc{padding:14px 10px 8px;border-bottom:${pixSection ? '1px solid #ccc' : 'none'};text-align:center}
    .bc-bars{display:flex;align-items:flex-end;justify-content:center;height:60px;margin-bottom:8px}
    .bc-num{font-family:monospace;font-size:10px;letter-spacing:1px;color:#333}
    .pix-section{padding:16px;background:#f9fff9}
    .inst{padding:10px;background:#f5f5f5;font-size:9px;color:#555;line-height:1.6;border-top:1px solid #eee}
    .foot{padding:8px 10px;font-size:9px;color:#999;text-align:right;border-top:1px solid #eee}
    @media print{body{padding:0}.slip{border:none}}
  </style>
</head>
<body>
  ${isMock ? '<div class="warn">⚠️ DOCUMENTO DE TESTE — Dados simulados (modo MOCK). NÃO realizar pagamento.</div>' : ''}
  <div class="slip">
    <div class="header">
      <div class="h-bank">${bankName}</div>
      <div class="h-code">077-7</div>
      <div class="h-line">${digitableLine || '00000.000000 00000.000000 00000.000000 0 00000000000000'}</div>
    </div>
    <div class="row">
      <div class="field" style="flex:2"><div class="fl">Beneficiário</div><div class="fv">${tenantName}</div></div>
      <div class="field"><div class="fl">Agência / Cód. Beneficiário</div><div class="fv">0001 / 00000000-0</div></div>
    </div>
    <div class="row">
      <div class="field" style="flex:2"><div class="fl">Descrição / Nosso Número</div><div class="fv">${description}</div></div>
      <div class="field"><div class="fl">Vencimento</div><div class="fv" style="font-weight:bold">${formatDate(dueDate)}</div></div>
      <div class="field"><div class="fl">Valor do Documento</div><div class="fv-lg">${formatCurrency(amount)}</div></div>
    </div>
    <div class="row">
      <div class="field" style="flex:2"><div class="fl">Espécie Doc.</div><div class="fv">DM</div></div>
      <div class="field"><div class="fl">Aceite</div><div class="fv">N</div></div>
      <div class="field"><div class="fl">Data do Documento</div><div class="fv">${today}</div></div>
      <div class="field"><div class="fl">Valor Cobrado</div><div class="fv">${formatCurrency(amount)}</div></div>
    </div>
    <div class="desc">
      <div class="fl">Instruções ao caixa</div>
      <div style="font-size:11px;margin-top:4px">
        Cobrar multa de 2% após o vencimento. Juros de 0,033% ao dia.<br/>
        Pagável em qualquer banco, internet banking ou via Pix até a data de vencimento.<br/>
        Não receber após 30 dias do vencimento.
      </div>
    </div>
    <div class="bc">
      <div class="bc-bars">${barcode ? generateBarBars(barcode) : '<span style="color:#aaa;font-size:10px">Código de barras indisponível</span>'}</div>
      <div class="bc-num">${barcode || '—'}</div>
    </div>
    ${pixSection ? `<div class="pix-section">${pixSection}</div>` : ''}
    <div class="inst">
      <strong>Instruções:</strong> Este boleto é válido até a data de vencimento indicada.
      ${qrDataUrl ? 'O pagamento pode ser realizado via boleto ou via Pix (QR Code acima).' : ''}
      Após o vencimento, entre em contato com o beneficiário para reemissão.
    </div>
    <div class="foot">Gerado em ${now} — Dr.X / Xjur</div>
  </div>
  <script>window.addEventListener('message',(e)=>{if(e.data==='print')window.print();});</script>
</body>
</html>`;
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export function BoletoFloatingPanel({
  charge,
  tenantName,
  children,
  className,
}: BoletoFloatingPanelProps) {
  const [isOpen, setIsOpen]       = useState(false);
  const [position, setPosition]   = useState({ x: 0, y: 0 });
  const [blobUrl, setBlobUrl]     = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [dragging, setDragging]   = useState(false);

  const dragOffset  = useRef({ x: 0, y: 0 });
  const panelRef    = useRef<HTMLDivElement>(null);
  const triggerRef  = useRef<HTMLDivElement>(null);
  const iframeRef   = useRef<HTMLIFrameElement>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const description  = charge.financialRecord?.description || 'Boleto';
  const digitableLine = charge.digitableLine || '';
  const pixCopyPaste  = charge.pixCopyPaste || '';
  const hasPixQr      = Boolean(charge.pixQrCode);
  const isMock        = charge.status?.includes('MOCK');

  // Extrai data URL do canvas QR code após renderização
  useEffect(() => {
    if (!hasPixQr) return;
    const attempt = () => {
      const canvas = qrCanvasRef.current;
      if (canvas) {
        try { setQrDataUrl(canvas.toDataURL('image/png')); }
        catch { /* canvas pode estar vazio ainda */ }
      }
    };
    const t = setTimeout(attempt, 120);
    return () => clearTimeout(t);
  }, [hasPixQr, charge.pixQrCode]);

  // Cria o blob URL do iframe quando o painel abre (ou quando qrDataUrl muda)
  useEffect(() => {
    if (!isOpen) return;
    if (hasPixQr && !qrDataUrl) return; // aguarda QR code ficar pronto

    if (blobUrl) URL.revokeObjectURL(blobUrl);
    const html = buildBoletoHtml(charge, tenantName, qrDataUrl);
    const blob = new Blob([html], { type: 'text/html' });
    setBlobUrl(URL.createObjectURL(blob));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, qrDataUrl]);

  // Revoga blob ao desmontar
  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl); }, [blobUrl]);

  // Fecha com Escape
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isOpen]);

  // ── Abrir painel ──────────────────────────────────────────────────────────
  const openPanel = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const W = 660, H = hasPixQr ? 800 : 720;
      const spaceRight = window.innerWidth - rect.right;
      let x = spaceRight >= W + 12 ? rect.right + 10 : rect.left - W - 10;
      let y = Math.max(10, Math.min(rect.top - 20, window.innerHeight - H - 10));
      if (x < 10) x = Math.max(10, (window.innerWidth - W) / 2);
      setPosition({ x, y });
    }
    setIsOpen(true);
  }, [hasPixQr]);

  // ── Drag ─────────────────────────────────────────────────────────────────
  const handleDragStart = (e: React.MouseEvent) => {
    setDragging(true);
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => setPosition({
      x: Math.max(0, e.clientX - dragOffset.current.x),
      y: Math.max(0, e.clientY - dragOffset.current.y),
    });
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging]);

  // ── Ações ────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage('print', '*');
    } else if (blobUrl) {
      const w = window.open(blobUrl, '_blank');
      w?.print();
    }
  };

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    const safe = description.replace(/[^a-z0-9\-_]/gi, '_').slice(0, 40);
    a.download = `boleto_${safe}.html`;
    a.click();
    toast.success('Boleto salvo!');
  };

  const handleCopyLinha = () => {
    if (!digitableLine) return;
    navigator.clipboard.writeText(digitableLine).then(() => toast.success('Linha digitável copiada!'));
  };

  const handleCopyPix = () => {
    if (!pixCopyPaste) return;
    navigator.clipboard.writeText(pixCopyPaste).then(() => toast.success('Pix copia e cola copiado!'));
  };

  const panelHeight = hasPixQr ? 800 : 720;

  return (
    <>
      {/* Canvas oculto para gerar QR Code data URL — renderizado sempre que há pixQrCode */}
      {hasPixQr && charge.pixQrCode && (
        <div style={{ position: 'absolute', left: -9999, top: -9999, pointerEvents: 'none' }}>
          <QRCodeCanvas
            ref={qrCanvasRef}
            value={charge.pixQrCode}
            size={160}
            level="M"
            marginSize={2}
            bgColor="#ffffff"
            fgColor="#000000"
          />
        </div>
      )}

      {/* Trigger */}
      <div ref={triggerRef} className={className || 'inline-block'} onClick={openPanel}>
        {children}
      </div>

      {/* Painel flutuante */}
      {isOpen && (
        <div
          ref={panelRef}
          className="fixed z-[9999] flex flex-col overflow-hidden rounded-lg border border-slate-600 bg-slate-800 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
          style={{ top: position.y, left: position.x, width: 660, height: panelHeight }}
        >
          {/* ── Header ── */}
          <div
            className="flex shrink-0 cursor-move select-none items-center justify-between border-b border-slate-700 bg-slate-900 px-3 py-2"
            onMouseDown={handleDragStart}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Receipt size={14} className="shrink-0 text-amber-400" />
              <span className="truncate text-xs font-medium text-slate-300 max-w-[240px]">
                {description}
              </span>
              {isMock && (
                <span className="shrink-0 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-400">
                  MOCK
                </span>
              )}
              {hasPixQr && (
                <span className="shrink-0 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-400">
                  + PIX
                </span>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {digitableLine && (
                <button onClick={handleCopyLinha}
                  className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-300 transition hover:bg-slate-700 hover:text-white"
                  title="Copiar linha digitável">
                  <Copy size={11} /> Linha
                </button>
              )}
              {pixCopyPaste && (
                <button onClick={handleCopyPix}
                  className="flex items-center gap-1 rounded border border-emerald-600/40 bg-emerald-600/15 px-2 py-1 text-[10px] font-semibold text-emerald-300 transition hover:bg-emerald-600/30 hover:text-white"
                  title="Copiar Pix copia e cola">
                  <Copy size={11} /> Pix
                </button>
              )}
              <button onClick={handlePrint}
                className="flex items-center gap-1 rounded border border-indigo-500/40 bg-indigo-500/20 px-2 py-1 text-[10px] font-semibold text-indigo-300 transition hover:bg-indigo-500/40 hover:text-white"
                title="Imprimir boleto">
                <Printer size={11} /> Imprimir
              </button>
              <button onClick={handleDownload}
                className="flex items-center gap-1 rounded border border-slate-600 bg-slate-700/50 px-2 py-1 text-[10px] font-semibold text-slate-300 transition hover:bg-slate-700 hover:text-white"
                title="Salvar boleto">
                <Download size={11} /> Salvar
              </button>
              <div className="mx-0.5 h-4 w-px bg-slate-700" />
              <button onClick={() => setIsOpen(false)}
                className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-slate-700 hover:text-red-400"
                title="Fechar (Esc)">
                <X size={13} />
              </button>
            </div>
          </div>

          {/* ── Avisos ── */}
          {isMock && (
            <div className="flex shrink-0 items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-[10px] text-amber-300">
              <AlertTriangle size={11} className="shrink-0" />
              Dados simulados — não efetue pagamento com este boleto.
            </div>
          )}

          {/* ── Linha digitável ── */}
          {digitableLine && (
            <div onClick={handleCopyLinha} title="Clique para copiar"
              className="flex shrink-0 cursor-pointer items-center justify-between gap-2 border-b border-slate-700 bg-slate-950/60 px-3 py-2 text-[11px]">
              <span className="truncate font-mono text-slate-300">{digitableLine}</span>
              <Copy size={11} className="shrink-0 text-slate-500" />
            </div>
          )}

          {/* ── QR Code + Pix copia e cola (painel lateral) ── */}
          {hasPixQr && charge.pixQrCode && (
            <div className="flex shrink-0 items-center gap-4 border-b border-slate-700 bg-slate-900/80 px-4 py-3">
              {/* QR Code visual */}
              <div className="shrink-0 rounded-lg border border-slate-600 bg-white p-2">
                <QRCodeSVG
                  value={charge.pixQrCode}
                  size={80}
                  level="M"
                  marginSize={1}
                  bgColor="#ffffff"
                  fgColor="#000000"
                />
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    Pague via Pix
                  </span>
                  <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300 border border-emerald-500/20">
                    Instantâneo
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Aponte a câmera para o QR Code ou copie o código Pix abaixo.
                </p>
                {pixCopyPaste && (
                  <div
                    onClick={handleCopyPix}
                    className="flex cursor-pointer items-center gap-2 rounded border border-emerald-500/20 bg-emerald-500/5 px-2 py-1.5 text-[9px] text-emerald-200 hover:bg-emerald-500/10 transition"
                    title="Clique para copiar"
                  >
                    <span className="flex-1 truncate font-mono">{pixCopyPaste}</span>
                    <Copy size={10} className="shrink-0 text-emerald-400" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Iframe do boleto ── */}
          <div className="relative flex-1 bg-white">
            {blobUrl ? (
              <iframe
                ref={iframeRef}
                src={blobUrl}
                className="h-full w-full border-0"
                title={`Boleto — ${description}`}
              />
            ) : (
              <div className="flex h-full items-center justify-center gap-2 text-slate-500">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                <span className="text-xs">Gerando boleto...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
