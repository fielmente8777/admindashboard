import { adminClient } from "./admin-client";
import type { ApiClient } from "./api-client";

export interface ClientProperty {
  hid: string;
  name: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pinCode: string | null;
}

export interface ClientSummary {
  ndid: string;
  hotelName: string | null;
  domain: string | null;
  hotelEmail: string | null;
  planName: string | null;
  /** As recorded on the profile, "yy-mm-dd". */
  planExpiry: string | null;
  /** For an admin, only the properties assigned to them. */
  properties: ClientProperty[];
}

export interface ClientPage {
  items: ClientSummary[];
  nextCursor: string | null;
}

export interface Client {
  ndid: string;
  hotelName: string | null;
  hotelDescription: string | null;
  hotelEmail: string | null;
  hotelPhone: string | null;
  marketingEmail: string | null;
  domain: string | null;
  currency: string | null;
  isVerified: boolean;
  plan: {
    name: string | null;
    activationDate: string | null;
    expiryDate: string | null;
  } | null;
  onboardedAt: string | null;
  properties: ClientProperty[];
  owner: {
    email: string;
    name: string | null;
    phone: string | null;
    isActive: boolean;
  } | null;
  /** set while the client is in the trash (hidden from every list) */
  trash: TrashInfo | null;
}

export interface TrashInfo {
  by: string;
  reason: string | null;
  trashedAt: string;
  /** moving it paused a running subscription; restoring resumes it */
  pausedSubscription: boolean;
}

export interface TrashedClient extends TrashInfo {
  ndid: string;
  hotelName: string | null;
}

/** pause / resume the subscription; trash = temporary delete (hidden, nothing deleted); restore; delete = forever */
export type BulkAction = "pause" | "resume" | "trash" | "restore" | "delete";

export interface BulkResult {
  results: {
    ndid: string;
    hotelName: string | null;
    ok: boolean;
    note: string | null;
    error: string | null;
    message: string | null;
  }[];
  done: number;
  failed: number;
}

export type EditablePropertyFields = Partial<Omit<ClientProperty, "hid">>;

export type ClientServiceName = "chatbot" | "leads";

export interface ClientServices {
  /** what staff set per service */
  switches: Record<
    ClientServiceName,
    { enabled: boolean; changedAt: string | null; changedBy: string | null }
  >;
  /** false while the subscription is paused or expired by staff: every service is off */
  subscriptionServing: boolean;
  /** what actually runs now */
  chatbot: boolean;
  leads: boolean;
  /** leads kept back while leads were off, not yet shown to the hotel */
  heldLeads: number;
  released?: { leads: number; contacts: number };
  /** leads in the catch-up email just sent */
  emailed?: number;
}

/** Where a lead came from, as gian names it. */
export type LeadSource =
  "webform" | "eazbot" | "whatsapp" | "facebook" | "google";

export interface SourceAlerts {
  /** a "New lead" email to the hotel's email plus `emails` */
  email: boolean;
  emails: string[];
  /** a WhatsApp message to the hotel's phone plus `phones` (digits with country code) */
  whatsapp: boolean;
  phones: string[];
}

export interface PropertyAlerts {
  hid: string;
  name: string | null;
  /** false: never saved, so gian's defaults apply (no email, WhatsApp on) */
  saved: boolean;
  sources: Record<LeadSource, SourceAlerts>;
}

export interface ClientNotifications {
  hotelEmail: string | null;
  hotelPhone: string | null;
  /** false while the Leads switch is off or the subscription is stopped: nothing is sent */
  leadsDelivered: boolean;
  subscriptionServing: boolean;
  properties: PropertyAlerts[];
}

export interface DeletionPreview {
  ndid: string;
  hotelName: string | null;
  collections: { collection: string; count: number }[];
  total: number;
}

export interface DeletionResult {
  ndid: string;
  deletionId: string;
  collections: { collection: string; count: number }[];
  total: number;
}

export interface OpenedAccount {
  token: string;
  expiresAt: string;
  ndid: string;
  hid: string | null;
  accountEmail: string;
}

/** Only the fields sent change. Empty text clears a field. */
export interface ClientChanges {
  hotelDescription?: string;
  hotelEmail?: string;
  hotelPhone?: string;
  marketingEmail?: string;
  properties?: Record<string, EditablePropertyFields>;
}

/** gian-new's /api/v1/admin/clients endpoints. Admins only reach their assigned properties. */
export class ClientsApi {
  constructor(private readonly client: ApiClient) {}

  list({
    search,
    after,
    limit,
    kind,
  }: {
    search?: string;
    after?: string;
    limit?: number;
    /** clients (default) = real hotels; test = Eazotel's own test dashboards */
    kind?: "clients" | "test";
  }): Promise<ClientPage> {
    const query = new URLSearchParams();
    if (kind) query.set("kind", kind);
    if (search) query.set("search", search);
    if (after) query.set("after", after);
    if (limit) query.set("limit", String(limit));
    return this.client.get<ClientPage>(`/admin/clients?${query}`);
  }

  get(ndid: string): Promise<Client> {
    return this.client.get<Client>(
      `/admin/clients/${encodeURIComponent(ndid)}`,
    );
  }

  /** A one-hour sign-in to the hotel dashboard as this client. Needs clients.open_account. */
  openAccount(ndid: string): Promise<OpenedAccount> {
    return this.client.post<OpenedAccount>(
      `/admin/clients/${encodeURIComponent(ndid)}/open-account`,
    );
  }

  getServices(ndid: string): Promise<ClientServices> {
    return this.client.get<ClientServices>(
      `/admin/clients/${encodeURIComponent(ndid)}/services`,
    );
  }

  setService(
    ndid: string,
    service: ClientServiceName,
    enabled: boolean,
  ): Promise<ClientServices> {
    return this.client.put<ClientServices>(
      `/admin/clients/${encodeURIComponent(ndid)}/services/${service}`,
      { enabled },
    );
  }

  /** Each property's email and WhatsApp alerts, per lead source. */
  getNotifications(ndid: string): Promise<ClientNotifications> {
    return this.client.get<ClientNotifications>(
      `/admin/clients/${encodeURIComponent(ndid)}/notifications`,
    );
  }

  /** Saves every source of one property's alerts. Needs clients.edit. */
  saveNotifications(
    ndid: string,
    hid: string,
    sources: Record<LeadSource, SourceAlerts>,
  ): Promise<ClientNotifications> {
    return this.client.put<ClientNotifications>(
      `/admin/clients/${encodeURIComponent(ndid)}/notifications/${encodeURIComponent(hid)}`,
      { sources },
    );
  }

  /** What deleting this client would remove. Super admins only. */
  deletionPreview(ndid: string): Promise<DeletionPreview> {
    return this.client.get<DeletionPreview>(
      `/admin/clients/${encodeURIComponent(ndid)}/deletion-preview`,
    );
  }

  /** Deletes the client after archiving every record. `confirmName` must be its hotel name. */
  delete(
    ndid: string,
    confirmName: string,
    reason?: string,
  ): Promise<DeletionResult> {
    return this.client.delete<DeletionResult>(
      `/admin/clients/${encodeURIComponent(ndid)}`,
      { confirmName, reason },
    );
  }

  update(ndid: string, changes: ClientChanges): Promise<Client> {
    return this.client.patch<Client>(
      `/admin/clients/${encodeURIComponent(ndid)}`,
      changes,
    );
  }
}

export const clientsApi = new ClientsApi(adminClient);

/** The client list's bulk buttons and the trash. */
export class ClientBulkApi {
  constructor(private readonly client: ApiClient) {}

  /** Up to 50 at a time. `confirm` (delete only): "DELETE <count>". */
  run(
    action: BulkAction,
    ndids: string[],
    extra: { reason?: string | null; confirm?: string } = {},
  ): Promise<BulkResult> {
    return this.client.post<BulkResult>("/admin/clients/bulk", { action, ndids, ...extra });
  }

  async trash(): Promise<TrashedClient[]> {
    return (await this.client.get<{ items: TrashedClient[] }>("/admin/clients/trash")).items;
  }
}

export const clientBulkApi = new ClientBulkApi(adminClient);

/** A property's label: its own name, else the hotel's name with its id. */
export function propertyLabel(
  property: ClientProperty,
  hotelName: string | null,
): string {
  return property.name ?? `${hotelName ?? "Property"} (${property.hid})`;
}
