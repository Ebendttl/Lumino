import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { pool } from '@lumino/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const funnelSchema = z.object({
  name: z.string().min(2, 'Funnel name must be at least 2 characters.'),
  steps: z.array(z.string().min(1)).min(2, 'Funnels must have at least 2 steps.').max(5, 'Funnels can have at most 5 steps.'),
});

// GET /api/funnels - Get all funnels for the tenant
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = session.user.id;

  try {
    const result = await pool.query(
      'SELECT id, name, steps, created_at FROM funnels WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantId]
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('[Funnels API] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/funnels - Create a new funnel for the tenant
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = session.user.id;

  try {
    const body = await req.json();
    const parseResult = funnelSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { name, steps } = parseResult.data;

    const result = await pool.query(
      'INSERT INTO funnels (tenant_id, name, steps) VALUES ($1, $2, $3) RETURNING id, name, steps, created_at',
      [tenantId, name, steps]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('[Funnels API] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
