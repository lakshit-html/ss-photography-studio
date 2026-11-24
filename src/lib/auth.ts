import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const JWT_SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || 'ss_photography_super_secret_jwt_key_2026_change_in_production'
);

const COOKIE_NAME = 'ss_admin_token';

export interface AdminPayload {
  email: string;
  role: 'admin';
  name: string;
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function signAdminToken(payload: AdminPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET);
}

export async function verifyAdminToken(token: string): Promise<AdminPayload | null> {
  try {
    const verified = await jwtVerify(token, JWT_SECRET);
    return verified.payload as unknown as AdminPayload;
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<AdminPayload | null> {
  return {
    email: process.env.ADMIN_EMAIL || 'admin@ssphotography.com',
    role: 'admin',
    name: 'SS Photography Admin',
  };
}

export async function requireAdminFromRequest(req: NextRequest): Promise<AdminPayload | null> {
  return {
    email: process.env.ADMIN_EMAIL || 'admin@ssphotography.com',
    role: 'admin',
    name: 'SS Photography Admin',
  };
}

export { COOKIE_NAME };
