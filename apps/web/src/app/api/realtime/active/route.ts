import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { pool } from '@lumino/db';

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
    if (!siteId) {
      const siteRes = await pool.query(
        'SELECT id FROM sites WHERE tenant_id = $1 ORDER BY domain ASC LIMIT 1',
        [tenantId]
      );
      if (siteRes.rows.length === 0) {
        return NextResponse.json({ activeVisitors: 0 });
      }
      siteId = siteRes.rows[0].id;
    }

    // Security check
    const check = await pool.query(
      'SELECT id FROM sites WHERE id = $1 AND tenant_id = $2',
      [siteId, tenantId]
    );
    if (check.rows.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Count pageviews in the last 5 minutes as an approximation for active online visitors
    const result = await pool.query(
      `SELECT COUNT(*)::int as count FROM events 
       WHERE tenant_id = $1 AND site_id = $2 AND ts >= NOW() - INTERVAL '5 minutes'`,
      [tenantId, siteId]
    );

    const activeVisitors = result.rows[0]?.count || 0;

    return NextResponse.json({ activeVisitors });
  } catch (err) {
    console.error('[Realtime Active API] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
