import { adminClient } from "./admin-client";
import type { ApiClient } from "./api-client";

export interface Plan {
  id: string;
  name: string;
  price: number;
}

/** An add-on app a client can have. `code` is its key in the subscription's appAccess. */
export interface App {
  id: string;
  name: string;
  code: string;
  price: number;
  isActive: boolean;
}

/** One app on a subscription (duplicates merged). */
export interface SubscriptionApp {
  appId: string;
  name: string | null;
  code: string | null;
  isTrial: boolean;
  startDate: string;
  endDate: string;
}

/** What staff set for one app: kept until `endDate` (YYYY-MM-DD). */
export interface AppAssignment {
  appId: string;
  endDate: string;
  isTrial: boolean;
}

/** active · ending (within 7 days) · ended · stopped (paused or expired by staff) */
export type SubscriptionState = "active" | "ending" | "ended" | "stopped";

export interface Subscription {
  ndid: string;
  hotelName: string | null;
  plan: Plan | null;
  status: "ACTIVE" | "EXPIRED" | "CANCELLED" | "TRIAL";
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  /** set while staff have paused or expired it */
  staffStop: {
    kind: "paused" | "expired";
    at: string;
    by: string;
    reason: string | null;
    daysLeftWhenPaused: number | null;
    /** every app was ended too */
    appsEnded: boolean;
  } | null;
  apps: SubscriptionApp[];
  /** what the hotel dashboard unlocks, by app code */
  appAccess: Record<string, boolean>;
}

export interface ServiceSwitch {
  enabled: boolean;
  changedAt: string | null;
  changedBy: string | null;
}

/** What actually runs for a client: its switches and its subscription together. */
export interface EffectiveServices {
  switches: { chatbot: ServiceSwitch; leads: ServiceSwitch };
  subscriptionServing: boolean;
  chatbot: boolean;
  leads: boolean;
}

export interface SubscriptionView {
  subscription: Subscription;
  state: SubscriptionState;
  services: EffectiveServices;
  heldLeads: number;
  /** leads in the catch-up email this action sent */
  emailed?: number;
}

export type SubscriptionSort = "hotel" | "plan" | "endDate" | "state";

export interface SubscriptionPage {
  items: (Subscription & { state: SubscriptionState })[];
  /** matching every filter */
  total: number;
  /** per state, with the search applied but not the state filter */
  counts: Record<SubscriptionState | "all", number>;
}

export type RenewBody = ({ months: number } | { until: string }) & {
  planId?: string;
  note?: string;
  /** also move every app to the new end date (the API's default is true) */
  extendApps?: boolean;
};

/** gian-new's /api/v1/admin/plans and /api/v1/admin/subscriptions. Staff only, never the hotel dashboard's API. */
export class SubscriptionsApi {
  constructor(private readonly client: ApiClient) {}

  async apps(): Promise<App[]> {
    return (await this.client.get<{ apps: App[] }>("/admin/apps")).apps;
  }

  setApps(ndid: string, apps: AppAssignment[]): Promise<SubscriptionView> {
    return this.client.put<SubscriptionView>(`${this.path(ndid)}/apps`, {
      apps,
    });
  }

  async plans(): Promise<Plan[]> {
    return (await this.client.get<{ plans: Plan[] }>("/admin/plans")).plans;
  }

  list(query: {
    state?: SubscriptionState;
    search?: string;
    sort: SubscriptionSort;
    order: "asc" | "desc";
    page: number;
    pageSize: number;
  }): Promise<SubscriptionPage> {
    const params = new URLSearchParams({
      sort: query.sort,
      order: query.order,
      page: String(query.page),
      pageSize: String(query.pageSize),
    });
    if (query.state) params.set("state", query.state);
    if (query.search) params.set("search", query.search);
    return this.client.get<SubscriptionPage>(`/admin/subscriptions?${params}`);
  }

  get(ndid: string): Promise<SubscriptionView> {
    return this.client.get<SubscriptionView>(this.path(ndid));
  }

  /** `endApps`: also end every app now; resume gives them the new end. */
  pause(
    ndid: string,
    reason?: string,
    endApps = false,
  ): Promise<SubscriptionView> {
    return this.client.post<SubscriptionView>(`${this.path(ndid)}/pause`, {
      reason,
      endApps,
    });
  }

  resume(ndid: string): Promise<SubscriptionView> {
    return this.client.post<SubscriptionView>(`${this.path(ndid)}/resume`);
  }

  renew(ndid: string, body: RenewBody): Promise<SubscriptionView> {
    return this.client.post<SubscriptionView>(`${this.path(ndid)}/renew`, body);
  }

  /** `endApps`: also end every app now; renew extends them again. */
  expire(
    ndid: string,
    reason?: string,
    endApps = false,
  ): Promise<SubscriptionView> {
    return this.client.post<SubscriptionView>(`${this.path(ndid)}/expire`, {
      reason,
      endApps,
    });
  }

  changePlan(ndid: string, planId: string): Promise<SubscriptionView> {
    return this.client.put<SubscriptionView>(`${this.path(ndid)}/plan`, {
      planId,
    });
  }

  private path(ndid: string): string {
    return `/admin/subscriptions/${encodeURIComponent(ndid)}`;
  }
}

export const subscriptionsApi = new SubscriptionsApi(adminClient);

const day = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

export function formatDay(iso: string): string {
  return day.format(new Date(iso));
}

/** "2026-11-05" in India time, for date inputs. */
export function toDateInput(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    new Date(iso),
  );
}

/** Whole days until the end, rounded up; 0 or less once it has passed. */
export function daysLeft(iso: string): number {
  return Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000);
}

/** "in 12 days", "today", "5 days ago" */
export function daysFromNow(iso: string): string {
  const days = Math.round((Date.parse(iso) - Date.now()) / 86_400_000);
  if (days === 0) return "today";
  return days > 0
    ? `in ${days} day${days === 1 ? "" : "s"}`
    : `${-days} day${days === -1 ? "" : "s"} ago`;
}

export const STATE_LABELS: Record<SubscriptionState, string> = {
  active: "Active",
  ending: "Ending soon",
  ended: "Ended",
  stopped: "Stopped by staff",
};
