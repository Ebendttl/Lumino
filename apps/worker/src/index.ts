import { pool, runMigrations } from '@lumino/db';
import { QUEUE_NAME, getRedisConnection, TrackEventJobPayload } from '@lumino/queue';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { anonymizeIp } from './ip-anonymizer';
import { initGeoReader, lookupGeo } from './geo-lookup';

async function main() {
  console.log('[Worker] Starting up...');

  // 1. Run migrations before starting worker consumption
  try {
    await runMigrations();
  } catch (err) {
    console.error('[Worker] Migration failed. Exiting.', err);
    process.exit(1);
  }

  // 2. Initialize GeoIP database
  await initGeoReader();

  // 3. Connect Redis publisher for real-time live feed
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const publisher = new Redis(redisUrl);
  publisher.on('error', (err) => {
    console.error('[Worker] Redis Publisher connection error:', err);
  });

  // 4. Create and start BullMQ worker
  const workerConnection = getRedisConnection();
  
  const worker = new Worker<TrackEventJobPayload>(
    QUEUE_NAME,
    async (job) => {
      const { siteId, tenantId, page, referrer, device, ts, ip } = job.data;
      
      try {
        // Strip IP before geo lookup or persistence for strict privacy
        const anonymizedIp = anonymizeIp(ip);
        
        // Resolve country and city using local MMDB database
        const { country, city } = lookupGeo(anonymizedIp);

        // Save event to database. Scoped strictly to tenant_id
        await pool.query(
          `INSERT INTO events (tenant_id, site_id, page, referrer, device, country, city, ts)
           VALUES ($1, $2, $3, $4, $5, $6, $7, to_timestamp($8 / 1000.0))`,
          [tenantId, siteId, page, referrer, device, country, city, ts]
        );

        // Publish to Redis Pub/Sub for live feed propagation
        await publisher.publish(
          `rt:${tenantId}`,
          JSON.stringify({
            page,
            device,
            country,
            city,
            ts
          })
        );
      } catch (err) {
        console.error(`[Worker] Error processing job ${job.id}:`, err);
        throw err;
      }
    },
    {
      connection: workerConnection,
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || '10', 10),
    }
  );

  worker.on('active', (job) => {
    console.log(`[Worker] Job ${job.id} started processing.`);
  });

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed.`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed with error:`, err);
  });

  console.log('[Worker] Worker initialized and listening to events queue.');

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[Worker] Shutting down gracefully...');
    await worker.close();
    await publisher.quit();
    await pool.end();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[Worker] Fatal error in main process:', err);
  process.exit(1);
});
