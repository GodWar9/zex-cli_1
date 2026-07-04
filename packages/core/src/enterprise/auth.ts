// ─── Enterprise auth stub (SAML / LDAP / API-key) — Q4 ──────────────────────
//
// Production SAML/LDAP requires external IdP integration. This module provides:
//   - Config-driven auth gate on startup
//   - Env-based bypass for CI/automation (ZEX_AUTH_TOKEN)
//   - Stub validators that can be swapped for real passport-saml / ldapjs

import { loadOrgConfig } from './orgConfig.ts';
import type { AuthSession, AuthProvider } from './types.ts';
import { writeAudit } from './auditLog.ts';

let _session: AuthSession | null = null;

/** Validate credentials and establish session. */
export async function authenticate(credentials?: {
  username?: string;
  password?: string;
  token?: string;
}): Promise<AuthSession | null> {
  const org = loadOrgConfig();
  const provider = org.auth.provider;

  if (provider === 'none') {
    _session = {
      userId: 'local-user',
      email: 'local@zex.dev',
      orgId: org.orgId,
      provider: 'none',
      authenticatedAt: Date.now(),
    };
    return _session;
  }

  // API-key auth via env
  const envToken = process.env['ZEX_AUTH_TOKEN'];
  if (credentials?.token && credentials.token === envToken) {
    _session = {
      userId: process.env['ZEX_USER_ID'] ?? 'api-user',
      email: process.env['ZEX_USER_EMAIL'] ?? 'api@org.local',
      orgId: org.orgId,
      provider: 'api-key',
      authenticatedAt: Date.now(),
    };
    writeAudit({ category: 'auth', action: 'login', details: { provider: 'api-key' } });
    return _session;
  }

  if (provider === 'ldap') {
    return authenticateLdap(credentials?.username, credentials?.password);
  }

  if (provider === 'saml') {
    return authenticateSamlStub(credentials?.token);
  }

  return null;
}

/** LDAP stub — validates against ZEX_LDAP_PASSWORD env for dev; replace with ldapjs in prod. */
async function authenticateLdap(username?: string, password?: string): Promise<AuthSession | null> {
  const org = loadOrgConfig();
  const expectedPass = process.env['ZEX_LDAP_PASSWORD'];

  if (!username || !password) return null;

  // Dev stub: accept if password matches env, or username is admin with any password in dev
  const valid = expectedPass ? password === expectedPass : username === 'admin';

  if (!valid) {
    writeAudit({ category: 'auth', action: 'login_failed', details: { provider: 'ldap', username }, severity: 'warning' });
    return null;
  }

  _session = {
    userId: username,
    email: `${username}@${org.orgId}.local`,
    orgId: org.orgId,
    provider: 'ldap',
    authenticatedAt: Date.now(),
  };
  writeAudit({ category: 'auth', action: 'login', details: { provider: 'ldap', username } });
  return _session;
}

/** SAML stub — accepts ZEX_SAML_ASSERTION env token; replace with passport-saml in prod. */
async function authenticateSamlStub(assertion?: string): Promise<AuthSession | null> {
  const org = loadOrgConfig();
  const expected = process.env['ZEX_SAML_ASSERTION'] ?? 'saml-dev-token';

  if (assertion !== expected) {
    writeAudit({ category: 'auth', action: 'login_failed', details: { provider: 'saml' }, severity: 'warning' });
    return null;
  }

  _session = {
    userId: process.env['ZEX_USER_ID'] ?? 'saml-user',
    email: process.env['ZEX_USER_EMAIL'] ?? `user@${org.orgId}.sso`,
    orgId: org.orgId,
    provider: 'saml',
    authenticatedAt: Date.now(),
  };
  writeAudit({ category: 'auth', action: 'login', details: { provider: 'saml' } });
  return _session;
}

/** Gate: returns true if auth satisfied or not required. */
export async function ensureAuthenticated(): Promise<{ ok: boolean; message?: string }> {
  const org = loadOrgConfig();

  if (!org.auth.required || org.auth.provider === 'none') {
    if (!_session) await authenticate();
    return { ok: true };
  }

  if (_session) return { ok: true };

  // Auto-auth via env token
  const token = process.env['ZEX_AUTH_TOKEN'];
  if (token) {
    const session = await authenticate({ token });
    if (session) return { ok: true };
  }

  const hints: Record<AuthProvider, string> = {
    none: '',
    'api-key': 'Set ZEX_AUTH_TOKEN env var.',
    ldap: 'Set ZEX_LDAP_PASSWORD or use username "admin" in dev. Run: /login <user> <pass>',
    saml: 'Set ZEX_SAML_ASSERTION env var. Run: /login <token>',
  };

  return {
    ok: false,
    message: `Authentication required (${org.auth.provider}). ${hints[org.auth.provider]}`,
  };
}

export function getAuthSession(): AuthSession | null {
  return _session;
}

export function logout(): void {
  if (_session) {
    writeAudit({ category: 'auth', action: 'logout', details: { userId: _session.userId } });
  }
  _session = null;
}

export function formatAuthStatus(): string {
  const org = loadOrgConfig();
  const s = _session;
  if (!s) {
    return `Auth: not logged in (provider: ${org.auth.provider}, required: ${org.auth.required ?? false})`;
  }
  return `Auth: ${s.email} @ ${s.orgId} via ${s.provider}`;
}
