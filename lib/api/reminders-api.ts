import { adminClient } from "./admin-client";
import type { ApiClient } from "./api-client";

export interface ReminderSettings {
  /** off until staff switch it on */
  enabled: boolean;
  daysBefore: number[];
  onEndDay: boolean;
  daysAfter: number[];
  channels: { email: boolean; whatsapp: boolean };
  /** the approved WhatsApp template; its body takes 4 values: hotel, plan, when, link */
  whatsappTemplate: { name: string; language: string };
  includeTrial: boolean;
  /** India time, 0–23 */
  sendHourIst: number;
  renewUrl: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

export type ReminderSettingsInput = Omit<ReminderSettings, "updatedAt" | "updatedBy">;

export interface RemindersOverview {
  settings: ReminderSettings;
  /** the server has Eazotel's WhatsApp number and token */
  whatsappReady: boolean;
  /** false on a machine without a mail server */
  emailReady: boolean;
}

export interface ChannelResult {
  status: "sent" | "failed" | "skipped";
  to: string[];
  note: string | null;
}

export interface ReminderLogEntry {
  id: string;
  ndid: string;
  hotelName: string | null;
  planName: string | null;
  endDate: string;
  /** -7 = a week before, 0 = the end day, 3 = three days after */
  offsetDays: number;
  kind: "scheduled" | "manual";
  email: ChannelResult;
  whatsapp: ChannelResult;
  by: string | null;
  sentAt: string;
}

export interface UpcomingReminder {
  ndid: string;
  hotelName: string | null;
  planName: string | null;
  endDate: string;
  offsetDays: number;
  trial: boolean;
  sendOn: string;
}

export interface SendResult {
  sent: number;
  results: { ndid: string; ok: boolean; entry: ReminderLogEntry | null; error: string | null; message: string | null }[];
}

/** "7 days before", "on the end day", "3 days after" */
export function offsetLabel(offset: number): string {
  if (offset === 0) return "on the end day";
  const n = Math.abs(offset);
  return `${n} day${n === 1 ? "" : "s"} ${offset < 0 ? "before" : "after"}`;
}

/** gian-new's /api/v1/admin/reminders endpoints. */
export class RemindersApi {
  constructor(private readonly client: ApiClient) {}

  overview(): Promise<RemindersOverview> {
    return this.client.get<RemindersOverview>("/admin/reminders");
  }

  save(settings: ReminderSettingsInput): Promise<RemindersOverview> {
    return this.client.put<RemindersOverview>("/admin/reminders/settings", settings);
  }

  async upcoming(days = 7): Promise<UpcomingReminder[]> {
    return (await this.client.get<{ items: UpcomingReminder[] }>(`/admin/reminders/upcoming?days=${days}`)).items;
  }

  async log(query: { limit?: number; ndid?: string } = {}): Promise<ReminderLogEntry[]> {
    const params = new URLSearchParams();
    if (query.limit) params.set("limit", String(query.limit));
    if (query.ndid) params.set("ndid", query.ndid);
    return (await this.client.get<{ items: ReminderLogEntry[] }>(`/admin/reminders/log?${params}`)).items;
  }

  /** Sends now, whatever the schedule, to each client (up to 50). */
  send(ndids: string[]): Promise<SendResult> {
    return this.client.post<SendResult>("/admin/reminders/send", { ndids });
  }
}

export const remindersApi = new RemindersApi(adminClient);
