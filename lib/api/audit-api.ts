import { adminClient } from "./admin-client";
import type { ApiClient } from "./api-client";

export const AUDIT_ACTIONS = [
  { id: "team.member_added", label: "Staff added" },
  { id: "team.member_updated", label: "Staff changed" },
  { id: "team.saved_by_script", label: "Staff saved by script" },
  { id: "client.updated", label: "Client edited" },
  { id: "client.account_opened", label: "Client account opened" },
  { id: "client.deleted", label: "Client deleted" },
  { id: "client.service_changed", label: "Client service switched" },
  { id: "client.notifications_changed", label: "Lead alerts changed" },
  { id: "client.team_phone_changed", label: "Team number changed" },
  { id: "client.owner_phone_filled", label: "Owner number filled" },
  { id: "subscription.paused", label: "Subscription paused" },
  { id: "subscription.resumed", label: "Subscription resumed" },
  { id: "subscription.renewed", label: "Subscription renewed" },
  { id: "subscription.expired", label: "Subscription expired" },
  { id: "subscription.plan_changed", label: "Plan changed" },
  { id: "subscription.apps_changed", label: "Apps changed" },
  { id: "meta_page.linked", label: "Meta page linked" },
  { id: "meta_page.unlinked", label: "Meta page unlinked" },
  { id: "meta_pages.synced", label: "Meta pages synced" },
  { id: "credits.granted", label: "AI credits added" },
  { id: "credits.deducted", label: "AI credits removed" },
  { id: "credits.bulk_granted", label: "AI credits given in bulk" },
  { id: "credits.wallet_suspended", label: "AI suspended" },
  { id: "credits.wallet_resumed", label: "AI resumed" },
  { id: "credits.pricing_changed", label: "AI price changed" },
  { id: "credits.package_changed", label: "AI package changed" },
  { id: "credits.settings_changed", label: "AI credit settings changed" },
  { id: "credits.openai_topup_added", label: "OpenAI top-up recorded" },
  { id: "credits.openai_topup_edited", label: "OpenAI top-up corrected" },
  { id: "login.success", label: "Signed in" },
  { id: "login.denied", label: "Sign-in refused" },
  { id: "login.code_sent", label: "Sign-in code sent" },
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number]["id"];

export interface AuditEntry {
  id: string;
  action: AuditAction;
  actorEmail: string | null;
  targetId: string | null;
  targetEmail: string | null;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  details: Record<string, unknown> | null;
  ip: string | null;
  at: string;
}

export interface AuditPage {
  items: AuditEntry[];
  nextCursor: string | null;
}

export interface AuditFilters {
  action?: AuditAction;
  email?: string;
}

/** gian-new's /api/v1/admin/audit-log endpoint. Super admins only. */
export class AuditApi {
  constructor(private readonly client: ApiClient) {}

  list({
    action,
    email,
    before,
    limit,
  }: AuditFilters & { before?: string; limit?: number }): Promise<AuditPage> {
    const query = new URLSearchParams();
    if (action) query.set("action", action);
    if (email) query.set("email", email);
    if (before) query.set("before", before);
    if (limit) query.set("limit", String(limit));
    return this.client.get<AuditPage>(`/admin/audit-log?${query}`);
  }
}

export const auditApi = new AuditApi(adminClient);
