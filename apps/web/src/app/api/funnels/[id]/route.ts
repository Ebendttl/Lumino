import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { pool } from '@lumino/db';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = session.user.id;
  const funnelId = params.id;

  // Extract siteId from query params
  const { searchParams } = new URL(req.url);
  let siteId = searchParams.get('siteId');

  try {
    // 1. Fetch and verify ownership of the funnel
    const funnelRes = await pool.query(
      'SELECT id, name, steps FROM funnels WHERE id = $1 AND tenant_id = $2',
      [funnelId, tenantId]
    );

    if (funnelRes.rows.length === 0) {
      return NextResponse.json({ error: 'Funnel not found' }, { status: 404 });
    }

    const funnel = funnelRes.rows[0];
    const steps: string[] = funnel.steps;

    // 2. Resolve active site if not provided
    if (!siteId) {
      const siteRes = await pool.query(
        'SELECT id FROM sites WHERE tenant_id = $1 ORDER BY domain ASC LIMIT 1',
        [tenantId]
      );
      if (siteRes.rows.length === 0) {
        return NextResponse.json({ error: 'No sites found' }, { status: 404 });
      }
      siteId = siteRes.rows[0].id;
    }

    // 3. Security check: Ensure site belongs to tenant
    const siteCheck = await pool.query(
      'SELECT id FROM sites WHERE id = $1 AND tenant_id = $2',
      [siteId, tenantId]
    );
    if (siteCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 4. Query pageview counts for each step in the last 30 days
    const counts = await Promise.all(
      steps.map(async (pagePath) => {
        const res = await pool.query(
          `SELECT COUNT(*)::int as count FROM events 
           WHERE tenant_id = $1 AND site_id = $2 AND page = $3 AND ts >= NOW() - INTERVAL '30 days'`,
          [tenantId, siteId, pagePath]
        );
        return res.rows[0]?.count || 0;
      })
    );

    // 5. Format conversion data for the frontend
    // We calculate:
    // - conversion: percentage of visitors compared to Step 1 (first step = 100%)
    // - dropRate: percentage of visitors lost from previous step
    let initialCount = counts[0] || 0;
    
    const data = steps.map((step, index) => {
      const count = counts[index];
      const previousCount = index > 0 ? counts[index - 1] : count;
      
      const overallConversion = initialCount > 0 ? Math.round((count / initialCount) * 100) : 0;
      const stepConversion = previousCount > 0 ? Math.round((count / previousCount) * 100) : 0;
      const dropRate = 100 - stepConversion;

      return {
        step: index + 1,
        path: step,
        count,
        overallConversion,
        stepConversion,
        dropRate: index === 0 ? 0 : dropRate
      };
    });

    // To make sure a funnel always represents a descending flow (since pageviews on step N might
    // logically be higher if users visit it directly), we adjust the counts to represent
    // a true funnel flow relative to the first step's entries (capped by previous step) if necessary.
    // However, showing the raw counts is also useful. Let's provide the raw stats and let the UI render them.
    return NextResponse.json({
      id: funnel.id,
      name: funnel.name,
      steps: data
    });

  } catch (err) {
    console.error('[Funnel Detail API] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
