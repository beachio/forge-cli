import { readForgeConfig } from '../../config/forge-config.js';
import { resolveSiteTokenWithFallback } from '../../auth/resolver.js';
import { AuthError } from '../../utils/errors.js';

export type FeedbackStatus = 'open' | 'resolved' | 'dismissed';
export type FeedbackType = 'element' | 'text';

export interface SiteFeedback {
  id: number;
  site_id: number;
  version_id: number | null;
  page_url: string;
  feedback_type: FeedbackType;
  selector: string | null;
  element_summary: string | null;
  selected_text: string | null;
  comment: string;
  screenshot_url: string | null;
  author_name: string | null;
  author_email: string | null;
  browser_name: string | null;
  browser_version: string | null;
  os_name: string | null;
  os_version: string | null;
  device_type: string | null;
  viewport_width: number | null;
  viewport_height: number | null;
  scroll_x: number | null;
  scroll_y: number | null;
  screen_width: number | null;
  screen_height: number | null;
  device_pixel_ratio: number | null;
  locale: string | null;
  timezone: string | null;
  color_scheme: string | null;
  touch_capable: boolean | null;
  referrer: string | null;
  page_title: string | null;
  user_agent: string | null;
  status: FeedbackStatus;
  created_at: string;
  updated_at: string;
}

export interface FeedbackListMeta {
  page: number;
  per_page: number;
  total: number;
  open_count: number;
  resolved_count: number;
  dismissed_count: number;
  site_id: number;
  site_url: string;
}

export interface FeedbackListResponse {
  site_feedbacks: SiteFeedback[];
  meta: FeedbackListMeta;
}

export interface FeedbackShowResponse {
  site_feedback: SiteFeedback;
}

export interface FeedbackUpdateResponse {
  site_feedback: SiteFeedback;
}

export interface ResolveFeedbackSiteOptions {
  site?: string;
  siteToken?: string;
  token?: string;
}

export async function resolveFeedbackSiteQuery(
  options: ResolveFeedbackSiteOptions,
): Promise<Record<string, string>> {
  const siteRef = options.site || readForgeConfig()?.site;

  if (siteRef && /^\d+$/.test(siteRef)) {
    return { site_id: siteRef };
  }

  if (siteRef) {
    try {
      const siteToken = await resolveSiteTokenWithFallback({
        site: siteRef,
        siteToken: options.siteToken,
        token: options.token,
      });
      return { site_token: siteToken };
    } catch {
      return { site_token: siteRef };
    }
  }

  if (options.siteToken) {
    return { site_token: options.siteToken };
  }

  throw new AuthError(
    'Site required. Use --site <id|name|token>, --site-token, or run from a directory with forge.json.',
  );
}

export function feedbackStatusBadge(status: FeedbackStatus): string {
  switch (status) {
    case 'open':
      return 'open';
    case 'resolved':
      return 'resolved';
    case 'dismissed':
      return 'dismissed';
    default:
      return status;
  }
}
