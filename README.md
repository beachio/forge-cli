# Forge CLI

Command line interface for [GetForge.com](https://getforge.com) — deploy and manage your Forge sites from the terminal.

## Install

```bash
npm install -g @beachio/forge-cli
```

Requires Node.js 18 or later.

## Quick Start

```bash
# Log in with your Forge credentials
forge login

# Create a new site
forge create --name my-site

# Link your project directory to a site
forge add my-site.getforge.io

# Deploy
forge deploy
```

## Global Options

These options apply to all commands:

| Option | Description |
|---|---|
| `--json` | Output results as JSON |
| `--quiet` | Suppress all output except errors |
| `--debug-http` | Print full HTTP request/response debug logs |
| `--token <token>` | Authenticate with a CLI token |
| `--site-token <token>` | Authenticate with a site token |
| `-v, --version` | Show version |
| `--help` | Show help for any command |

## Authentication

Forge CLI supports multiple authentication methods for different workflows.

### Interactive Login

```bash
forge login                              # Prompts for email and password
forge login --email me@example.com       # Prompts for password only
```

### Direct Token

```bash
forge login --with-token <cli-token>     # Store a pre-existing CLI token
```

### Browser Login (OAuth2)

```bash
forge login --browser                    # Opens browser for authentication
```

### Environment Variables

For CI/CD pipelines and automation:

```bash
export FORGE_TOKEN=<cli-token>           # CLI token for general access
export FORGE_SITE_TOKEN=<site-token>     # Site token for deploy-only access
```

### Check Auth Status

```bash
forge whoami                             # Show current user, token type, and org context
```

### Logout

```bash
forge logout                             # Clear stored credentials
```

## Token Management

Create scoped tokens for CI/CD and AI agents:

```bash
# Full-access token
forge token create

# Scoped deploy token for specific sites
forge token create --name "CI Deploy" --scopes sites:deploy --site-ids 101,102

# Short-lived token for AI agents
forge token create --name "AI Agent" --scopes sites:deploy --site-ids 101 --expires-in-days 7

# List active tokens
forge token list

# Revoke a token
forge token revoke <id>
```

### `forge token create` Options

| Option | Description | Default |
|---|---|---|
| `--name <name>` | Human-readable label | — |
| `--scopes <scopes>` | Comma-separated scopes | unrestricted |
| `--site-ids <ids>` | Comma-separated site IDs to restrict access | all sites |
| `--expires-in-days <n>` | Days until token expires | 90 |

### Available Scopes

| Scope | Grants |
|---|---|
| `sites:read` | List sites, view version info |
| `sites:write` | Create new sites |
| `sites:deploy` | Deploy to sites |
| `forms:read` | Read form submissions |
| `analytics:read` | Read site analytics |
| `bandwidth:read` | Read bandwidth usage |
| `organisations:read` | Read organisations |
| `organisations:write` | Manage organisations |

Tokens created with no scopes have unrestricted access.

## Site Management

### List Sites

```bash
forge sites                              # List all your sites
forge sites --org personal               # Personal sites only
forge sites --org 123                    # Sites under an organisation
forge sites --environment production     # Filter by environment
forge sites --page 1 --limit 20         # Paginate results
```

| Option | Description |
|---|---|
| `--environment <env>` | Filter by environment (`production`, `staging`, `development`) |
| `--org <id>` | Filter by organisation ID (`personal` or `0` for personal sites) |
| `--page <n>` | Page number (shows single page instead of all results) |
| `--limit <n>` | Results per page (default: 100, max: 500) |

### Create a Site

```bash
forge create --name my-site              # Create a site at my-site.getforge.io
forge create --name my-app --custom mysite.com   # With a custom domain
forge create --name my-site --org 123    # Under an organisation
forge create --name my-site --project 5  # Create and place in project id 5
forge create --name my-site --project "Marketing Sites"  # Create and place by project name
```

| Option | Description |
|---|---|
| `--name <name>` | Site name, 3–63 chars, alphanumeric and hyphens (required) |
| `--custom <domain>` | Custom domain to assign |
| `--org <id>` | Create under an organisation |
| `--project <id\|name>` | Add site to a project (folder) by numeric ID or name |

When `--project` is a name rather than a numeric ID, the CLI resolves it automatically.

### Link a Directory

```bash
forge add my-site.getforge.io           # Link current directory to a site
```

This writes the site URL to `forge.json` so subsequent commands know which site to target.

### Site Info

```bash
forge info                               # Show info for linked site
forge info --site my-site.getforge.io    # Show info for a specific site
```

Displays site configuration including SSL, compiler, build settings, environment variables, current version, and deploy status.

### Delete a Site

```bash
forge destroy                            # Delete the linked site (with confirmation)
forge destroy --site my-site.getforge.io # Delete a specific site
forge destroy --force                    # Skip confirmation prompt
```

## Deployment

```bash
forge deploy                             # Deploy the linked site
forge deploy -m "added new page"         # Deploy with a version message
forge deploy -d ./build                  # Deploy a specific directory
forge deploy --site my-site.getforge.io  # Deploy to a specific site
forge deploy --no-watch                  # Skip real-time deploy tracking
```

| Option | Description |
|---|---|
| `-s, --site <site>` | Site name to deploy to |
| `-m, --message <msg>` | Version description |
| `-d, --directory <dir>` | Directory to deploy (overrides `forge.json`) |
| `--no-watch` | Skip real-time deploy log streaming |

Deploys create a zip archive of your project, upload it, and stream real-time build logs back to the terminal. Use `--no-watch` to fire and forget.

### Redeploy (from source)

```bash
forge redeploy                           # Redeploy linked site from connected source
forge redeploy --site my-site            # Redeploy a specific site
forge redeploy --site my-site --org 7    # Resolve site under org context
forge redeploy --cache                   # Reprocess current version (no source pull)
forge redeploy --delay 30                # Queue deploy with a 30 second delay
```

| Option | Description |
|---|---|
| `-s, --site <site>` | Site name |
| `--org <id>` | Organisation ID for site lookup (`personal` or `0` for personal) |
| `--cache` | Redeploy current version without pulling from source |
| `--delay <seconds>` | Delay deploy start by N seconds |

Redeploy triggers `POST /api/v2/cli/redeploy` and is useful for CI/CD workflows where Forge pulls from GitHub, Bitbucket, or Dropbox directly.

## Versions & Rollback

### List Versions

```bash
forge versions                           # List version history for linked site
forge versions --site my-site            # For a specific site
forge versions --limit 50 --page 2       # Paginate results
```

| Option | Description |
|---|---|
| `-s, --site <site>` | Site name |
| `--limit <n>` | Versions per page (default: 20, max: 100) |
| `--page <n>` | Page number |

### Rollback

```bash
forge rollback --version-id 789          # Rollback to a specific version
forge rollback -s my-site --version-id 789
```

| Option | Description |
|---|---|
| `-s, --site <site>` | Site name |
| `--version-id <id>` | Version ID to rollback to (required, from `forge versions` output) |

## Site Settings

```bash
forge settings --ssl on                  # Enable SSL
forge settings --ssl off                 # Disable SSL
forge settings --force-ssl on            # Force HTTPS redirects
forge settings --compiler jekyll         # Set compiler mode
forge settings --build-command "npm run build"   # Set custom build command
forge settings --build-folder dist       # Set build output folder
forge settings --squish on               # Enable TurboJS minification
```

Multiple settings can be updated in one call:

```bash
forge settings --ssl on --force-ssl on --compiler webpack --build-folder dist
```

| Option | Description |
|---|---|
| `-s, --site <site>` | Site name |
| `--ssl <on\|off>` | Enable or disable SSL |
| `--force-ssl <on\|off>` | Enable or disable forced HTTPS redirects |
| `--compiler <compiler>` | Compiler (`nothing`, `hammer`, `jekyll`, `middleman`, `webpack`) |
| `--build-command <cmd>` | Custom build command |
| `--build-folder <folder>` | Build output folder |
| `--squish <on\|off>` | Enable or disable TurboJS minification |

## Environment Variables

```bash
forge env                                # List environment variables
forge env set NODE_ENV=production        # Set a variable
forge env set KEY1=val1 KEY2=val2        # Set multiple at once
forge env unset API_KEY                  # Remove a variable
forge env unset KEY1 KEY2               # Remove multiple
```

| Command | Description |
|---|---|
| `forge env` | List all environment variables for the site |
| `forge env set <pairs...>` | Set one or more `KEY=VALUE` pairs |
| `forge env unset <keys...>` | Remove one or more variables by key |

All env commands accept `-s, --site <site>` to target a specific site.

## Domain Management

### Check DNS

```bash
forge domain check --domain mysite.com   # Verify DNS is configured correctly
```

Returns the current DNS records and instructions for configuring your domain if they don't match.

### Set Custom Domain

```bash
forge domain set --site-token abc123 --domain mysite.com
```

| Option | Description |
|---|---|
| `--site-token <token>` | Site token for the target site (required) |
| `--domain <domain>` | Custom domain to assign (required) |

## Usage & Bandwidth

```bash
forge usage                              # Show bandwidth and build usage
forge usage --days 7                     # Include daily breakdown for last 7 days
```

| Option | Description |
|---|---|
| `-s, --site <site>` | Site name |
| `--days <n>` | Days of daily breakdown (default: 30, max: 365) |

Displays bandwidth (today, this week, this month, last 30 days), build minutes, and monthly history.

## Organisations

### List Organisations

```bash
forge orgs                               # List your organisations
```

### Switch Context

```bash
forge org switch --id 123                # Switch to an organisation
forge org switch --id personal           # Switch back to personal context
```

When you switch context, subsequent commands like `forge sites` and `forge create` operate within that organisation.

## Projects (Folders)

Projects group related sites together. A project belongs to either a user (personal) or an organisation.

### List Projects

```bash
forge projects                           # List all your projects
forge projects --org 123                 # Projects under a specific organisation
```

### Create a Project

```bash
forge project create "Marketing Sites"          # Personal project
forge project create "Marketing Sites" --org 5  # Under an organisation
```

### Delete a Project

```bash
forge project delete 5                   # Delete project (prompts for confirmation)
forge project delete 5 --force           # Skip confirmation (also deletes all sites in the project)
```

### Add a Site to a Project

```bash
forge project add-site 5                          # Add linked site (from forge.json)
forge project add-site 5 --site my-site.getforge.io  # Add by URL
forge project add-site 5 --site-id 42            # Add by site ID
forge project add-site 5 --site-token abc123     # Add by site token
```

### Remove a Site from a Project

```bash
forge project remove-site 5 --site-id 42         # Remove site from project (site is not deleted)
```

### Create a Site Directly in a Project

```bash
forge create --name my-site --project 5
forge create --name my-site --project "Marketing Sites"
```

The create-then-assign flow is handled automatically — it appears as a single operation.

## Project Configuration

### Initialize

```bash
forge init                               # Create forge.json interactively
forge init --force                       # Overwrite existing forge.json
```

Creates a `forge.json` in your project root:

```json
{
  "site": "my-site.getforge.io",
  "deploy_directory": ".",
  "compiler": "none",
  "ignore": ["node_modules", ".git", ".env"]
}
```

| Property | Description |
|---|---|
| `site` | Site URL to deploy to |
| `site_token` | Site token (optional, alternative to CLI token) |
| `deploy_directory` | Directory to deploy (default: `.`) |
| `compiler` | Compiler mode (`none`, `jekyll`, `middleman`, etc.) |
| `ignore` | Patterns to exclude from deployment |

### `.forgeignore`

You can create a `.forgeignore` file with gitignore-style patterns to exclude files from deployment. This works alongside the `ignore` array in `forge.json`.

### Site Resolution

For commands that operate on a site, the target is resolved in this order:

1. `--site` flag on the command
2. `--site-token` global option
3. `site` or `site_token` in `forge.json`
4. Stored site tokens from login

## Output Modes

```bash
forge sites --json                       # JSON output for scripting and CI/CD
forge deploy --quiet                     # Minimal output, exit codes only
```

All commands support `--json` and `--quiet`. JSON mode outputs structured data suitable for piping to `jq` or consuming from scripts and AI agents.

## CI/CD Usage

```yaml
# GitHub Actions example
- name: Deploy to Forge
  env:
    FORGE_TOKEN: ${{ secrets.FORGE_TOKEN }}
  run: |
    npm install -g @beachio/forge-cli
    forge deploy --json
```

For deploy-only access with a site token:

```yaml
- name: Deploy to Forge
  env:
    FORGE_SITE_TOKEN: ${{ secrets.FORGE_SITE_TOKEN }}
  run: |
    npm install -g @beachio/forge-cli
    forge deploy --json
```

### Exit Codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | General error |
| 2 | Authentication failure |
| 3 | Insufficient token scope |
| 4 | Rate limited |

## Command Reference

| Command | Description |
|---|---|
| `forge login` | Authenticate with Forge |
| `forge logout` | Clear stored credentials |
| `forge whoami` | Show current auth status |
| `forge token create` | Create a scoped CLI token |
| `forge token list` | List active CLI tokens |
| `forge token revoke <id>` | Revoke a CLI token |
| `forge sites` | List your sites |
| `forge create` | Create a new site |
| `forge add <site>` | Link directory to a site |
| `forge info` | Show site details |
| `forge destroy` | Delete a site |
| `forge deploy` | Deploy to Forge |
| `forge versions` | List version history |
| `forge rollback` | Rollback to a previous version |
| `forge settings` | Update site settings |
| `forge env` | List environment variables |
| `forge env set` | Set environment variables |
| `forge env unset` | Remove environment variables |
| `forge domain check` | Check DNS configuration |
| `forge domain set` | Assign a custom domain |
| `forge usage` | Show bandwidth and build usage |
| `forge orgs` | List organisations |
| `forge org switch` | Switch organisation context |
| `forge projects` | List projects (folders) |
| `forge project create <name>` | Create a new project |
| `forge project delete <id>` | Delete a project |
| `forge project add-site <id>` | Add a site to a project |
| `forge project remove-site <id>` | Remove a site from a project |
| `forge init` | Create forge.json |

## Development

```bash
git clone https://github.com/beachio/forge-cli.git
cd forge-cli
npm install
npm run build
npm run dev           # Watch mode
```

## License

MIT — [Beach.io](https://beach.io)
