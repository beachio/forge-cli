import { createServer, type Server } from 'node:http';
import { URL } from 'node:url';
import open from 'open';
import { getApiClient } from '../api/client.js';
import { API_PATHS } from '../config/constants.js';
import { storeCredentials } from './token-store.js';
import * as logger from '../utils/logger.js';
import { handleCommandResult } from '../utils/output.js';
import type { TokenCreateResponse } from '../api/endpoints.js';

const OAUTH_CLIENT_ID = process.env.FORGE_OAUTH_CLIENT_ID || 'forge-cli';
const FORGE_BASE_URL = process.env.FORGE_BASE_URL || 'https://getforge.com';

export async function startOAuthFlow(): Promise<void> {
  const spin = logger.spinner('Starting browser login...');

  return new Promise((resolve, reject) => {
    const server: Server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url || '/', `http://localhost`);

        if (url.pathname === '/callback') {
          const code = url.searchParams.get('code');
          const error = url.searchParams.get('error');

          if (error) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(htmlPage('Login Failed', 'Authentication was denied. You can close this tab.'));
            server.close();
            spin.stop();
            reject(new Error(`OAuth error: ${error}`));
            return;
          }

          if (!code) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(htmlPage('Error', 'No authorization code received.'));
            server.close();
            spin.stop();
            reject(new Error('No authorization code received'));
            return;
          }

          spin.text = 'Exchanging authorization code...';

          const client = getApiClient();

          const tokenResponse = await client.post<{ access_token: string }>(API_PATHS.oauthToken, {
            body: {
              grant_type: 'authorization_code',
              code,
              redirect_uri: `http://localhost:${(server.address() as { port: number }).port}/callback`,
              client_id: OAUTH_CLIENT_ID,
            },
          });

          spin.text = 'Creating CLI token...';

          const cliToken = await client.post<TokenCreateResponse>(API_PATHS.tokens, {
            headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
            body: { name: 'CLI (browser login)' },
          });

          storeCredentials({
            token: cliToken.token,
            token_type: 'cli',
            expires_at: cliToken.expires_at,
          });

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(htmlPage('Success', 'You are now logged in. You can close this tab.'));

          server.close();
          spin.stop();
          handleCommandResult(
            { success: true, method: 'oauth' },
            'Logged in via browser. CLI token stored.',
          );
          resolve();
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(htmlPage('Error', 'Something went wrong during authentication.'));
        server.close();
        spin.stop();
        reject(err);
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port;
      const authorizeUrl = new URL(API_PATHS.oauthAuthorize, FORGE_BASE_URL);
      authorizeUrl.searchParams.set('client_id', OAUTH_CLIENT_ID);
      authorizeUrl.searchParams.set('redirect_uri', `http://localhost:${port}/callback`);
      authorizeUrl.searchParams.set('response_type', 'code');

      spin.text = 'Opening browser...';
      open(authorizeUrl.toString()).catch(() => {
        spin.stop();
        logger.info(`Open this URL in your browser:\n  ${authorizeUrl.toString()}`);
      });
    });

    server.on('error', (err) => {
      spin.stop();
      reject(err);
    });

    setTimeout(() => {
      server.close();
      spin.stop();
      reject(new Error('OAuth login timed out after 5 minutes.'));
    }, 5 * 60 * 1000);
  });
}

function htmlPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html><head><title>Forge CLI - ${title}</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8f9fa;}
.card{text-align:center;padding:2rem 3rem;background:white;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.1);}
h1{margin:0 0 .5rem;color:#1a1a1a;font-size:1.5rem;}
p{color:#666;margin:0;}</style></head>
<body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`;
}
