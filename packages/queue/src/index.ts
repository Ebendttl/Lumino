import { ConnectionOptions } from 'bullmq';

export const QUEUE_NAME = 'events';

export interface TrackEventJobPayload {
  siteId: string;
  tenantId: string;
  page: string;
  referrer: string | null;
  device: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown';
  ts: number;
  ip: string;
  userAgent: string;
}

/**
 * Generates connection options for BullMQ / Redis from the REDIS_URL environment variable.
 */
export function getRedisConnection(): ConnectionOptions {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  
  try {
    const parsed = new URL(url);
    
    return {
      host: parsed.hostname || 'localhost',
      port: parsed.port ? parseInt(parsed.port, 10) : 6379,
      username: parsed.username || undefined,
      password: parsed.password || undefined,
      // Substring(1) strips the leading '/' from pathname, e.g. '/0' -> '0'
      db: parsed.pathname ? parseInt(parsed.pathname.substring(1) || '0', 10) : 0,
      tls: parsed.protocol === 'rediss:' ? {} : undefined,
    };
  } catch (error) {
    console.error('[Queue] Invalid REDIS_URL provided. Falling back to default localhost.', error);
    return {
      host: 'localhost',
      port: 6379
    };
  }
}
