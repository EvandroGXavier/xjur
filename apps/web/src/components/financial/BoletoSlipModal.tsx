import { useEffect, useRef, useState } from 'react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { X, Printer, Copy, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BoletoSlipCharge {
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
    description: string;
    amount: number;
    dueDate?: string | null;
  } | null;
}

interface BoletoSlipModalProps {
  charge: BoletoSlipCharge;
  tenantName?: string;
  onClose: () => void;
}

function formatCurrency(value: number | string) {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 'R$ 0,00';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return '--/--/----';
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return dateStr;
  }
}

// Renders a visual barcode using SVG from the numeric barcode string
function BarcodeDisplay({ barcode }: { barcode: string }) {
  const cleaned = barcode.replace(/\D/g, '');
  if (!cleaned) return null;

  // Simple bar representation: 0 → thin bar gap, 1 → thick bar
  // For visual purposes only (not scannable)
  const bars: Array<{ width: number; isBar: boolean }> = [];
  for (let i = 0; i < cleaned.length; i++) {
    const digit = parseInt(cleaned[i]);
    const isOdd = i % 2 === 0;
    bars.push({ width: isOdd ? (digit % 2 === 0 ? 1 : 2) : (digit % 2 === 0 ? 1 : 2), isBar: isOdd });
    bars.push({ width: 1, isBar: !isOdd });
  }

  return (
    <div className="flex items-end justify-center gap-[1px] h-16 print:h-20">
      {bars.map((bar, i) => (
        <div
          key={i}
          className={bar.isBar ? 'bg-black' : 'bg-white'}
          style={{ width: `${bar.width * 2}px`, height: '100%' }}
        />
      ))}
    </div>
  );
}

export function BoletoSlipModal({ charge, tenantName, onClose }: BoletoSlipModalProps) {
  const slipRef = useRef<HTMLDivElement>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const amount = charge.financialRecord?.amount ?? charge.amount;
  const description = charge.financialRecord?.description || 'Cobrança';
  const dueDate = charge.dueDate || charge.financialRecord?.dueDate;
  const bankName = charge.bankIntegration?.displayName || 'Banco Inter';
  const digitableLine = charge.digitableLine || '';
  const barcode = (charge.barcode || '').replace(/\D/g, '');
  const pixCopyPaste = charge.pixCopyPaste || '';
  const isMock = charge.status?.includes('MOCK');
  const hasPixQr = Boolean(charge.pixQrCode);

  // Extract data URL from canvas for print mode
  useEffect(() => {
    if (!hasPixQr) return;
    const attempt = () => {
      const canvas = qrCanvasRef.current;
      if (canvas) {
        try { setQrDataUrl(canvas.toDataURL('image/png')); }
        catch { /* canvas not ready */ }
      }
    };
    const t = setTimeout(attempt, 120);
    return () => clearTimeout(t);
  }, [hasPixQr, charge.pixQrCode]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handlePrint = () => {
    const printContent = slipRef.current?.innerHTML;
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      toast.error('Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>Boleto — ${description}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Arial', sans-serif;
            font-size: 11px;
            color: #111;
            background: white;
            padding: 20px;
          }
          .slip { max-width: 720px; margin: 0 auto; border: 1px solid #ccc; }
          .header {
            display: flex;
            align-items: stretch;
            border-bottom: 2px solid #333;
          }
          .header-bank {
            flex: 0 0 200px;
            padding: 10px 12px;
            border-right: 2px solid #333;
            display: flex;
            align-items: center;
            font-size: 18px;
            font-weight: bold;
          }
          .header-code {
            flex: 0 0 80px;
            padding: 10px 12px;
            border-right: 2px solid #333;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            font-weight: bold;
          }
          .header-line {
            flex: 1;
            padding: 10px 12px;
            display: flex;
            align-items: center;
            font-family: monospace;
            font-size: 13px;
            letter-spacing: 2px;
            font-weight: bold;
          }
          .fields-row {
            display: flex;
            border-bottom: 1px solid #ccc;
          }
          .field {
            flex: 1;
            padding: 6px 10px;
            border-right: 1px solid #ccc;
          }
          .field:last-child { border-right: none; }
          .field-label {
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #555;
            margin-bottom: 2px;
          }
          .field-value {
            font-size: 12px;
            font-weight: 600;
            color: #111;
          }
          .field-amount .field-value {
            font-size: 16px;
            font-weight: bold;
          }
          .description-row {
            padding: 8px 10px;
            border-bottom: 1px solid #ccc;
          }
          .barcode-section {
            padding: 16px 10px 8px;
            border-bottom: 1px solid #ccc;
            text-align: center;
          }
          .barcode-bars {
            display: flex;
            align-items: flex-end;
            justify-content: center;
            gap: 1px;
            height: 60px;
            margin-bottom: 8px;
          }
          .bar { height: 100%; }
          .barcode-number {
            font-family: monospace;
            font-size: 11px;
            letter-spacing: 1px;
            color: #333;
          }
          .instructions {
            padding: 10px;
            background: #f5f5f5;
            font-size: 9px;
            color: #555;
            line-height: 1.6;
          }
          .mock-warning {
            background: #fff3cd;
            border: 1px solid #ffc107;
            color: #856404;
            padding: 8px 12px;
            margin-bottom: 12px;
            font-size: 10px;
            text-align: center;
          }
          .footer {
            padding: 8px 10px;
            font-size: 9px;
            color: #888;
            text-align: right;
          }
          .pix-print {
            border-top: 1px dashed #ccc;
            margin-top: 10px;
            padding: 10px;
            display: flex;
            gap: 15px;
          }
          .pix-print-text {
            flex: 1;
          }
          .pix-print-qr {
            flex: 0 0 100px;
            text-align: center;
          }
          @media print {
            body { padding: 0; }
            .slip { border: none; }
          }
        </style>
      </head>
      <body>
        ${isMock ? '<div class="mock-warning">⚠️ DOCUMENTO DE TESTE — Dados simulados (modo MOCK). Não realizar pagamento.</div>' : ''}
        <div class="slip">
          <div class="header">
            <div class="header-bank">${bankName}</div>
            <div class="header-code">077-7</div>
            <div class="header-line">${digitableLine || '00000.000000 00000.000000 00000.000000 0 00000000000000'}</div>
          </div>

          <div class="fields-row">
            <div class="field" style="flex: 2">
              <div class="field-label">Beneficiário</div>
              <div class="field-value">${tenantName || 'Empresa'}</div>
            </div>
            <div class="field">
              <div class="field-label">Agência / Código Beneficiário</div>
              <div class="field-value">0001 / 00000000</div>
            </div>
          </div>

          <div class="fields-row">
            <div class="field" style="flex: 2">
              <div class="field-label">Descrição / Nosso Número</div>
              <div class="field-value">${description}</div>
            </div>
            <div class="field">
              <div class="field-label">Data de Vencimento</div>
              <div class="field-value">${formatDate(dueDate)}</div>
            </div>
            <div class="field field-amount">
              <div class="field-label">Valor do Documento</div>
              <div class="field-value">${formatCurrency(amount)}</div>
            </div>
          </div>

          <div class="fields-row">
            <div class="field" style="flex: 2">
              <div class="field-label">Espécie Doc.</div>
              <div class="field-value">DM</div>
            </div>
            <div class="field">
              <div class="field-label">Aceite</div>
              <div class="field-value">N</div>
            </div>
            <div class="field">
              <div class="field-label">Data do Documento</div>
              <div class="field-value">${format(new Date(), 'dd/MM/yyyy', { locale: ptBR })}</div>
            </div>
            <div class="field">
              <div class="field-label">Valor Cobrado</div>
              <div class="field-value">${formatCurrency(amount)}</div>
            </div>
          </div>

          <div class="description-row">
            <div class="field-label">Instruções ao caixa / Informações</div>
            <div class="field-value" style="font-size:11px; margin-top: 4px;">
              Cobrar multa de 2% após o vencimento. Juros de 0,033% ao dia.
              Pagável em qualquer banco ou internet banking até a data de vencimento.
            </div>
          </div>

          <div class="barcode-section">
            <div class="barcode-bars">
              ${generateBarcodeBars(barcode)}
            </div>
            <div class="barcode-number">${barcode || '00000000000000000000000000000000000000000000'}</div>
          </div>

          ${hasPixQr && qrDataUrl ? `
          <div class="pix-print">
            <div class="pix-print-text">
              <div style="font-size:11px;font-weight:bold;color:#111;margin-bottom:4px;text-transform:uppercase;">
                Pague também via Pix
              </div>
              <div style="font-size:9px;color:#555;margin-bottom:8px">
                Aponte a câmera para o QR Code ao lado ou copie e cole o código Pix abaixo.
              </div>
              <div style="font-size:9px;color:#111;font-weight:bold;margin-bottom:4px">Pix Copia e Cola:</div>
              <div style="font-family:monospace;font-size:8px;word-break:break-all;background:#f5f5f5;padding:6px;border:1px solid #ddd;">
                ${pixCopyPaste || '—'}
              </div>
            </div>
            <div class="pix-print-qr">
              <img src="${qrDataUrl}" width="100" height="100" alt="QR Code Pix" style="border:1px solid #ccc;padding:2px;"/>
            </div>
          </div>
          ` : ''}

          <div class="instructions">
            <strong>Instruções:</strong> Este boleto é válido até a data de vencimento indicada.
            Após o vencimento, entre em contato com o beneficiário para reemissão.
            Não receber após 30 dias do vencimento.
          </div>

          <div class="footer">Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} — Dr.X / Xjur</div>
        </div>
        <script>window.onload = () => { window.print(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleCopy = (value: string, label: string) => {
    navigator.clipboard.writeText(value).then(() => {
      toast.success(`${label} copiado!`);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white text-slate-900 shadow-2xl">
        {/* Toolbar */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <h2 className="text-base font-bold text-slate-800">Boleto Bancário</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 transition"
            >
              <Printer size={15} />
              Imprimir / Salvar PDF
            </button>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Mock warning */}
        {isMock && (
          <div className="mx-5 mt-4 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600" />
            <span>
              <strong>Documento de teste</strong> — Este boleto foi gerado em modo MOCK (simulado).
              Os dados de barras e linha digitável são fictícios. Não realize pagamentos.
            </span>
          </div>
        )}

        {/* Slip preview */}
        <div ref={slipRef} className="m-5 rounded-lg border border-slate-300 font-mono text-[11px] text-slate-900 overflow-hidden">
          {/* Bank header */}
          <div className="flex border-b-2 border-slate-800">
            <div className="flex items-center border-r-2 border-slate-800 px-3 py-2 w-48 shrink-0">
              <span className="text-base font-bold">{bankName}</span>
            </div>
            <div className="flex items-center border-r-2 border-slate-800 px-3 py-2 w-16 justify-center">
              <span className="text-base font-bold">077-7</span>
            </div>
            <div className="flex items-center flex-1 px-3 py-2">
              <span className="text-sm tracking-widest font-bold break-all">
                {digitableLine || '00000.000000 00000.000000 00000.000000 0 00000000000000'}
              </span>
            </div>
          </div>

          {/* Beneficiário + agência */}
          <div className="flex border-b border-slate-300">
            <div className="flex-[2] border-r border-slate-300 p-2">
              <p className="text-[9px] uppercase tracking-wider text-slate-500">Beneficiário</p>
              <p className="mt-0.5 font-semibold text-sm text-slate-800">{tenantName || 'Empresa'}</p>
            </div>
            <div className="flex-1 p-2">
              <p className="text-[9px] uppercase tracking-wider text-slate-500">Agência / Cód. Beneficiário</p>
              <p className="mt-0.5 font-semibold text-slate-800">0001 / 00000000-0</p>
            </div>
          </div>

          {/* Descrição + vencimento + valor */}
          <div className="flex border-b border-slate-300">
            <div className="flex-[2] border-r border-slate-300 p-2">
              <p className="text-[9px] uppercase tracking-wider text-slate-500">Descrição / Número do Documento</p>
              <p className="mt-0.5 font-semibold text-slate-800 text-sm">{description}</p>
            </div>
            <div className="border-r border-slate-300 p-2 w-28">
              <p className="text-[9px] uppercase tracking-wider text-slate-500">Vencimento</p>
              <p className="mt-0.5 font-bold text-slate-800 text-sm">{formatDate(dueDate)}</p>
            </div>
            <div className="p-2 w-32">
              <p className="text-[9px] uppercase tracking-wider text-slate-500">Valor do Documento</p>
              <p className="mt-0.5 font-bold text-slate-800 text-base">{formatCurrency(amount)}</p>
            </div>
          </div>

          {/* Espécie / aceite / data */}
          <div className="flex border-b border-slate-300">
            <div className="border-r border-slate-300 p-2 w-24">
              <p className="text-[9px] uppercase tracking-wider text-slate-500">Espécie Doc.</p>
              <p className="mt-0.5 font-semibold text-slate-800">DM</p>
            </div>
            <div className="border-r border-slate-300 p-2 w-20">
              <p className="text-[9px] uppercase tracking-wider text-slate-500">Aceite</p>
              <p className="mt-0.5 font-semibold text-slate-800">N</p>
            </div>
            <div className="flex-1 p-2">
              <p className="text-[9px] uppercase tracking-wider text-slate-500">Data do Documento</p>
              <p className="mt-0.5 font-semibold text-slate-800">{format(new Date(), 'dd/MM/yyyy', { locale: ptBR })}</p>
            </div>
            <div className="p-2 w-32">
              <p className="text-[9px] uppercase tracking-wider text-slate-500">Valor Cobrado</p>
              <p className="mt-0.5 font-bold text-slate-800">{formatCurrency(amount)}</p>
            </div>
          </div>

          {/* Instruções */}
          <div className="border-b border-slate-300 p-2">
            <p className="text-[9px] uppercase tracking-wider text-slate-500">Instruções ao caixa</p>
            <p className="mt-1 text-slate-700 text-[10px] leading-relaxed">
              Cobrar multa de 2% após o vencimento. Juros de 0,033% ao dia.<br />
              Pagável em qualquer banco ou internet banking até a data de vencimento.<br />
              Não receber após 30 dias do vencimento.
            </p>
          </div>

          {/* Barcode */}
          <div className="border-b border-slate-300 p-3 flex flex-col items-center gap-2">
            {barcode ? (
              <BarcodeDisplay barcode={barcode} />
            ) : (
              <div className="h-16 flex items-center justify-center text-slate-400 text-xs">
                Código de barras não disponível
              </div>
            )}
            <p className="font-mono text-xs tracking-widest text-slate-600">
              {barcode || '—'}
            </p>
          </div>

          {/* Seção PIX UI (visualização no modal) */}
          {hasPixQr && charge.pixQrCode && (
            <div className="border-b border-slate-300 p-4 bg-emerald-50">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="text-xs font-bold uppercase text-emerald-700 tracking-wider mb-1">
                    Pague também via Pix
                  </div>
                  <div className="text-[10px] text-slate-600 mb-3">
                    Aponte a câmera do seu celular para o QR Code ao lado ou copie e cole o código abaixo.
                  </div>
                  <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">Pix Copia e Cola</div>
                  <div className="font-mono text-[9px] bg-white border border-slate-300 rounded p-2 text-slate-800 break-all select-all">
                    {pixCopyPaste}
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-center">
                  <div className="bg-white p-1 border border-slate-300 rounded-lg shadow-sm">
                    <QRCodeSVG
                      value={charge.pixQrCode}
                      size={100}
                      level="M"
                      marginSize={1}
                    />
                  </div>
                  <div className="text-[9px] text-emerald-700 font-semibold mt-1">QR Code Pix</div>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="bg-slate-50 px-3 py-2 text-[9px] text-slate-400 text-right">
            Gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} — Dr.X / Xjur
          </div>
        </div>

        {/* Action bar */}
        {digitableLine && (
          <div className="mx-5 mb-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Linha Digitável</p>
            <div className="flex items-center gap-2">
              <p className="flex-1 font-mono text-sm text-slate-800 break-all">{digitableLine}</p>
              <button
                onClick={() => handleCopy(digitableLine, 'Linha digitável')}
                className="shrink-0 flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                <Copy size={13} />
                Copiar
              </button>
            </div>
          </div>
        )}

        {/* Action bar Pix */}
        {hasPixQr && pixCopyPaste && (
          <div className="mx-5 mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-2">Pix Copia e Cola</p>
            <div className="flex items-center gap-2">
              <p className="flex-1 font-mono text-xs text-emerald-800 truncate">{pixCopyPaste}</p>
              <button
                onClick={() => handleCopy(pixCopyPaste, 'Pix copia e cola')}
                className="shrink-0 flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition"
              >
                <Copy size={13} />
                Copiar Pix
              </button>
            </div>
          </div>
        )}

        {/* Hidden Canvas for QR Code Data URL extraction */}
        {hasPixQr && charge.pixQrCode && (
          <div style={{ position: 'absolute', left: -9999, top: -9999, pointerEvents: 'none' }}>
            <QRCodeCanvas
              ref={qrCanvasRef}
              value={charge.pixQrCode}
              size={160}
              level="M"
              marginSize={2}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Helper: generate bar HTML for print window
function generateBarcodeBars(barcode: string): string {
  if (!barcode) return '';
  const cleaned = barcode.replace(/\D/g, '');
  let html = '';
  for (let i = 0; i < cleaned.length; i++) {
    const digit = parseInt(cleaned[i]);
    const isOdd = i % 2 === 0;
    const width = (digit % 3) + 1;
    const color = isOdd ? '#000000' : '#ffffff';
    html += `<div class="bar" style="width:${width * 2}px;background:${color};border: ${isOdd ? 'none' : '1px solid #eee'};"></div>`;
  }
  return html;
}
