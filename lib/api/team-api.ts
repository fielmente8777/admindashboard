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
    label: "Manage credits",
    hint: "Add or share credits",
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

  add(member: NewTeamMember): Promise<TeamMember> {
    return this.client.post<TeamMember>("/admin/team", member);
  }

  update(id: string, changes: TeamMemberChanges): Promise<TeamMember> {
    return this.client.patch<TeamMember>(`/admin/team/${id}`, changes);
  }
}

export const teamApi = new TeamApi(adminClient);
