// NEXT_PUBLIC_* values are inlined at build time, so each must be read by its full name.
export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "",
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
  /** the hotel dashboard (dashboard-new), where "Open account" signs staff in as a client */
  hotelDashboardUrl: (
    process.env.NEXT_PUBLIC_HOTEL_DASHBOARD_URL ?? ""
  ).replace(/\/+$/, ""),
};
