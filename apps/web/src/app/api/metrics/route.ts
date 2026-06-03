import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { pool } from '@lumino/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = session.user.id;

  // Extract siteId from query params
  const { searchParams } = new URL(req.url);
  let siteId = searchParams.get('siteId');

  try {
    // If no siteId is provided, default to the first site registered for this tenant
    if (!siteId) {
      const siteRes = await pool.query(
        'SELECT id FROM sites WHERE tenant_id = $1 ORDER BY domain ASC LIMIT 1',
        [tenantId]
      );
      if (siteRes.rows.length === 0) {
        return NextResponse.json({
          metrics: { pageviewsToday: 0, uniquePages: 0, topReferrer: 'None', topDevice: 'None' },
          history: [],
          topPages: [],
          devices: [],
          countries: [],
          noSites: true
        });
      }
      siteId = siteRes.rows[0].id;
    }

    // Security check: Ensure this siteId belongs to the authenticated tenant
    const authCheck = await pool.query(
      'SELECT id FROM sites WHERE id = $1 AND tenant_id = $2',
      [siteId, tenantId]
    );

    if (authCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Execute queries in parallel for fast response times
    const [
      viewsTodayRes,
      uniquePagesRes,
      topReferrerRes,
      topDeviceRes,
      historyRes,
      topPagesRes,
      devicesRes,
      countriesRes,
    ] = await Promise.all([
      // Page views today
      pool.query(
        'SELECT COUNT(*)::int as count FROM events WHERE tenant_id = $1 AND site_id = $2 AND ts >= CURRENT_DATE',
        [tenantId, siteId]
      ),
      // Unique page paths
      pool.query(
        'SELECT COUNT(DISTINCT page)::int as count FROM events WHERE tenant_id = $1 AND site_id = $2',
        [tenantId, siteId]
      ),
      // Top referrer
      pool.query(
        `SELECT referrer, COUNT(*)::int as count FROM events 
         WHERE tenant_id = $1 AND site_id = $2 AND referrer IS NOT NULL AND referrer != ''
         GROUP BY referrer ORDER BY count DESC LIMIT 1`,
        [tenantId, siteId]
      ),
      // Top device type
      pool.query(
        'SELECT device, COUNT(*)::int as count FROM events WHERE tenant_id = $1 AND site_id = $2 GROUP BY device ORDER BY count DESC LIMIT 1',
        [tenantId, siteId]
      ),
      // History of page views over last 30 days
      pool.query(
        `SELECT gs.day::date as date, COALESCE(COUNT(e.id), 0)::int as views
         FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, '1 day'::interval) gs(day)
         LEFT JOIN events e ON e.ts::date = gs.day::date AND e.tenant_id = $1 AND e.site_id = $2
         GROUP BY gs.day ORDER BY gs.day ASC`,
        [tenantId, siteId]
      ),
      // Top 10 page paths over last 7 days
      pool.query(
        `SELECT page, COUNT(*)::int as views FROM events 
         WHERE tenant_id = $1 AND site_id = $2 AND ts >= NOW() - INTERVAL '7 days'
         GROUP BY page ORDER BY views DESC LIMIT 10`,
        [tenantId, siteId]
      ),
      // Device breakdown
      pool.query(
        'SELECT device, COUNT(*)::int as count FROM events WHERE tenant_id = $1 AND site_id = $2 GROUP BY device',
        [tenantId, siteId]
      ),
      // Country distribution
      pool.query(
        'SELECT country, COUNT(*)::int as count FROM events WHERE tenant_id = $1 AND site_id = $2 AND country IS NOT NULL GROUP BY country',
        [tenantId, siteId]
      ),
    ]);

    const pageviewsToday = viewsTodayRes.rows[0]?.count || 0;
    const uniquePages = uniquePagesRes.rows[0]?.count || 0;
    const topReferrer = topReferrerRes.rows[0]?.referrer || 'None';
    const topDevice = topDeviceRes.rows[0]?.device || 'None';

    return NextResponse.json({
      metrics: {
        pageviewsToday,
        uniquePages,
        topReferrer,
        topDevice,
      },
      history: historyRes.rows.map((row) => ({
        // Format date string to keep it clean (e.g., "YYYY-MM-DD" or similar)
        date: new Date(row.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        views: row.views,
      })),
      topPages: topPagesRes.rows,
      devices: devicesRes.rows,
      countries: countriesRes.rows,
      activeSiteId: siteId
    });

  } catch (err) {
    console.error('[Metrics API] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
