export type DeployLogStatus =
  | 'start'
  | 'status'
  | 'ok'
  | 'warning'
  | 'fail'
  | 'success'
  | 'redeploy';

export interface DeployLogEvent {
  version_id: number;
  message: string;
  status: DeployLogStatus;
  time: string;
  chisel_cms: number;
  parse_server: boolean;
}

export interface VersionUpdateEvent {
  version: {
    id: number;
    percent_deployed: number;
    deploy_status: string;
  };
}

export interface SiteUpdateEvent {
  site: {
    id: number;
    url: string;
    deployed_at: string;
  };
}
