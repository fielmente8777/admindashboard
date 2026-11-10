import { adminClient } from "./admin-client";
import type { ApiClient } from "./api-client";

/** A client property, with the names staff recognise. */
export interface MetaPageLink {
  ndid: string;
  hid: string;
  hotelName: string | null;
  propertyName: string | null;
}

/** One sign-in with Meta that returned this page. */
export interface MetaPageCopy {
  connectionId: string;
  /** the Facebook account that signed in */
  accountName: string | null;
  /** the client account the sign-in was started from */
  owner: MetaPageLink;
  link: MetaPageLink | null;
  hasToken: boolean;
}

export interface MetaPage {
  pageId: string;
  name: string | null;
  category: string | null;
  pictureUrl: string | null;
  instagram: { username: string | null; followers: number | null } | null;
  /** where new leads from this page go; null = nobody gets them */
  link: MetaPageLink | null;
  /** copies point at different clients */
  conflict: boolean;
  connections: MetaPageCopy[];
}

export interface MetaConnection {
  connectionId: string;
  owner: MetaPageLink;
  accountId: string | null;
  accountName: string | null;
  accountEmail: string | null;
  pageCount: number;
  linkedCount: number;
  hasToken: boolean;
  syncedAt: string | null;
}

export interface MetaPagesOverview {
  pages: MetaPage[];
  connections: MetaConnection[];
  counts: {
    pages: number;
    linked: number;
    unlinked: number;
    conflicts: number;
  };
}

export interface MetaSyncResult {
  connectionId: string;
  returned: number;
  added: string[];
  updated: number;
  missing: string[];
  subscribeFailed: { pageId: string; reason: string }[];
}

/** gian-new's /api/v1/admin/meta-pages endpoints. All need meta_pages.manage. */
export class MetaPagesApi {
  constructor(private readonly client: ApiClient) {}

  overview(): Promise<MetaPagesOverview> {
    return this.client.get<MetaPagesOverview>("/admin/meta-pages");
  }

  /** New leads from this page go to this client property. */
  link(pageId: string, ndid: string, hid: string): Promise<MetaPage> {
    return this.client.put<MetaPage>(
      `/admin/meta-pages/${encodeURIComponent(pageId)}/link`,
      { ndid, hid },
    );
  }

  unlink(pageId: string): Promise<MetaPage> {
    return this.client.delete<MetaPage>(
      `/admin/meta-pages/${encodeURIComponent(pageId)}/link`,
    );
  }

  /** Fetch the connection's pages from Meta again. */
  sync(connectionId: string): Promise<MetaSyncResult> {
    return this.client.post<MetaSyncResult>(
      `/admin/meta-pages/connections/${encodeURIComponent(connectionId)}/sync`,
    );
  }
}

export const metaPagesApi = new MetaPagesApi(adminClient);

/** "Corbett The Grand · Main property", or the codes when the client is unknown. */
export function linkLabel(link: MetaPageLink): string {
  if (!link.hotelName) return `${link.ndid} / ${link.hid}`;
  return link.propertyName && link.propertyName !== link.hotelName
    ? `${link.hotelName} · ${link.propertyName}`
    : link.hotelName;
}
