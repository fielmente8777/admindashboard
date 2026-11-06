import { adminClient } from "./admin-client";
import type { ApiClient } from "./api-client";

/** -1 means unlimited. */
export interface PlanLimits {
  teamMembers: number;
  properties: number;
  aiCreditsMonthly: number;
  maxLeadsPerMonth: number;
}

export type SupportLevel = "none" | "standard" | "premium" | "enterprise";

/** A plan. `price` is rupees per month before GST. */
export interface CataloguePlan {
  id: string;
  code: string;
  name: string;
  tagline: string;
  price: number;
  includedApps: string[];
  highlights: string[];
  limits: PlanLimits;
  support: SupportLevel;
  isPublic: boolean;
  isCustom: boolean;
  customPriceLabel: string;
  customPriceNote: string;
  customCtaLabel: string;
  visibleTo: string[];
  isActive: boolean;
  featured: boolean;
  sortOrder: number;
  updatedAt: string | null;
}

export type PlanInput = Omit<CataloguePlan, "id" | "updatedAt">;

export interface CatalogueApp {
  id: string;
  code: string;
  name: string;
  description: string;
  price: number;
  isActive: boolean;
  sortOrder: number;
}

export type AppInput = Omit<CatalogueApp, "id">;

export interface BillingCycle {
  months: number;
  label: string;
  discountPercent: number;
  isActive: boolean;
}

/** Eazotel's details printed on every invoice. */
export interface InvoiceSeller {
  name: string;
  address: string;
  state: string;
  gstin: string;
  pan: string;
  email: string;
  phone: string;
  sac: string;
  prefix: string;
}

export interface BillingSettings {
  invoice: InvoiceSeller;
  currency: string;
  gstPercent: number;
  seatPrice: number;
  trialDays: number;
  cycles: BillingCycle[];
  updatedAt: string | null;
  updatedBy: string | null;
}

export type SettingsInput = Pick<BillingSettings, "gstPercent" | "seatPrice" | "trialDays" | "cycles"> & {
  invoice?: Partial<InvoiceSeller>;
};

export interface InvoiceSummary {
  id: string;
  number: string;
  ndid: string;
  buyerName: string;
  totalPaise: number;
  issuedAt: string;
  emailedTo: string[];
  lastEmailedAt: string | null;
  suggestedRecipients: string[];
}

export type PurchaseKind = "new" | "renew" | "change";

export interface Offer {
  id: string;
  code: string;
  name: string;
  description: string;
  type: "percent" | "flat";
  value: number;
  maxDiscount: number | null;
  planCodes: string[];
  cycleMonths: number[];
  kinds: PurchaseKind[];
  firstPurchaseOnly: boolean;
  ndids: string[];
  startsAt: string | null;
  endsAt: string | null;
  maxRedemptions: number | null;
  perClientLimit: number | null;
  redemptions: number;
  isActive: boolean;
  showOnPricing: boolean;
  createdAt: string;
}

export type OfferInput = Omit<Offer, "id" | "redemptions" | "createdAt">;

export interface AdminCatalogue {
  plans: CataloguePlan[];
  apps: CatalogueApp[];
  settings: BillingSettings;
  offers: Offer[];
}

export interface BillingOverview {
  revenue: {
    thisMonthPaise: number;
    lastMonthPaise: number;
    last30DaysPaise: number;
    allTimePaise: number;
    paymentsThisMonth: number;
    payingHotels12m: number;
    byMonth: { month: string; paise: number; count: number }[];
  };
  subscriptions: {
    total: number;
    paying: number;
    trial: number;
    ended: number;
    stopped: number;
    renewalsDue30d: number;
    autoRenewOn: number;
    byPlan: { planCode: string; count: number }[];
    mrrPaise: number;
  };
}

export type PaymentStatus = "created" | "SUCCESS" | "FAILED";

export interface Payment {
  id: string;
  ndid: string;
  hotelName: string | null;
  planCode: string | null;
  orderId: string;
  paymentId: string | null;
  /** paise */
  amount: number;
  currency: string;
  status: PaymentStatus;
  method: string | null;
  paidAt: string | null;
  createdAt: string;
  /** "gian-new" for the new checkout; null for gian's older one */
  source: string | null;
  kind: PurchaseKind | "auto_renew" | null;
  terms: { planCode: string; cycleMonths: number; addonCodes: string[]; seats: number } | null;
  offerCode: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  failureReason: string | null;
  createdBy: string | null;
  /** the GST invoice, once issued */
  invoice: { id: string; number: string } | null;
}

export interface PaymentQuery {
  page: number;
  pageSize: number;
  status?: PaymentStatus;
  ndid?: string;
  source?: "gian-new" | "gian";
  /** YYYY-MM-DD, India time */
  from?: string;
  to?: string;
}

/** gian-new's /api/v1/admin/billing. Amounts from the API are paise for payments, rupees for prices. */
export class BillingApi {
  constructor(private readonly client: ApiClient) {}

  overview(): Promise<BillingOverview> {
    return this.client.get<BillingOverview>("/admin/billing/overview");
  }

  payments(query: PaymentQuery): Promise<{ items: Payment[]; total: number }> {
    const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
    for (const key of ["status", "ndid", "source", "from", "to"] as const) {
      const value = query[key];
      if (value) params.set(key, value);
    }
    return this.client.get(`/admin/billing/payments?${params}`);
  }

  catalogue(): Promise<AdminCatalogue> {
    return this.client.get<AdminCatalogue>("/admin/billing/catalogue");
  }

  createPlan(input: PlanInput): Promise<CataloguePlan> {
    return this.client.post<CataloguePlan>("/admin/billing/plans", input);
  }

  updatePlan(id: string, changes: Partial<PlanInput>): Promise<CataloguePlan> {
    return this.client.patch<CataloguePlan>(`/admin/billing/plans/${id}`, changes);
  }

  createApp(input: AppInput): Promise<CatalogueApp> {
    return this.client.post<CatalogueApp>("/admin/billing/apps", input);
  }

  updateApp(id: string, changes: Partial<Omit<AppInput, "code">>): Promise<CatalogueApp> {
    return this.client.patch<CatalogueApp>(`/admin/billing/apps/${id}`, changes);
  }

  saveSettings(settings: SettingsInput): Promise<BillingSettings> {
    return this.client.put<BillingSettings>("/admin/billing/settings", { currency: "INR", ...settings });
  }

  createOffer(input: OfferInput): Promise<Offer> {
    return this.client.post<Offer>("/admin/billing/offers", input);
  }

  updateOffer(id: string, changes: Partial<OfferInput>): Promise<Offer> {
    return this.client.patch<Offer>(`/admin/billing/offers/${id}`, changes);
  }

  invoice(id: string): Promise<InvoiceSummary> {
    return this.client.get<InvoiceSummary>(`/admin/billing/invoices/${id}`);
  }

  /** Saves the PDF in the browser's downloads. */
  async downloadInvoice(id: string): Promise<void> {
    const { blob, filename } = await this.client.download(`/admin/billing/invoices/${id}/pdf`);
    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement("a"), { href: url, download: filename });
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  /** No addresses = the hotel's invoice email, hotel email and owner. */
  emailInvoice(id: string, to: string[]): Promise<InvoiceSummary> {
    return this.client.post<InvoiceSummary>(`/admin/billing/invoices/${id}/email`, { to });
  }

  createInvoice(orderId: string): Promise<InvoiceSummary> {
    return this.client.post<InvoiceSummary>(`/admin/billing/payments/${encodeURIComponent(orderId)}/invoice`);
  }
}

export const billingApi = new BillingApi(adminClient);

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inrExact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });

/** ₹12,345 from paise (rounded to the rupee). */
export const rupeesFromPaise = (paise: number) => inr.format(Math.round(paise / 100));
/** ₹12,345.67 from paise. */
export const exactRupees = (paise: number) => inrExact.format(paise / 100);
/** ₹999 from rupees. */
export const rupees = (value: number) => inr.format(value);

export const limitText = (value: number) => (value < 0 ? "Unlimited" : value.toLocaleString("en-IN"));

export const KIND_LABELS: Record<NonNullable<Payment["kind"]>, string> = {
  new: "New plan",
  renew: "Renewal",
  change: "Plan change",
  auto_renew: "Auto-renewal",
};
