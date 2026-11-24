import os from 'os';
import fs from 'fs';
import path from 'path';

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
      // Pick IPv4 non-internal address (e.g. 192.168.x.x, 10.x.x.x, 172.x.x.x)
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
export function getHostConfig(): HostConfig {
  const lanIp = getLocalIPv4();
  const defaultPort = 3000;

  // 1. Explicit production HTTPS domain (Firebase Hosting / Custom Domain)
  const productionDomain = process.env.PRODUCTION_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_APP_URL;
  if (productionDomain && productionDomain.startsWith('https://') && !productionDomain.includes('localhost')) {
    return {
      activeUrl: productionDomain.replace(/\/$/, ''),
      mode: 'CUSTOM',
      lanIp,
      port: defaultPort,
      lastUpdated: new Date().toISOString(),
    };
  }

  // 2. Active saved configuration from admin monitor
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      if (data.activeUrl) {
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

  // 3. Fallback: Local network development
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  return {
    activeUrl: envUrl || `http://${lanIp}:${defaultPort}`,
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
export function getActiveGuestBaseUrl(): string {
  const cfg = getHostConfig();
  return cfg.activeUrl;
}
