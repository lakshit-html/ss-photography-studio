import os from 'os';
import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';

export interface HostConfig {
  activeUrl: string;
  mode: 'CLOUDFLARE_TUNNEL' | 'LOCALTUNNEL' | 'LOCAL_WIFI' | 'CUSTOM';
  lanIp: string;
  port: number;
  lastUpdated: string;
}

const CONFIG_PATH = path.resolve(process.cwd(), 'uploader/active-host.json');

/**
 * Detects the local Wi-Fi / Ethernet IPv4 address of this machine
 */
export function getLocalIPv4(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const netList = interfaces[name];
    if (!netList) continue;
    for (const net of netList) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

/**
 * Returns current host and guest access configuration
 */
export function getHostConfig(req?: NextRequest): HostConfig {
  const lanIp = getLocalIPv4();
  const defaultPort = 3000;

  // 1. Dynamic request host detection (Vercel, custom domains, live cloud hosts)
  if (req) {
    const proto = req.headers.get('x-forwarded-proto') || 'https';
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    if (host && !host.includes('trycloudflare.com') && !host.includes('localhost') && !host.includes('127.0.0.1')) {
      return {
        activeUrl: `${proto}://${host}`,
        mode: 'CUSTOM',
        lanIp,
        port: defaultPort,
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  // 2. Vercel environment URL
  if (process.env.VERCEL_URL) {
    return {
      activeUrl: `https://${process.env.VERCEL_URL}`,
      mode: 'CUSTOM',
      lanIp,
      port: defaultPort,
      lastUpdated: new Date().toISOString(),
    };
  }

  // 3. Explicit production HTTPS domain (Custom Domain / NEXT_PUBLIC_APP_URL)
  const productionDomain = process.env.PRODUCTION_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_APP_URL;
  if (
    productionDomain &&
    productionDomain.startsWith('https://') &&
    !productionDomain.includes('localhost') &&
    !productionDomain.includes('trycloudflare.com')
  ) {
    return {
      activeUrl: productionDomain.replace(/\/$/, ''),
      mode: 'CUSTOM',
      lanIp,
      port: defaultPort,
      lastUpdated: new Date().toISOString(),
    };
  }

  // 4. Active saved configuration from admin monitor (only if not an expired tunnel)
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      if (data.activeUrl && !data.activeUrl.includes('trycloudflare.com')) {
        return {
          activeUrl: data.activeUrl.replace(/\/$/, ''),
          mode: data.mode || 'LOCAL_WIFI',
          lanIp,
          port: defaultPort,
          lastUpdated: data.lastUpdated || new Date().toISOString(),
        };
      }
    } catch {}
  }

  // 5. Fallback: Local network development
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  return {
    activeUrl:
      envUrl && !envUrl.includes('trycloudflare.com')
        ? envUrl
        : `http://${lanIp}:${defaultPort}`,
    mode: 'LOCAL_WIFI',
    lanIp,
    port: defaultPort,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Saves updated host configuration (e.g. from cloudflared tunnel or admin dashboard)
 */
export function saveHostConfig(url: string, mode: HostConfig['mode']): HostConfig {
  const lanIp = getLocalIPv4();
  const cleanUrl = url.trim().replace(/\/$/, '');

  const payload: HostConfig = {
    activeUrl: cleanUrl,
    mode,
    lanIp,
    port: 3000,
    lastUpdated: new Date().toISOString(),
  };

  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

/**
 * Returns the effective base URL for QR codes and guest links
 */
export function getActiveGuestBaseUrl(req?: NextRequest): string {
  const cfg = getHostConfig(req);
  return cfg.activeUrl;
}
