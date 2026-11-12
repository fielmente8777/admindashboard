import type { AuditEntry } from "@/lib/api/audit-api";
import {
  ADVANCED_PERMISSIONS,
  type AssignedProperty,
} from "@/lib/api/team-api";

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  role: "Role",
  status: "Status",
  advancedPermissions: "Permissions",
  assignedProperties: "Properties",
  hotelDescription: "Description",
  hotelEmail: "Hotel email",
  hotelPhone: "Hotel phone",
  marketingEmail: "Marketing email",
  chatbot: "Website chatbot",
  leads: "Leads",
  endDate: "End date",
  plan: "Plan",
  services: "Services",
  apps: "Apps",
};

const PROPERTY_FIELD_LABELS: Record<string, string> = {
  name: "name",
  city: "city",
  state: "state",
  country: "country",
  pinCode: "PIN code",
};

/** "property 12345678 city" → "Property 12345678 city". */
function fieldLabel(field: string): string {
  const property = /^property (\S+) (\w+)$/.exec(field);
  if (property)
    return `Property ${property[1]} ${PROPERTY_FIELD_LABELS[property[2] ?? ""] ?? property[2]}`;
  return FIELD_LABELS[field] ?? field;
}

const VALUE_LABELS: Record<string, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  active: "Active",
  disabled: "Disabled",
  on: "On",
  off: "Off",
  ...Object.fromEntries(
    ADVANCED_PERMISSIONS.map(({ id, label }) => [id, label]),
  ),
};

const DENIED_REASONS: Record<string, string> = {
  not_listed: "this email is not on the team",
  disabled: "this account is disabled",
  google_mismatch: "a different Google account was used",
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "none";
  if (Array.isArray(value)) {
    if (value.length === 0) return "none";
    return value.map(formatValue).join(", ");
  }
  if (typeof value === "object") {
    const { ndid, hid } = value as AssignedProperty;
    return `${ndid} / ${hid}`;
  }
  return VALUE_LABELS[String(value)] ?? String(value);
}

/** One sentence saying what happened. */
export function describeAction(entry: AuditEntry): string {
  const target = entry.targetEmail ?? "someone";
  switch (entry.action) {
    case "team.member_added":
      return `Added ${target} as ${formatValue(entry.details?.role)}`;
    case "team.member_updated":
      return `Changed ${target}`;
    case "team.saved_by_script":
      return `${target} saved as ${formatValue(entry.details?.role)} by the command-line script`;
    case "login.success":
      return "Signed in";
    case "login.code_sent":
      return "Asked for a sign-in code";
    case "client.account_opened":
      return `Opened the dashboard of ${String(entry.details?.hotelName ?? entry.targetId ?? "a client")} as ${target}`;
    case "subscription.paused":
    case "subscription.resumed":
    case "subscription.renewed":
    case "subscription.expired":
    case "subscription.plan_changed":
    case "subscription.apps_changed": {
      const verb = {
        "subscription.paused": "Paused",
        "subscription.resumed": "Resumed",
        "subscription.renewed": "Renewed",
        "subscription.expired": "Expired",
        "subscription.plan_changed": "Changed the plan of",
        "subscription.apps_changed": "Changed the apps of",
      }[entry.action];
      const hotel = String(
        entry.details?.hotelName ?? entry.targetId ?? "a client",
      );
      const why = entry.details?.reason ?? entry.details?.note;
      const emailed = Number(entry.details?.emailedLeads ?? 0);
      return `${verb} the subscription of ${hotel}${why ? ` (${String(why)})` : ""}${
        emailed ? `; ${emailed} waiting leads emailed` : ""
      }`
        .replace(
          "Changed the plan of the subscription of",
          "Changed the plan of",
        )
        .replace(
          "Changed the apps of the subscription of",
          "Changed the apps of",
        );
    }
    case "client.service_changed": {
      const turned =
        Object.values(entry.changes ?? {})[0]?.to === "off" ? "off" : "on";
      const service =
        entry.details?.service === "chatbot" ? "the website chatbot" : "leads";
      const released = Number(entry.details?.releasedLeads ?? 0);
      return `Turned ${service} ${turned} for ${String(entry.details?.hotelName ?? entry.targetId ?? "a client")}${
        released ? ` (${released} held leads released)` : ""
      }`;
    }
    case "client.team_phone_changed": {
      const to = Object.values(entry.changes ?? {})[0]?.to;
      const who = String(entry.details?.member ?? entry.targetEmail ?? "a team member");
      const hotel = String(entry.details?.hotelName ?? entry.targetId ?? "a client");
      const lists = Number(entry.details?.alertListsAdded ?? 0);
      const what = entry.changes && Object.keys(entry.changes).length
        ? to ? `Set ${who}'s WhatsApp number to ${String(to)}` : `Removed ${who}'s WhatsApp number`
        : `Added ${who}'s number to the lead alerts`;
      return `${what} at ${hotel}${lists ? ` (on ${lists} alert lists)` : ""}`;
    }
    case "client.owner_phone_filled":
      return `Gave the account holder of ${String(entry.details?.hotelName ?? entry.targetId ?? "a client")} the hotel phone ${String(
        Object.values(entry.changes ?? {})[0]?.to ?? "",
      )}${entry.details?.script ? " (backfill script)" : ""}`;
    case "client.notifications_changed": {
      const property = entry.details?.property ?? entry.details?.hid;
      return `Changed the lead alerts of ${String(entry.details?.hotelName ?? entry.targetId ?? "a client")}${
        property ? ` (${String(property)})` : ""
      }`;
    }
    case "client.deleted":
      return `Deleted client ${String(entry.details?.hotelName ?? entry.targetId ?? "")} (${Number(entry.details?.records ?? 0).toLocaleString("en-IN")} records archived)${
        entry.details?.reason ? `: ${String(entry.details.reason)}` : ""
      }`;
    case "client.updated":
      return `Edited client ${String(entry.details?.hotelName ?? entry.targetId ?? "")}`.trim();
    case "meta_page.linked": {
      const to = entry.changes?.link?.to as AssignedProperty | undefined;
      return `Sent the leads of Meta page ${String(entry.details?.pageName ?? entry.details?.pageId ?? "")} to ${
        to ? `${to.ndid} / ${to.hid}` : "a client"
      }`;
    }
    case "meta_page.unlinked":
      return `Unlinked Meta page ${String(entry.details?.pageName ?? entry.details?.pageId ?? "")}: its leads reach no client`;
    case "meta_pages.synced": {
      const added = Array.isArray(entry.details?.added)
        ? entry.details.added.length
        : 0;
      return `Synced Meta pages (${Number(entry.details?.returned ?? 0)} from Meta, ${added} new)`;
    }
    case "login.denied":
      return `Sign-in refused: ${DENIED_REASONS[String(entry.details?.reason)] ?? "not allowed"}`;
    case "credits.granted":
    case "credits.deducted": {
      const hotel = String(entry.details?.hotelName ?? entry.targetId ?? "a client");
      const amount = Number(entry.details?.amount ?? 0).toLocaleString("en-IN");
      const why = entry.details?.reason ? ` (${String(entry.details.reason)})` : "";
      return entry.action === "credits.granted"
        ? `Added ${amount} AI credits to ${hotel}${why}`
        : `Removed ${amount} AI credits from ${hotel}${why}`;
    }
    case "credits.bulk_granted": {
      const granted = Array.isArray(entry.details?.granted) ? entry.details.granted.length : 0;
      return `Gave ${Number(entry.details?.amount ?? 0).toLocaleString("en-IN")} AI credits to ${granted} clients${
        entry.details?.reason ? ` (${String(entry.details.reason)})` : ""
      }`;
    }
    case "credits.wallet_suspended":
    case "credits.wallet_resumed":
      return `${entry.action === "credits.wallet_suspended" ? "Suspended" : "Resumed"} AI for ${String(
        entry.details?.hotelName ?? entry.targetId ?? "a client",
      )}${entry.details?.reason ? ` (${String(entry.details.reason)})` : ""}`;
    case "credits.pricing_changed":
      return entry.details?.created
        ? `Priced AI model ${String(entry.details.created)}`
        : `Changed the AI price of ${String(entry.details?.pricing ?? "a model")}`;
    case "credits.package_changed":
      return entry.details?.created
        ? `Added AI credit package ${String(entry.details?.name ?? "")}`.trim()
        : `Changed AI credit package ${String(entry.details?.name ?? "")}`.trim();
    case "credits.settings_changed":
      return "Changed AI credit settings";
    case "credits.openai_topup_added":
      return `Recorded an OpenAI top-up of $${Number(entry.details?.amountUsd ?? 0).toFixed(2)}`;
    case "credits.openai_topup_edited":
      return "Corrected an OpenAI top-up";
  }
}

/** Each changed field as "Role: Admin → Super admin". */
export function describeChanges(entry: AuditEntry): string[] {
  return Object.entries(entry.changes ?? {}).map(
    ([field, { from, to }]) =>
      `${fieldLabel(field)}: ${formatValue(from)} → ${formatValue(to)}`,
  );
}
