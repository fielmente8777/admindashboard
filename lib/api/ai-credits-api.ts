import { adminClient } from "./admin-client";
import type { ApiClient } from "./api-client";

// gian-new's /api/v1/admin/ai-credits. Wallets, prices, packages and settings are gian's (it charges
// every AI call); the console reads them and changes them with gian's own rules.

export type WalletStatus = "active" | "suspended";
export type WalletLevel = "healthy" | "low" | "critical" | "empty";
export type RowStatus = "active" | "inactive";

export interface Wallet {
  ndid: string;
  /** false until gian or staff create the wallet */
  exists: boolean;
  balance: number;
  /** held by AI requests running right now */
  reservedCredits: number;
  available: number;
  totalPurchased: number;
  totalUsed: number;
  totalAdjustedIn: number;
  totalAdjustedOut: number;
  status: WalletStatus;
  lastRechargeAt: string | null;
}

export interface AiClientRow {
  ndid: string;
  hotelName: string | null;
  hotelEmail: string | null;
  wallet: Wallet;
  level: WalletLevel;
}

export interface UsageRow {
  key: string;
  credits: number;
  tokens: number;
  costUsd: number;
  operations: number;
}

export interface AiClientDetail extends AiClientRow {
  usage: {
    from: string;
    credits: number;
    uncollectedCredits: number;
    tokens: number;
    costUsd: number;
    operations: number;
    byService: UsageRow[];
    byModel: UsageRow[];
  };
}

export interface LedgerEntry {
  id: string;
  type: "purchase" | "usage" | "adjustment";
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  service: string | null;
  description: string;
  referenceId: string;
  performedBy: string | null;
  createdAt: string;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface AdjustmentResult {
  transactionId: string;
  balanceBefore: number;
  balanceAfter: number;
  replayed: boolean;
}

export interface BulkGrantResult {
  results: { ndid: string; ok: boolean; balanceAfter?: number; replayed?: boolean; error?: string }[];
  granted: number;
  failed: number;
}

export interface SyncStatus {
  at: string;
  ok: boolean;
  from: string | null;
  to: string | null;
  rows: number;
  error: string | null;
}

export interface PoolSettings {
  lowPoolUsd: number;
  lowRunwayDays: number;
  alertEmails: string[];
  usdInrRate: number | null;
  usdInrRateUpdatedAt: string | null;
  updatedBy: string | null;
}

export interface CreditSettings {
  /** Master switch. Off: gian runs AI free for every hotel (nothing held, charged or blocked). */
  enabled: boolean;
  lowThreshold: number;
  criticalThreshold: number;
  chatReserveCredits: number;
  reserveMultiplier: number;
  reservationTtlMinutes: number;
  fallbackCreditsPer1kTokens: number;
  fallbackCreditsPerRequest: number;
}

export interface Overview {
  openai: {
    configured: boolean;
    lastSync: SyncStatus | null;
    topUpsUsd: number;
    trackedSince: string | null;
    spentUsd: number;
    remainingUsd: number | null;
    spend: { todayUsd: number; last7Usd: number; last30Usd: number };
    avgDailyUsd: number;
    runwayDays: number | null;
  };
  credits: {
    wallets: number;
    suspended: number;
    balance: number;
    reserved: number;
    available: number;
    totalPurchased: number;
    totalUsed: number;
  };
  coverage: { creditsPerUsd: number | null; liabilityUsd: number | null; ratio: number | null };
  alerts: ("low_pool" | "low_runway")[];
  settings: PoolSettings;
  lowWallets: AiClientRow[];
  appliesWithinSeconds: number;
  /** gian's AI credits switch (Settings tab) */
  chargingEnabled: boolean;
}

export interface ReconciliationDay {
  date: string;
  openaiUsd: number;
  trackedUsd: number;
  billedUsd: number;
  gapUsd: number;
  calls: number;
}

export interface Reconciliation {
  from: string;
  to: string;
  days: ReconciliationDay[];
  totals: Omit<ReconciliationDay, "date">;
  lineItems: { lineItem: string; amountUsd: number }[];
}

export interface TopUp {
  id: string;
  amountUsd: number;
  paidOn: string;
  note: string | null;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string | null;
}
export type TopUpInput = Pick<TopUp, "amountUsd" | "paidOn" | "note">;

export interface PricingRow {
  id: string;
  provider: string;
  model: string;
  inputPrice: number;
  outputPrice: number;
  embeddingPrice: number;
  requestPrice: number;
  currency: string;
  creditConversionRate: number;
  status: RowStatus;
  updatedAt: string | null;
  updatedBy: string | null;
  costPerCreditUsd: number | null;
  costPerCreditInr: number | null;
  marginPct: number | null;
}
export type PricingInput = Pick<
  PricingRow,
  | "provider"
  | "model"
  | "inputPrice"
  | "outputPrice"
  | "embeddingPrice"
  | "requestPrice"
  | "currency"
  | "creditConversionRate"
  | "status"
>;

export interface PricingList {
  items: PricingRow[];
  salePerCreditInr: { min: number; max: number } | null;
  appliesWithinSeconds: number;
}

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  currency: string;
  status: RowStatus;
  popular: boolean;
  sortOrder: number;
  updatedAt: string | null;
}
export type PackageInput = Omit<CreditPackage, "id" | "updatedAt">;

export interface AiSettings {
  credits: CreditSettings;
  pool: PoolSettings;
  appliesWithinSeconds: number;
}

export interface GianAuditEntry {
  id: string;
  actor: string;
  action: string;
  tenantId: string | null;
  target: string | null;
  before: unknown;
  after: unknown;
  reason: string | null;
  ip: string | null;
  createdAt: string;
}

const qs = (params: Record<string, string | number | undefined>) => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") query.set(key, String(value));
  const text = query.toString();
  return text ? `?${text}` : "";
};

/** gian-new's /api/v1/admin/ai-credits endpoints. */
export class AiCreditsApi {
  constructor(private readonly client: ApiClient) {}

  // credits.view (assigned clients only)
  clients(q: { search?: string; after?: string; limit?: number }): Promise<Page<AiClientRow>> {
    return this.client.get(`/admin/ai-credits/clients${qs(q)}`);
  }
  clientWallet(ndid: string): Promise<AiClientDetail> {
    return this.client.get(`/admin/ai-credits/clients/${encodeURIComponent(ndid)}`);
  }
  transactions(ndid: string, before?: string): Promise<Page<LedgerEntry>> {
    return this.client.get(`/admin/ai-credits/clients/${encodeURIComponent(ndid)}/transactions${qs({ before, limit: 25 })}`);
  }

  // credits.manage
  adjust(
    ndid: string,
    body: { direction: "add" | "deduct"; amount: number; reason: string; idempotencyKey: string },
  ): Promise<AdjustmentResult> {
    return this.client.post(`/admin/ai-credits/clients/${encodeURIComponent(ndid)}/adjust`, body);
  }
  setStatus(ndid: string, status: WalletStatus, reason: string): Promise<Wallet> {
    return this.client.put(`/admin/ai-credits/clients/${encodeURIComponent(ndid)}/status`, { status, reason });
  }
  bulkGrant(body: { ndids: string[]; amount: number; reason: string; batchId: string }): Promise<BulkGrantResult> {
    return this.client.post("/admin/ai-credits/clients/bulk-grant", body);
  }

  // credits.pricing
  overview(): Promise<Overview> {
    return this.client.get("/admin/ai-credits/overview");
  }
  costs(days: number): Promise<Reconciliation> {
    return this.client.get(`/admin/ai-credits/openai/costs${qs({ days })}`);
  }
  sync(): Promise<SyncStatus> {
    return this.client.post("/admin/ai-credits/openai/sync");
  }
  topUps(): Promise<{ items: TopUp[]; totalUsd: number }> {
    return this.client.get("/admin/ai-credits/openai/topups");
  }
  addTopUp(body: TopUpInput): Promise<TopUp> {
    return this.client.post("/admin/ai-credits/openai/topups", body);
  }
  editTopUp(id: string, body: Partial<TopUpInput>): Promise<TopUp> {
    return this.client.patch(`/admin/ai-credits/openai/topups/${id}`, body);
  }
  pricing(): Promise<PricingList> {
    return this.client.get("/admin/ai-credits/pricing");
  }
  createPricing(body: PricingInput): Promise<PricingRow> {
    return this.client.post("/admin/ai-credits/pricing", body);
  }
  updatePricing(id: string, body: Partial<PricingInput>): Promise<PricingRow> {
    return this.client.patch(`/admin/ai-credits/pricing/${id}`, body);
  }
  packages(): Promise<CreditPackage[]> {
    return this.client.get("/admin/ai-credits/packages");
  }
  createPackage(body: PackageInput): Promise<CreditPackage> {
    return this.client.post("/admin/ai-credits/packages", body);
  }
  updatePackage(id: string, body: Partial<PackageInput>): Promise<CreditPackage> {
    return this.client.patch(`/admin/ai-credits/packages/${id}`, body);
  }
  settings(): Promise<AiSettings> {
    return this.client.get("/admin/ai-credits/settings");
  }
  saveSettings(body: { credits?: Partial<CreditSettings>; pool?: Partial<Omit<PoolSettings, "usdInrRateUpdatedAt" | "updatedBy">> }): Promise<AiSettings> {
    return this.client.put("/admin/ai-credits/settings", body);
  }
  audit(q: { ndid?: string; before?: string }): Promise<Page<GianAuditEntry>> {
    return this.client.get(`/admin/ai-credits/audit${qs({ ...q, limit: 50 })}`);
  }
}

export const aiCreditsApi = new AiCreditsApi(adminClient);

// ── formatting ─────────────────────────────────────────────────────────────────────────────

const creditsFormat = new Intl.NumberFormat("en-IN");
export const credits = (n: number) => creditsFormat.format(n);

export function usd(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function inr(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** "2026-11-11" → "11 Nov 2026" (UTC day, as OpenAI counts it). */
export function utcDay(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export const LEVEL_LABEL: Record<WalletLevel, string> = {
  healthy: "Healthy",
  low: "Low",
  critical: "Critical",
  empty: "Empty",
};

/** One request key per click, so a retried request adds or removes credits once. */
export const requestKey = () => `console-${crypto.randomUUID()}`;
