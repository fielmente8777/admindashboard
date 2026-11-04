// NEXT_PUBLIC_* values are inlined at build time, so each must be read by its full name.
export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "",
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
  staffEmailDomains: (process.env.NEXT_PUBLIC_STAFF_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean),
};
