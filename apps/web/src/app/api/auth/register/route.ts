import { NextResponse } from 'next/server';
import { pool } from '@lumino/db';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Invalid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parseResult = registerSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { name, email, password } = parseResult.data;

    // Check if tenant already exists
    const checkRes = await pool.query(
      'SELECT id FROM tenants WHERE email = $1',
      [email]
    );

    if (checkRes.rows.length > 0) {
      return NextResponse.json(
        { error: 'Email already registered.' },
        { status: 400 }
      );
    }

    // Hash the password using bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save user/tenant
    const insertRes = await pool.query(
      'INSERT INTO tenants (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, hashedPassword]
    );

    const newTenant = insertRes.rows[0];

    // Seed an initial dummy site so the tenant has something to see on first login
    await pool.query(
      'INSERT INTO sites (tenant_id, domain) VALUES ($1, $2)',
      [newTenant.id, 'example.com']
    );

    return NextResponse.json(
      { message: 'Tenant registered successfully.', tenant: newTenant },
      { status: 201 }
    );

  } catch (err) {
    console.error('[Register API] Error registering tenant:', err);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
