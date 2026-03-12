export const SCOPES = {
  READ: 'read',
  WRITE: 'write',
  SITES_READ: 'sites:read',
  SITES_WRITE: 'sites:write',
  SITES_DEPLOY: 'sites:deploy',
  PROJECTS_READ: 'projects:read',
  PROJECTS_WRITE: 'projects:write',
  FORMS_READ: 'forms:read',
  FORMS_WRITE: 'forms:write',
  ANALYTICS_READ: 'analytics:read',
  BANDWIDTH_READ: 'bandwidth:read',
  ORGANISATIONS_READ: 'organisations:read',
  ORGANISATIONS_WRITE: 'organisations:write',
  MEMBERSHIPS_READ: 'memberships:read',
  MEMBERSHIPS_WRITE: 'memberships:write',
} as const;

export type Scope = (typeof SCOPES)[keyof typeof SCOPES];

export const ALL_SCOPES: Scope[] = Object.values(SCOPES);

export const COMMAND_SCOPES: Record<string, Scope | null> = {
  login: null,
  logout: null,
  whoami: null,
  init: null,
  add: null,
  'token:create': null,
  'token:list': null,
  'token:revoke': null,
  sites: SCOPES.SITES_READ,
  create: SCOPES.SITES_WRITE,
  deploy: SCOPES.SITES_DEPLOY,
  versions: SCOPES.SITES_READ,
  rollback: SCOPES.SITES_DEPLOY,
  'settings:ssl': SCOPES.SITES_DEPLOY,
  'settings:domain': SCOPES.SITES_DEPLOY,
  'settings:compiler': SCOPES.SITES_DEPLOY,
  'settings:deploy-method': SCOPES.SITES_DEPLOY,
};
