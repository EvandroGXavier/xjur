import { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  FileArchive,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../../services/api";

interface Props {
  bankAccount: {
    id: string;
    title: string;
    bankName?: string;
    agency?: string;
    accountNumber?: string;
    contact?: {
      name?: string;
      cpf?: string;
      cnpj?: string;
    } | null;
  };
}

interface SecretItem {
  id: string;
  description: string;
  username?: string;
  password?: string;
  details?: string;
  publicKey?: string;
  privateKey?: string;
}

interface Integration {
  id: string;
  displayName: string;
  provider: string;
  environment: "SANDBOX" | "PRODUCTION";
  isActive?: boolean;
  bankAccountId?: string | null;
  externalAccountId?: string | null;
  accountHolderName?: string | null;
  accountHolderDocument?: string | null;
  branchCode?: string | null;
  accountNumber?: string | null;
  webhookEnabled?: boolean;
  webhookUrl?: string | null;
  metadata?: Record<string, any> | null;
  credentialSecretId?: string | null;
  certificateSecretId?: string | null;
  webhookSecretId?: string | null;
  lastHealthcheckStatus?: string | null;
  lastHealthcheckError?: string | null;
}

const envLabel = (environment: "SANDBOX" | "PRODUCTION") =>
  environment === "PRODUCTION" ? "Producao" : "Sandbox";

const labelsOf = (displayName: string, environment: "SANDBOX" | "PRODUCTION") => {
  const suffix = `${displayName} | ${envLabel(environment)}`;
  return {
    credentials: `Banco Inter | ${suffix} | Credenciais`,
    certificate: `Banco Inter | ${suffix} | Certificado`,
    webhook: `Banco Inter | ${suffix} | Webhook`,
  };
};

const normalizeDocument = (value?: string | null) =>
  String(value || "")
    .replace(/\D/g, "")
    .trim();

export function BankAccountInterSigiloPanel({ bankAccount }: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zipLabel, setZipLabel] = useState("");
  const [form, setForm] = useState({
    displayName: `Banco Inter - ${bankAccount.title || "Conta bancária"}`,
    environment: "SANDBOX" as "SANDBOX" | "PRODUCTION",
    externalAccountId: "",
    accountHolderName: bankAccount.contact?.name || "",
    accountHolderDocument: normalizeDocument(
      bankAccount.contact?.cpf || bankAccount.contact?.cnpj || "",
    ),
    branchCode: bankAccount.agency || "",
    accountNumber: bankAccount.accountNumber || "",
    clientId: "",
    clientSecret: "",
    webhookEnabled: false,
    webhookUrl: "",
    webhookSecret: "",
    tokenUrl: "",
    certificateBase64: "",
    certificatePem: "",
    privateKeyPem: "",
  });

  const labels = useMemo(
    () => labelsOf(form.displayName.trim(), form.environment),
    [form.displayName, form.environment],
  );

  const setField = (key: keyof typeof form, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));

  const pickCurrentIntegration = (items: Integration[]) => {
    const linked = items.filter(
      (item) =>
        item.provider === "INTER" && item.bankAccountId === bankAccount.id,
    );

    return (
      linked.find(
        (item) => item.isActive && item.environment === "PRODUCTION",
      ) ||
      linked.find((item) => item.isActive) ||
      linked[0] ||
      null
    );
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const integrationsRes = await api.get("/banking/integrations");
      const integrations = Array.isArray(integrationsRes.data)
        ? integrationsRes.data
        : [];
      const currentIntegration = pickCurrentIntegration(integrations);

      let secrets: SecretItem[] = [];
      if (currentIntegration?.id) {
        const secretsRes = await api.get(
          `/security/secrets?entityType=BANK_INTEGRATION&entityId=${currentIntegration.id}`,
        );
        secrets = Array.isArray(secretsRes.data) ? secretsRes.data : [];
      }

      const currentMetadata =
        currentIntegration?.metadata &&
        typeof currentIntegration.metadata === "object"
          ? currentIntegration.metadata
          : {};
      const clientSecret =
        secrets.find(
          (item) => item.id === currentIntegration?.credentialSecretId,
        ) ||
        secrets.find((item) => item.description === labels.credentials) ||
        null;
      const certificateSecret =
        secrets.find(
          (item) => item.id === currentIntegration?.certificateSecretId,
        ) ||
        secrets.find((item) => item.description === labels.certificate) ||
        null;
      const webhookSecret =
        secrets.find((item) => item.id === currentIntegration?.webhookSecretId) ||
        secrets.find((item) => item.description === labels.webhook) ||
        null;

      setIntegration(currentIntegration);
      setZipFile(null);
      setZipLabel(String(currentMetadata.sigiloZipOriginal || ""));
      setForm({
        displayName:
          currentIntegration?.displayName ||
          `Banco Inter - ${bankAccount.title || "Conta bancária"}`,
        environment: currentIntegration?.environment || "SANDBOX",
        externalAccountId: currentIntegration?.externalAccountId || "",
        accountHolderName:
          currentIntegration?.accountHolderName ||
          bankAccount.contact?.name ||
          "",
        accountHolderDocument:
          currentIntegration?.accountHolderDocument ||
          normalizeDocument(
            bankAccount.contact?.cpf || bankAccount.contact?.cnpj || "",
          ),
        branchCode: currentIntegration?.branchCode || bankAccount.agency || "",
        accountNumber:
          currentIntegration?.accountNumber || bankAccount.accountNumber || "",
        clientId: clientSecret?.username || "",
        clientSecret: clientSecret?.password || "",
        webhookEnabled: Boolean(currentIntegration?.webhookEnabled),
        webhookUrl: currentIntegration?.webhookUrl || "",
        webhookSecret: webhookSecret?.password || "",
        tokenUrl: clientSecret?.details || "",
        certificateBase64: certificateSecret?.publicKey
          ? ""
          : certificateSecret?.privateKey || "",
        certificatePem: certificateSecret?.publicKey || "",
        privateKeyPem: certificateSecret?.publicKey
          ? certificateSecret?.privateKey || ""
          : "",
      });
    } catch (error: any) {
      toast.error(
        error.response?.data?.message ||
          "Erro ao carregar o sigilo bancário da conta.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [bankAccount.id]);

  const parseZip = async (file: File | null) => {
    if (!file) return;

    try {
      const zip = await JSZip.loadAsync(file);
      const files = Object.values(zip.files).filter((entry) => !entry.dir);
      const pfx = files.find((entry) => /\.(pfx|p12)$/i.test(entry.name));
      const crt = files.find((entry) => /\.(crt|cer|pem)$/i.test(entry.name));
      const key = files.find((entry) => /\.key$/i.test(entry.name));

      if (pfx) {
        setField("certificateBase64", await pfx.async("base64"));
        setField("certificatePem", "");
        setField("privateKeyPem", "");
      } else if (crt && key) {
        setField("certificateBase64", "");
        setField("certificatePem", await crt.async("string"));
        setField("privateKeyPem", await key.async("string"));
      } else {
        toast.error("O ZIP precisa conter certificado e chave do Banco Inter.");
        return;
      }

      setZipFile(file);
      setZipLabel(file.name);
      toast.success("ZIP do Banco Inter processado.");
    } catch {
      toast.error("Não foi possível abrir o ZIP do Banco Inter.");
    }
  };

  const saveAndConnect = async () => {
    if (!form.displayName.trim() || !form.clientId.trim() || !form.clientSecret.trim()) {
      toast.error("Preencha nome da integração, Client ID e Client Secret.");
      return;
    }

    if (!form.certificateBase64 && !(form.certificatePem && form.privateKeyPem)) {
      toast.error("Envie o ZIP do Banco Inter antes de conectar.");
      return;
    }

    setSaving(true);
    try {
      const currentMetadata =
        integration?.metadata && typeof integration.metadata === "object"
          ? integration.metadata
          : {};

      const payload = {
        displayName: form.displayName.trim(),
        provider: "INTER",
        environment: form.environment,
        bankAccountId: bankAccount.id,
        externalAccountId: form.externalAccountId || undefined,
        accountHolderName: form.accountHolderName || undefined,
        accountHolderDocument: form.accountHolderDocument || undefined,
        branchCode: form.branchCode || undefined,
        accountNumber: form.accountNumber || undefined,
        webhookEnabled: form.webhookEnabled,
        webhookUrl: form.webhookUrl || undefined,
        metadata: {
          ...currentMetadata,
          sigiloOrigem: "BANK_ACCOUNT",
          sigiloContaId: bankAccount.id,
          sigiloContaTitulo: bankAccount.title,
          sigiloBanco: "INTER",
          sigiloZipOriginal: zipLabel || null,
        },
        credentials: {
          clientId: form.clientId.trim(),
          clientSecret: form.clientSecret.trim(),
          tokenUrl: form.tokenUrl.trim() || undefined,
          certificateBase64: form.certificateBase64 || undefined,
          certificatePem: form.certificatePem || undefined,
          privateKeyPem: form.privateKeyPem || undefined,
          webhookSecret: form.webhookSecret.trim() || undefined,
        },
      };

      const integrationResponse = integration
        ? await api.patch(`/banking/integrations/${integration.id}`, payload)
        : await api.post("/banking/integrations", payload);

      await api.post(`/banking/integrations/${integrationResponse.data.id}/health`);
      toast.success("Sigilo salvo e conexão do Banco Inter validada.");
      await loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao salvar a conexão.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        Carregando sigilo bancário da conta...
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-slate-900 to-slate-900 p-6 shadow-xl shadow-black/10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-emerald-200">
            <ShieldCheck size={13} />
            Banco Inter no Sigilo da Conta
          </div>
          <h3 className="mt-4 text-2xl font-black tracking-tight text-white">
            Guardar e conectar a partir da conta bancária
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            A conta bancária passa a ser a origem oficial da conexão. O Banking Hub
            fica para testar, sincronizar e operar.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
          <div className="flex items-center gap-2 font-semibold text-white">
            <Building2 size={16} className="text-emerald-300" />
            {integration ? integration.displayName : "Ainda não conectado"}
          </div>
          <div className="mt-2 text-xs">
            {integration?.lastHealthcheckStatus || "Aguardando validação"}
            {integration?.lastHealthcheckError && (
              <div className="mt-1 text-amber-300">
                {integration.lastHealthcheckError}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <input
          value={form.displayName}
          onChange={(event) => setField("displayName", event.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          placeholder="Nome da integração"
        />
        <select
          value={form.environment}
          onChange={(event) =>
            setField("environment", event.target.value as "SANDBOX" | "PRODUCTION")
          }
          className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
        >
          <option value="SANDBOX">Sandbox</option>
          <option value="PRODUCTION">Produção</option>
        </select>
        <input
          value={bankAccount.title}
          readOnly
          className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-slate-300"
          placeholder="Conta bancária"
        />
        <input
          value={form.externalAccountId}
          onChange={(event) => setField("externalAccountId", event.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          placeholder="External Account ID"
        />
        <input
          value={form.accountHolderName}
          onChange={(event) => setField("accountHolderName", event.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          placeholder="Titular"
        />
        <input
          value={form.accountHolderDocument}
          onChange={(event) =>
            setField("accountHolderDocument", normalizeDocument(event.target.value))
          }
          className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          placeholder="Documento do titular"
        />
        <input
          value={form.branchCode}
          onChange={(event) => setField("branchCode", event.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          placeholder="Agência"
        />
        <input
          value={form.accountNumber}
          onChange={(event) => setField("accountNumber", event.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          placeholder="Conta"
        />
        <input
          value={form.clientId}
          onChange={(event) => setField("clientId", event.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white"
          placeholder="Client ID"
        />
        <input
          value={form.clientSecret}
          onChange={(event) => setField("clientSecret", event.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white"
          placeholder="Client Secret"
        />
      </div>

      <label className="mt-6 block cursor-pointer rounded-2xl border border-dashed border-emerald-500/30 bg-emerald-500/5">
        <input
          type="file"
          accept=".zip"
          className="hidden"
          onChange={(event) => void parseZip(event.target.files?.[0] || null)}
        />
        <div className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-white">Suba o ZIP oficial do Banco Inter.</p>
            <p className="text-sm text-slate-400">
              {zipLabel || "O sistema vai localizar certificado e chave automaticamente."}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white">
            <FileArchive size={16} />
            Selecionar ZIP
          </div>
        </div>
      </label>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <input
          value={form.webhookUrl}
          onChange={(event) => setField("webhookUrl", event.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white"
          placeholder="URL do webhook"
        />
        <input
          value={form.webhookSecret}
          onChange={(event) => setField("webhookSecret", event.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white"
          placeholder="Segredo do webhook"
        />
      </div>

      <label className="mt-4 inline-flex items-center gap-3 text-sm font-semibold text-slate-200">
        <input
          type="checkbox"
          checked={form.webhookEnabled}
          onChange={(event) => setField("webhookEnabled", event.target.checked)}
          className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500"
        />
        Ativar webhook na integração da conta
      </label>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void loadData()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800"
        >
          <RefreshCw size={15} />
          Recarregar
        </button>
        <button
          type="button"
          onClick={() => navigate("/financial")}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/15"
        >
          <ArrowRight size={15} />
          Abrir Banking Hub
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void saveAndConnect()}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {saving ? (
            <RefreshCw size={15} className="animate-spin" />
          ) : (
            <CheckCircle2 size={15} />
          )}
          {saving ? "Conectando..." : "Salvar Sigilo e Conectar"}
        </button>
      </div>
    </div>
  );
}
