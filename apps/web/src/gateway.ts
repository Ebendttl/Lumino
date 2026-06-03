import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import Redis from 'ioredis';
import { Queue } from 'bullmq';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { z } from 'zod';
import * as cookie from 'cookie';
import { decode } from 'next-auth/jwt';
import { pool } from '@lumino/db';
import { QUEUE_NAME, getRedisConnection } from '@lumino/queue';

const app = express();
app.use(express.json());

// Enable trust proxy for obtaining client IP addresses when behind a load balancer (Nginx/Cloudflare)
app.set('trust proxy', true);

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl);
redis.on('error', (err) => {
  console.error('[Gateway] Redis Client error:', err);
});

// BullMQ Queue instance
const eventsQueue = new Queue(QUEUE_NAME, {
  connection: getRedisConnection(),
});

// Rate limiter: Max 500 requests per 10 seconds per siteId
const rateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl_collect',
  points: 500,
  duration: 10,
});

// Zod schema matching tracking script payload
const collectSchema = z.object({
  siteId: z.string().uuid(),
  page: z.string().min(1),
  referrer: z.string().nullable(),
  device: z.enum(['desktop', 'mobile', 'tablet', 'bot', 'unknown']),
  ts: z.number().int(),
});

interface ResolvedSite {
  id: string;
  tenantId: string;
}

/**
 * Resolves siteId to actual database site.id and tenant_id.
 * Caches mapping in Redis to avoid hitting PostgreSQL on the hot path.
 */
async function resolveSite(siteId: string): Promise<ResolvedSite | null> {
  const cacheKey = `site_res:${siteId}`;
  
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    console.error('[Gateway] Redis cache read error:', err);
  }

  try {
    const result = await pool.query(
      'SELECT id, tenant_id FROM sites WHERE api_key = $1 OR id = $1',
      [siteId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const resolved: ResolvedSite = {
      id: result.rows[0].id,
      tenantId: result.rows[0].tenant_id,
    };

    // Cache in Redis for 1 hour
    await redis.set(cacheKey, JSON.stringify(resolved), 'EX', 3600);
    return resolved;
  } catch (err) {
    console.error('[Gateway] PostgreSQL query error during site resolution:', err);
    return null;
  }
}

// Ingestion API Route
app.post('/collect', async (req, res) => {
  try {
    const parseResult = collectSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: 'Invalid payload', 
        details: parseResult.error.format() 
      });
    }

    const payload = parseResult.data;

    // Apply Rate Limiting
    try {
      await rateLimiter.consume(payload.siteId);
    } catch (rej) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded. Maximum 500 requests per 10 seconds.' 
      });
    }

    // Resolve site & tenant mapping (with Redis cache)
    const siteInfo = await resolveSite(payload.siteId);
    if (!siteInfo) {
      return res.status(404).json({ error: 'Site or API key not found.' });
    }

    // Return 202 Accepted immediately to prevent blocking the client website
    res.status(202).send('Accepted');

    // Asynchronously push to BullMQ queue
    const rawIp = req.ip || req.headers['x-forwarded-for'] || '0.0.0.0';
    const clientIp = Array.isArray(rawIp) ? rawIp[0] : rawIp;
    const userAgent = req.headers['user-agent'] || '';

    eventsQueue.add('track-event', {
      siteId: siteInfo.id,
      tenantId: siteInfo.tenantId,
      page: payload.page,
      referrer: payload.referrer,
      device: payload.device,
      ts: payload.ts,
      ip: clientIp,
      userAgent,
    }).catch((err) => {
      console.error('[Gateway] Failed to add event to BullMQ:', err);
    });

  } catch (err) {
    console.error('[Gateway] Ingestion handler error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error.' });
    }
  }
});

// Privacy Policy Endpoint
app.get('/privacy', (req, res) => {
  res.json({
    platform: 'Lumino Web Analytics',
    privacy_policy: {
      cookie_usage: 'Lumino is cookie-free. No cookies or local storage elements are utilized for tracking.',
      ip_addresses: 'All IP addresses are anonymized at ingestion time (last octet for IPv4, last 80 bits for IPv6). We do not store raw IP addresses.',
      fingerprinting: 'No browser fingerprinting or tracking graphs are created.',
      pii: 'Personally Identifiable Information (PII) is not persisted in the database.',
      respect_dnt: 'We respect Do Not Track (DNT) headers. If a client sets DNT, no data is recorded.',
      data_isolation: 'All client dashboard views, event stores, and conversion funnels are fully isolated on a per-tenant basis.'
    }
  });
});

const server = createServer(app);

// Standalone WebSocket server
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws: WebSocket, req, tenantId: string) => {
  console.log(`[WS] Client connected for tenant: ${tenantId}`);

  // Open a dedicated subscriber client for this websocket connection
  const subscriber = new Redis(redisUrl);

  subscriber.subscribe(`rt:${tenantId}`, (err) => {
    if (err) {
      console.error(`[WS] Redis subscribe failed for tenant rt:${tenantId}`, err);
    }
  });

  subscriber.on('message', (channel, message) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });

  ws.on('close', () => {
    console.log(`[WS] Client disconnected for tenant: ${tenantId}`);
    subscriber.quit().catch(() => {});
  });

  ws.on('error', (err) => {
    console.error(`[WS] Connection error:`, err);
    subscriber.quit().catch(() => {});
  });
});

// Handle WebSocket upgrade verification
server.on('upgrade', async (req, socket, head) => {
  try {
    const cookies = cookie.parse(req.headers.cookie || '');
    const sessionToken = cookies['authjs.session-token'] || 
                         cookies['__Secure-authjs.session-token'] || 
                         cookies['next-auth.session-token'] || 
                         cookies['__Secure-next-auth.session-token'];

    if (!sessionToken) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error('[WS] NEXTAUTH_SECRET is not set in environment variables.');
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
      return;
    }

    // Decode session token to verify user and retrieve tenant_id
    const decoded = await decode({
      token: sessionToken,
      secret,
    });

    const tenantId = decoded?.id || decoded?.sub;

    if (!tenantId) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    // Upgrade connection
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, tenantId);
    });
  } catch (err) {
    console.error('[WS] WebSocket Upgrade error:', err);
    socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
    socket.destroy();
  }
});

const PORT = process.env.GATEWAY_PORT || 3001;
server.listen(PORT, () => {
  console.log(`[Gateway] Ingestion API and WebSocket server listening on port ${PORT}`);
});
