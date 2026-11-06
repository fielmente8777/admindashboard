import { env } from "@/lib/env";
import { useAuthStore } from "@/stores/auth-store";

import { ApiClient } from "./api-client";

/** The client for everything behind sign-in. Adds the access token and renews it when it expires. */
export const adminClient = new ApiClient(env.apiUrl, {
  accessToken: () => useAuthStore.getState().accessToken,
  refresh: () => useAuthStore.getState().refreshAccessToken(),
  accessRevoked: () => useAuthStore.getState().endSession(),
});
