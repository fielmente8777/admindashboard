import { ApiClient } from "./api-client";

export type AdminRole = "super_admin" | "admin";

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: AdminRole;
  permissions: string[];
  /** Super admins see every property; admins only their assignedProperties. */
  allProperties: boolean;
  assignedProperties: { ndid: string; hid: string }[];
}

export interface AdminSession {
  accessToken: string;
  expiresAt: string;
  admin: AdminUser;
}

/** A sign-in waiting for the code that was emailed. */
export interface OtpChallenge {
  challengeId: string;
  /** Partly hidden, e.g. "sa***@eazotel.com". */
  email: string;
  expiresAt: string;
  resendAfterSeconds: number;
}

/** gian-new's /api/v1/admin/auth endpoints. The refresh token stays in an httpOnly cookie. */
export class AuthApi {
  constructor(private readonly client: ApiClient) {}

  /** Step 1: Google is checked and the code is emailed. There is no session yet. */
  loginWithGoogle(idToken: string): Promise<OtpChallenge> {
    return this.client.post<OtpChallenge>("/admin/auth/google", { idToken });
  }

  /** Step 2: the right code starts the session. */
  verifyOtp(challengeId: string, code: string): Promise<AdminSession> {
    return this.client.post<AdminSession>("/admin/auth/otp/verify", {
      challengeId,
      code,
    });
  }

  resendOtp(challengeId: string): Promise<OtpChallenge> {
    return this.client.post<OtpChallenge>("/admin/auth/otp/resend", {
      challengeId,
    });
  }

  refresh(): Promise<AdminSession> {
    return this.client.post<AdminSession>("/admin/auth/refresh");
  }

  logout(): Promise<void> {
    return this.client.post<void>("/admin/auth/logout");
  }
}
