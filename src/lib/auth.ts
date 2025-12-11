// Authentication helpers using JWT
// Uses jose library for Cloudflare Workers compatibility

import * as jose from 'jose';
import type { AdminUser, JWTPayload } from './types';

const TOKEN_EXPIRY = '7d'; // 7 days
const COOKIE_NAME = 'admin_token';

/**
 * Hash a password using PBKDF2 (Cloudflare Workers compatible)
 * Format: iterations:salt:hash
 */
export async function hashPassword(password: string): Promise<string> {
  const iterations = 100000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const encoder = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterations,
      hash: 'SHA-512',
    },
    keyMaterial,
    512
  );

  const hashArray = Array.from(new Uint8Array(derivedBits));
  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return `${iterations}:${saltHex}:${hashHex}`;
}

/**
 * Verify a password against a PBKDF2 hash
 * Hash format: iterations:salt:hash
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(':');
  if (parts.length !== 3) {
    return false;
  }

  const [iterationsStr, saltHex, expectedHash] = parts;
  const iterations = parseInt(iterationsStr, 10);

  // Convert salt from hex to Uint8Array
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterations,
      hash: 'SHA-512',
    },
    keyMaterial,
    512
  );

  const hashArray = Array.from(new Uint8Array(derivedBits));
  const computedHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return computedHash === expectedHash;
}

/**
 * Generate a JWT token for a user
 */
export async function generateToken(
  user: AdminUser,
  jwtSecret: string,
  sessionId: string
): Promise<string> {
  const secret = new TextEncoder().encode(jwtSecret);

  const token = await new jose.SignJWT({
    sub: user.id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    tenant_id: user.tenant_id,
    jti: sessionId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(secret);

  return token;
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string, jwtSecret: string): Promise<JWTPayload> {
  const secret = new TextEncoder().encode(jwtSecret);

  const { payload } = await jose.jwtVerify(token, secret);

  return {
    sub: payload.sub as string,
    email: payload.email as string,
    name: payload.name as string,
    role: payload.role as 'agency' | 'admin' | 'viewer',
    tenant_id: payload.tenant_id as string | null,
    jti: payload.jti as string,
    iat: payload.iat as number,
    exp: payload.exp as number,
  };
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return crypto.randomUUID();
}

/**
 * Get token from request (cookie or Authorization header)
 */
export function getTokenFromRequest(request: Request): string | null {
  // Try Authorization header first
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Try cookie
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const cookies = parseCookies(cookieHeader);
    if (cookies[COOKIE_NAME]) {
      return cookies[COOKIE_NAME];
    }
  }

  return null;
}

/**
 * Create a Set-Cookie header value for the auth token
 */
export function createAuthCookie(token: string, maxAge: number = 7 * 24 * 60 * 60): string {
  // Use Secure only in production (HTTPS), use SameSite=Lax to allow same-site navigation
  const isProduction = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';
  const secure = isProduction ? 'Secure; ' : '';
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; ${secure}SameSite=Lax; Max-Age=${maxAge}`;
}

/**
 * Create a Set-Cookie header to clear the auth cookie
 */
export function createLogoutCookie(): string {
  const isProduction = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';
  const secure = isProduction ? 'Secure; ' : '';
  return `${COOKIE_NAME}=; Path=/; HttpOnly; ${secure}SameSite=Lax; Max-Age=0`;
}

/**
 * Parse cookies from Cookie header
 */
function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach((cookie) => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name && rest.length > 0) {
      cookies[name] = rest.join('=');
    }
  });
  return cookies;
}

/**
 * Check if user has permission for a tenant
 */
export function canAccessTenant(user: JWTPayload, tenantId: string): boolean {
  // Agency role can access all tenants
  if (user.role === 'agency') {
    return true;
  }
  // Other roles can only access their own tenant
  return user.tenant_id === tenantId;
}

/**
 * Check if user can modify data (not viewer)
 */
export function canModify(user: JWTPayload): boolean {
  return user.role !== 'viewer';
}

/**
 * Create session in database
 */
export async function createSession(
  db: D1Database,
  userId: number,
  sessionId: string,
  expiresAt: Date
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`
    )
    .bind(sessionId, userId, expiresAt.toISOString())
    .run();
}

/**
 * Validate session exists and is not expired
 */
export async function validateSession(db: D1Database, sessionId: string): Promise<boolean> {
  const result = await db
    .prepare(
      `SELECT id FROM sessions WHERE id = ? AND expires_at > datetime('now')`
    )
    .bind(sessionId)
    .first();

  return result !== null;
}

/**
 * Delete session (logout)
 */
export async function deleteSession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare(`DELETE FROM sessions WHERE id = ?`).bind(sessionId).run();
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(db: D1Database): Promise<void> {
  await db.prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`).run();
}

/**
 * Get user by email
 */
export async function getUserByEmail(db: D1Database, email: string): Promise<AdminUser | null> {
  const result = await db
    .prepare(`SELECT * FROM admin_users WHERE email = ? AND is_active = 1`)
    .bind(email)
    .first<AdminUser>();

  return result || null;
}

/**
 * Update user's last login time
 */
export async function updateLastLogin(db: D1Database, userId: number): Promise<void> {
  await db
    .prepare(`UPDATE admin_users SET last_login = datetime('now') WHERE id = ?`)
    .bind(userId)
    .run();
}
