import { adminClient } from "./admin-client";
import type { ApiClient } from "./api-client";
import type { AdminRole } from "./auth-api";

export type AdminStatus = "active" | "disabled";

export const ADVANCED_PERMISSIONS = [
  {
    id: "clients.open_account",
    label: "Open client accounts",
    hint: "Sign in to a hotel's dashboard as them",
  },
  {
    id: "subscriptions.manage",
    label: "Manage subscriptions",
    hint: "Change plans and dates",
  },
  {
    id: "credits.manage",
    label: "Manage AI credits",
    hint: "Add or remove credits and suspend AI for their assigned clients",
  },
  {
    id: "credits.pricing",
    label: "AI pricing and OpenAI account",
    hint: "OpenAI pool and top-ups, model prices, recharge packages, credit settings",
  },
  {
    id: "billing.view",
    label: "View billing",
    hint: "Revenue, payments and who paid",
  },
  {
    id: "billing.manage",
    label: "Manage plans and prices",
    hint: "Change plans, add-on prices, billing cycles and offers",
  },
  {
    id: "meta_pages.manage",
    label: "Manage Meta pages",
    hint: "See every Facebook page and choose which client gets its leads",
  },
  {
    id: "clients.trash",
    label: "Move clients to the trash",
    hint: "Hide clients and pause their time (nothing deleted), and restore them",
  },
] as const;

export type AdvancedPermission = (typeof ADVANCED_PERMISSIONS)[number]["id"];

export interface AssignedProperty {
  ndid: string;
  hid: string;
}

export interface TeamMember {
  id: string;
  email: string;
  name: string | null;
  role: AdminRole;
  status: AdminStatus;
  /** False until their first sign-in finishes. */
  googleLinked: boolean;
  advancedPermissions: AdvancedPermission[];
  assignedProperties: AssignedProperty[];
  lastLoginAt: string | null;
}

export interface NewTeamMember {
  email: string;
  name: string | null;
  role: AdminRole;
  advancedPermissions: AdvancedPermission[];
  assignedProperties: AssignedProperty[];
}

export type TeamMemberChanges = Partial<
  Omit<NewTeamMember, "email"> & { status: AdminStatus }
>;

/** gian-new's /api/v1/admin/team endpoints. Super admins only. */
export class TeamApi {
  constructor(private readonly client: ApiClient) {}

  async list(): Promise<TeamMember[]> {
    const { members } = await this.client.get<{ members: TeamMember[] }>(
      "/admin/team",
    );
    return members;
  }

  /** Adds them and emails the invite; `inviteSent` false means the email failed. */
  add(member: NewTeamMember): Promise<TeamMember & { inviteSent: boolean }> {
    return this.client.post<TeamMember & { inviteSent: boolean }>("/admin/team", member);
  }

  /** Emails the invite again. */
  resendInvite(id: string): Promise<TeamMember & { inviteSent: boolean }> {
    return this.client.post<TeamMember & { inviteSent: boolean }>(`/admin/team/${id}/invite`);
  }

  update(id: string, changes: TeamMemberChanges): Promise<TeamMember> {
    return this.client.patch<TeamMember>(`/admin/team/${id}`, changes);
  }
}

export const teamApi = new TeamApi(adminClient);
