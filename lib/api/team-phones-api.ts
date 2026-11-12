import { adminClient } from "./admin-client";
import type { ApiClient } from "./api-client";

/**
 * Whether a number gets the client's WhatsApp lead alerts:
 * hotel_phone = it is the hotel's own phone (always alerted);
 * all / some / none = on every, some or no lead source list of the properties you can see.
 */
export type AlertCoverage = "hotel_phone" | "all" | "some" | "none";

export interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  role: string | null;
  /** the account holder (the oldest admin) */
  isOwner: boolean;
  isAdmin: boolean;
  isActive: boolean;
  phone: string | null;
  /** null while the member has no phone */
  alerts: AlertCoverage | null;
}

export interface ClientTeam {
  ndid: string;
  hotelName: string | null;
  hotelPhone: string | null;
  /** the hotel phone ready to copy to the owner; null when it has no country code */
  suggestedOwnerPhone: string | null;
  members: TeamMember[];
}

export interface OwnerMissingPhone {
  ndid: string;
  hotelName: string | null;
  ownerId: string;
  ownerEmail: string;
  ownerName: string | null;
  hotelPhone: string | null;
  /** what Fix saves; null = the hotel phone is missing or has no country code */
  suggestedPhone: string | null;
}

export type OwnerPhoneOutcome = "fixed" | "has_phone" | "no_hotel_phone" | "not_found";

export interface OwnerPhoneResult {
  ndid: string;
  hotelName: string | null;
  outcome: OwnerPhoneOutcome;
  ownerEmail: string | null;
  phone: string | null;
  alertsAdded: number;
}

/** /admin/team-phones: each client's dashboard users and their WhatsApp numbers. */
class TeamPhonesApi {
  constructor(private readonly client: ApiClient) {}

  team(ndid: string): Promise<ClientTeam> {
    return this.client.get<ClientTeam>(`/admin/team-phones/${encodeURIComponent(ndid)}`);
  }

  /** Empty phone clears it. Needs clients.edit. */
  setPhone(ndid: string, userId: string, phone: string, addToAlerts: boolean): Promise<ClientTeam> {
    return this.client.put<ClientTeam>(
      `/admin/team-phones/${encodeURIComponent(ndid)}/${encodeURIComponent(userId)}`,
      { phone, addToAlerts },
    );
  }

  async missingOwners(): Promise<OwnerMissingPhone[]> {
    return (await this.client.get<{ items: OwnerMissingPhone[] }>("/admin/team-phones/missing-owners")).items;
  }

  /** Up to 100 at a time. Only empty owner phones are filled. Needs clients.edit. */
  async fixOwners(ndids: string[]): Promise<OwnerPhoneResult[]> {
    return (
      await this.client.post<{ results: OwnerPhoneResult[] }>("/admin/team-phones/fix-owners", { ndids })
    ).results;
  }
}

export const teamPhonesApi = new TeamPhonesApi(adminClient);

export const ALERT_COVERAGE_LABEL: Record<AlertCoverage, string> = {
  hotel_phone: "Gets alerts (hotel phone)",
  all: "Gets alerts",
  some: "Some alerts",
  none: "No alerts",
};
