// ─── Enterprise / Org types (Q4) ─────────────────────────────────────────────

export type AuthProvider = 'none' | 'ldap' | 'saml' | 'api-key';

export interface OrgAuthConfig {
  provider: AuthProvider;
  /** LDAP: ldap://host:389 */
  ldapUrl?: string;
  /** SAML: entity ID */
  samlEntityId?: string;
  /** SAML: SSO URL */
  samlSsoUrl?: string;
  /** Require auth before TUI starts */
  required?: boolean;
}

export interface OrgPolicies {
  /** Tools that always need user approval */
  requireApprovalFor?: string[];
  /** Security strictness override */
  strictness?: 'strict' | 'balanced' | 'permissive';
  /** Max session spend in USD (0 = unlimited) */
  budgetCapUsd?: number;
  /** Block shell commands matching these patterns */
  blockedShellPatterns?: string[];
  /** Allowed file write extensions (empty = all) */
  allowedWriteExtensions?: string[];
}

export interface OrgConfig {
  orgId: string;
  orgName: string;
  auth: OrgAuthConfig;
  policies: OrgPolicies;
  /** Shared API keys for team (optional) */
  sharedApiKeys?: string[];
  /** Audit log retention days */
  auditRetentionDays?: number;
}

export interface AuthSession {
  userId: string;
  email: string;
  orgId: string;
  provider: AuthProvider;
  authenticatedAt: number;
}

export interface AuditRecord {
  id: string;
  timestamp: string;
  orgId: string;
  userId: string;
  sessionId: string;
  turn: number;
  category: 'security' | 'tool' | 'auth' | 'budget' | 'agent';
  action: string;
  resource?: string;
  details: Record<string, unknown>;
  severity?: 'info' | 'warning' | 'critical';
}
