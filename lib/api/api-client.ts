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

/** Talks to gian-new's /api/v1 and unwraps its `{ success, data | error }` envelope. */
export class ApiClient {
  constructor(private readonly baseUrl: string) {}

  async post<T>(path: string, body: object = {}): Promise<T> {
    const response = await this.send(path, body);
    if (response.status === 204) return undefined as T;

    const parsed = await this.parse<T>(response);
    if (!parsed.success) {
      throw new ApiError(response.status, parsed.error.code, parsed.error.message);
    }
    return parsed.data;
  }

  private async send(path: string, body: object): Promise<Response> {
    try {
      return await fetch(`${this.baseUrl}/api/v1${path}`, {
        method: "POST",
        // Lets the browser send and store the httpOnly refresh cookie.
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      throw new ApiError(0, "NETWORK_ERROR", "Could not reach the server");
    }
  }

  private async parse<T>(response: Response): Promise<ApiBody<T>> {
    try {
      return (await response.json()) as ApiBody<T>;
    } catch {
      throw new ApiError(response.status, "BAD_RESPONSE", "The server sent an unexpected response");
    }
  }
}
