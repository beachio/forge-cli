export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token: string;
  site_tokens: Record<string, string>;
  name?: string;
  email?: string;
  locked?: boolean;
  retry_after_seconds?: number;
  pusher_key?: string;
  pusher_channel?: string;
  organisations?: Array<{ id: number; name: string; role: string }>;
}

export interface TokenCreateRequest {
  name?: string;
  scopes?: string[];
  site_ids?: number[];
  expires_in_days?: number;
}

export interface TokenCreateResponse {
  token: string;
  id: number;
  name: string;
  scopes: string[];
  site_ids: number[];
  expires_at: string;
  created_at: string;
  message: string;
}

export interface TokenListItem {
  id: number;
  name: string;
  scopes: string[];
  site_ids: number[];
  expires_at: string;
  created_at: string;
  last_used_at: string | null;
}

export interface SiteInfo {
  id: number;
  name: string;
  url: string;
  site_token: string;
  ssl_enabled?: boolean;
  force_ssl_enabled?: boolean;
  turbojs_enabled?: boolean;
  hammer_enabled?: boolean;
  compiler_mode?: string;
  deployment_method?: string;
  organisation_id?: number | null;
  organisation_name?: string | null;
  project_id?: number | null;
}

export interface SitesResponse {
  sites: SiteInfo[];
  pagination?: { page: number; limit: number; total: number; total_pages: number };
}

export interface CreateSiteRequest {
  name: string;
  custom?: boolean;
}

export interface DeployRequest {
  site_tokens: string;
  archive: File | Blob;
}

export interface DeployDetail {
  site_id: number;
  url: string;
  mode: string;
  version_id: number;
  version_number: number;
  previous_version_id: number | null;
  status: string;
}

export interface DeployResponse {
  deploy?: DeployDetail;
  success?: boolean;
  message?: string;
  version?: number;
}

export interface DeployUploadTarget {
  method: 'PUT' | 'POST';
  url: string;
  headers?: Record<string, string>;
}

export interface DeployInitResponse {
  deploy_id: string;
  version_id?: number | null;
  upload: DeployUploadTarget;
  expires_at?: string;
  limits?: {
    max_archive_size_bytes: number;
    upload_expires_in_seconds: number;
  };
}

export interface DeployCompleteResponse {
  deploy: DeployDetail;
  success?: boolean;
  message?: string;
}

export interface DeployStatusResponse {
  deploy_id: string;
  status: string;
  version_id?: number | null;
  version_number?: number | null;
  url?: string;
  site_id?: number;
  error?: string;
}

export interface RedeployDetail {
  site_id: number;
  url: string;
  mode: string;
  source: 'github' | 'bitbucket' | 'dropbox' | null;
  same_version: boolean;
  version_id: number | null;
  status: string;
}

export interface RedeployResponse {
  redeploy?: RedeployDetail;
  success?: boolean;
  message?: string;
}

export interface VersionEntry {
  id: number;
  version_number: number;
  description: string | null;
  deploy_status: string;
  status: string;
  created_at: string;
  deployed_at: string | null;
  file_size: number | null;
  user_id: number;
}

export interface VersionsResponse {
  site: { id: number; url: string; current_version_id: number };
  versions: VersionEntry[];
  pagination: { page: number; limit: number; total: number; total_pages: number };
}

export interface RollbackResponse {
  rollback: {
    site_id: number;
    url: string;
    version_id: number;
    version_number: number;
    previous_version_id: number;
    previous_version_number: number;
    status: string;
  };
}

export interface SettingsToggleRequest {
  site_token: string;
  status: boolean;
}

export interface DomainChangeRequest {
  site_token: string;
  new_domain: string;
}

export interface CompilerModeRequest {
  site_token: string;
  mode: string;
}

export interface DeploymentMethodRequest {
  site_token: string;
  deployment_method: string;
  folder_path?: string;
  branch?: string;
}

export interface ApiErrorResponse {
  error: string;
  success?: false;
  message?: string;
  details?: string;
  retry_after_seconds?: number;
  locked?: boolean;
  token_expired?: boolean;
  required_scope?: string;
  token_scopes?: string[];
}

export interface BandwidthRequest {
  site_token: string;
  unit?: string;
  to?: string;
  after?: string;
}

export interface Organisation {
  id: number;
  name: string;
  role: string;
  subscription_active?: boolean;
  sites_count?: number;
  projects_count?: number;
}

export interface OrganisationsResponse {
  organisations: Organisation[];
}

export interface OrgSwitchResponse {
  message: string;
  organisation_id: number | null;
  organisation_name?: string;
}

export interface ProjectSite {
  id: number;
  url: string;
  site_token: string;
  mode: string;
  deployed_at: string | null;
  ssl: boolean;
  parent_site_id: number | null;
}

export interface Project {
  id: number;
  name: string;
  icon: string;
  icon_color: string;
  organisation_id: number | null;
  organisation_name: string | null;
  sites_count: number;
  sites: ProjectSite[];
  created_at: string;
  updated_at?: string;
}

export interface ProjectsResponse {
  projects: Project[];
}

export interface ProjectResponse {
  project: Project;
  message?: string;
}
