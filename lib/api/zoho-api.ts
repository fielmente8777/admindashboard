import { adminClient } from "./admin-client";
import type { ApiClient } from "./api-client";

export type PaymentProvider = "razorpay" | "zoho";

export interface ZohoStatus {
  /** the server has Zoho's client id, secret and token key */
  configured: boolean;
  connected: boolean;
  orgId: string | null;
  orgName: string | null;
  taxId: string | null;
  taxName: string | null;
  connectedBy: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  /** register this in Zoho's API console */
  redirectUri: string;
  webhookReady: boolean;
  payment: { provider: PaymentProvider; changedBy: string | null; changedAt: string | null };
}

export interface ZohoContact {
  contactId: string;
  name: string;
  companyName: string;
  email: string | null;
  phone: string | null;
  status: string;
}

export interface ZohoCustomerRow {
  contact: ZohoContact;
  linked: { ndid: string; hotelName: string | null } | null;
  suggestion: { ndid: string; hotelName: string | null; why: string } | null;
}

export interface ZohoInvoice {
  invoiceId: string;
  number: string;
  contactId: string;
  contactName: string;
  ndid: string | null;
  hotelName: string | null;
  /** checkout: made by us; zoho: made by the team in Zoho Books */
  source: "checkout" | "zoho";
  orderId: string | null;
  status: string;
  totalPaise: number;
  currency: string;
  invoiceUrl: string | null;
  invoiceDate: string;
  lines: string[];
  appliedAt: string | null;
  ignoredAt: string | null;
  suggestion: { planId: string; planName: string; cycleMonths: number } | null;
}

export type ZohoInvoiceState = "review" | "applied" | "open" | "all";

export interface ZohoApplyChoice {
  ndid: string;
  planId: string;
  cycleMonths: number;
  addonCodes: string[];
  seats: number;
}

export interface ZohoMadeInvoice {
  status: "invoice";
  orderId: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceUrl: string | null;
  totalPaise: number;
}

/** gian-new's /api/v1/admin/zoho endpoints. */
export class ZohoApi {
  constructor(private readonly client: ApiClient) {}

  status(): Promise<ZohoStatus> {
    return this.client.get<ZohoStatus>("/admin/zoho/status");
  }

  /** Zoho's sign-in URL; open it in this tab. */
  connect(): Promise<{ url: string }> {
    return this.client.post<{ url: string }>("/admin/zoho/connect");
  }

  disconnect(): Promise<ZohoStatus> {
    return this.client.post<ZohoStatus>("/admin/zoho/disconnect");
  }

  async taxes(): Promise<{ id: string; name: string; percentage: number }[]> {
    return (await this.client.get<{ items: { id: string; name: string; percentage: number }[] }>("/admin/zoho/taxes")).items;
  }

  setTax(taxId: string | null): Promise<ZohoStatus> {
    return this.client.put<ZohoStatus>("/admin/zoho/tax", { taxId });
  }

  setProvider(provider: PaymentProvider): Promise<ZohoStatus> {
    return this.client.put<ZohoStatus>("/admin/zoho/provider", { provider });
  }

  customers(): Promise<{ items: ZohoCustomerRow[]; unlinkedClients: number }> {
    return this.client.get("/admin/zoho/customers");
  }

  link(ndid: string, contactId: string): Promise<unknown> {
    return this.client.put(`/admin/zoho/links/${encodeURIComponent(ndid)}`, { contactId });
  }

  unlink(ndid: string): Promise<unknown> {
    return this.client.delete(`/admin/zoho/links/${encodeURIComponent(ndid)}`);
  }

  createCustomer(ndid: string): Promise<unknown> {
    return this.client.post(`/admin/zoho/links/${encodeURIComponent(ndid)}/create`);
  }

  async invoices(state: ZohoInvoiceState): Promise<ZohoInvoice[]> {
    return (await this.client.get<{ items: ZohoInvoice[] }>(`/admin/zoho/invoices?state=${state}`)).items;
  }

  apply(invoiceId: string, choice: ZohoApplyChoice): Promise<ZohoInvoice> {
    return this.client.post<ZohoInvoice>(`/admin/zoho/invoices/${encodeURIComponent(invoiceId)}/apply`, choice);
  }

  ignore(invoiceId: string): Promise<ZohoInvoice> {
    return this.client.post<ZohoInvoice>(`/admin/zoho/invoices/${encodeURIComponent(invoiceId)}/ignore`);
  }

  sync(): Promise<{ checked: number; applied: number; needsReview: number }> {
    return this.client.post("/admin/zoho/sync");
  }

  createInvoice(
    ndid: string,
    choice: Omit<ZohoApplyChoice, "ndid"> & { offerCode: string | null; emailTo: string[] },
  ): Promise<ZohoMadeInvoice> {
    return this.client.post<ZohoMadeInvoice>(`/admin/zoho/clients/${encodeURIComponent(ndid)}/invoice`, choice);
  }
}

export const zohoApi = new ZohoApi(adminClient);
