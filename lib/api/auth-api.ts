import { ApiClient } from "./api-client";

export interface AuthUser {
  id: string;
  ndid: string | null;
  email: string;
  name: string | null;
  role: string | null;
  isAdmin: boolean;
}

export interface AuthSession {
  accessToken: string;
  expiresAt: string;
  isStaff: boolean;
  user: AuthUser;
}

/** gian-new's /api/v1/auth endpoints. The refresh token stays in an httpOnly cookie. */
export class AuthApi {
  constructor(private readonly client: ApiClient) {}

  loginWithGoogle(idToken: string): Promise<AuthSession> {
    return this.client.post<AuthSession>("/auth/google", { idToken });
  }

  refresh(): Promise<AuthSession> {
    return this.client.post<AuthSession>("/auth/refresh");
  }

  logout(): Promise<void> {
    return this.client.post<void>("/auth/logout");
  }
}
