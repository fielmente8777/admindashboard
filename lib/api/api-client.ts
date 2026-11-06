/** A failed API call. Switch on `code`: it is stable, while `message` may change. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiBody<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

/** How a signed-in client gets its token. The sign-in calls themselves use a client without one. */
export interface ApiSession {
  accessToken(): string | null;
  /** Gets a new access token after the old one expired. Null when the session could not be renewed. */
  refresh(): Promise<string | null>;
  /** The server says this person no longer has access. */
  accessRevoked(): void;
}

const TOKEN_ERRORS = new Set([
  "TOKEN_MISSING",
  "TOKEN_INVALID",
  "TOKEN_EXPIRED",
]);

/** Talks to gian-new's /api/v1 and unwraps its `{ success, data | error }` envelope. */
export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly session?: ApiSession,
  ) {}

  get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  post<T>(path: string, body: object = {}): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  patch<T>(path: string, body: object): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }

  put<T>(path: string, body: object): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  delete<T>(path: string, body?: object): Promise<T> {
    return this.request<T>("DELETE", path, body);
  }

  /** A file (e.g. an invoice PDF), with the name the server gave it. Renews the token like every call. */
  async download(path: string): Promise<{ blob: Blob; filename: string }> {
    const fetchFile = async (token: string | null) => {
      const response = await this.send("GET", path, undefined, token);
      if (response.ok) {
        const disposition = response.headers.get("content-disposition") ?? "";
        const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "download";
        return { blob: await response.blob(), filename };
      }
      const parsed = await this.parse<never>(response);
      throw new ApiError(response.status, parsed.success ? "BAD_RESPONSE" : parsed.error.code, parsed.success ? "Download failed" : parsed.error.message);
    };
    try {
      return await fetchFile(this.session?.accessToken() ?? null);
    } catch (error) {
      if (!this.session || !(error instanceof ApiError) || !TOKEN_ERRORS.has(error.code)) throw error;
      const token = await this.session.refresh();
      if (!token) throw error;
      return fetchFile(token);
    }
  }

  /** An expired access token is renewed once and the call repeated, so staff never notice it. */
  private async request<T>(
    method: string,
    path: string,
    body?: object,
  ): Promise<T> {
    try {
      return await this.attempt<T>(
        method,
        path,
        body,
        this.session?.accessToken() ?? null,
      );
    } catch (error) {
      if (!this.session || !(error instanceof ApiError)) throw error;
      if (error.code === "ADMIN_NOT_ALLOWED") this.session.accessRevoked();
      if (!TOKEN_ERRORS.has(error.code)) throw error;

      const token = await this.session.refresh();
      if (!token) throw error;
      return this.attempt<T>(method, path, body, token);
    }
  }

  private async attempt<T>(
    method: string,
    path: string,
    body: object | undefined,
    token: string | null,
  ): Promise<T> {
    const response = await this.send(method, path, body, token);
    if (response.status === 204) return undefined as T;

    const parsed = await this.parse<T>(response);
    if (!parsed.success) {
      throw new ApiError(
        response.status,
        parsed.error.code,
        parsed.error.message,
      );
    }
    return parsed.data;
  }

  private async send(
    method: string,
    path: string,
    body: object | undefined,
    token: string | null,
  ): Promise<Response> {
    try {
      return await fetch(`${this.baseUrl}/api/v1${path}`, {
        method,
        // Lets the browser send and store the httpOnly refresh cookie.
        credentials: "include",
        headers: {
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new ApiError(
        0,
        "NETWORK_ERROR",
        "Could not reach the server. Check your connection and try again.",
      );
    }
  }

  private async parse<T>(response: Response): Promise<ApiBody<T>> {
    try {
      return (await response.json()) as ApiBody<T>;
    } catch {
      throw new ApiError(
        response.status,
        "BAD_RESPONSE",
        "The server sent an unexpected response",
      );
    }
  }
}
