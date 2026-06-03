import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { pool } from '@lumino/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const siteSchema = z.object({
  domain: z.string().min(3).regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Invalid domain format'),
});

// GET /api/sites - List all sites for logged in tenant
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = session.user.id;

  try {
    const result = await pool.query(
      'SELECT id, domain, api_key FROM sites WHERE tenant_id = $1 ORDER BY domain ASC',
      [tenantId]
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('[Sites API] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/sites - Create a new site for logged in tenant
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = session.user.id;

  try {
    const body = await req.json();
    const parseResult = siteSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid domain format', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { domain } = parseResult.data;

    // Create the site
    const result = await pool.query(
      'INSERT INTO sites (tenant_id, domain) VALUES ($1, $2) RETURNING id, domain, api_key',
      [tenantId, domain]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('[Sites API] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
