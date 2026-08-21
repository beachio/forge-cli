/** Normalize a site name or URL to a full Forge site URL for display. */
export function toForgeSiteUrl(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\/+$/, '');

  if (normalized.includes('.')) return normalized;
  return `${normalized}.getforge.io`;
}

export function isUrlAlreadyInUseMessage(message: string): boolean {
  return /url.*already.*in use|already.*in use|name.*taken|url.*taken/i.test(message);
}

/** Suggest a likely-unique site name slug from an taken name. */
export function suggestUniqueSiteName(baseName: string): string {
  const slug = baseName
    .replace(/\.getforge\.io$/i, '')
    .replace(/-\d{6,}$/, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-+|-+$/g, '');

  const suffix = Date.now().toString().slice(-6);
  const candidate = `${slug}-${suffix}`;
  return candidate.length >= 3 ? candidate : `site-${suffix}`;
}

export function urlAlreadyInUseMessage(siteName: string): string {
  const url = toForgeSiteUrl(siteName);
  const suggestion = suggestUniqueSiteName(siteName);

  return [
    `The URL ${url} is already taken on Forge.`,
    '',
    'Forge site URLs are globally unique across all accounts. This subdomain is not available to you — it may belong to another user or organisation, or be reserved from a previous site.',
    '',
    'Choose a different name, for example:',
    `  forge create --name ${suggestion}`,
  ].join('\n');
}

export function siteNotInAccountMessage(
  siteName: string,
  options: { orgFiltered?: boolean } = {},
): string {
  const url = toForgeSiteUrl(siteName);

  const lines = [
    `Site ${url} is not in your account.`,
    '',
    'You can only deploy to sites your CLI token can access. Common causes:',
    '  • The URL is owned by another Forge account (URLs are globally unique)',
    '  • The site is under a different organisation',
    '  • The name in forge.json is outdated or misspelled',
  ];

  if (options.orgFiltered) {
    lines.push('  • Your active org context is filtering it out — try `--org personal` or `--org <id>`');
  }

  lines.push(
    '',
    'If `forge create` says the URL is already in use but add/lookup cannot find it, another account likely owns that subdomain.',
    '',
    'Next steps:',
    '  forge sites                    List sites you can access',
    `  forge add ${url}               Link a site you own`,
    '  forge create --name <unique>   Create a new site with a unique name',
    '  forge auth doctor              Diagnose token and org context',
  );

  return lines.join('\n');
}

export function siteNotInAccountSuggestion(siteName: string): string {
  const url = toForgeSiteUrl(siteName);
  return [
    `Verify you own ${url} with \`forge sites\`.`,
    'If create says the URL is taken, another account likely owns it — pick a unique name.',
    'Try `--org <id>` or `forge org switch` if the site is under a different organisation.',
  ].join(' ');
}
