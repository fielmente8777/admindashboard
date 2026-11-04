/**
 * Reads the email from a Google ID token so the page can refuse non-staff accounts early.
 *
 * This is not a security check: the signature is not verified here, and gian-new decides who
 * is staff. It exists because gian-new's /auth/google creates a new owner account for any
 * unknown email, and a wrong Google account on the admin page must not do that.
 */
export class StaffEmail {
  constructor(private readonly domains: readonly string[]) {}

  matchesIdToken(idToken: string): boolean {
    const domain = this.readEmail(idToken)?.trim().toLowerCase().split("@")[1];
    return domain !== undefined && this.domains.includes(domain);
  }

  /** "@eazotel.com or @fielmente.com" */
  describeDomains(): string {
    return this.domains.map((domain) => `@${domain}`).join(" or ");
  }

  private readEmail(idToken: string): string | undefined {
    try {
      const payload = idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      return (JSON.parse(atob(payload)) as { email?: string }).email;
    } catch {
      return undefined;
    }
  }
}
