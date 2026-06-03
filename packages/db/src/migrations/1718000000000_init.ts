import { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Ensure pgcrypto is enabled for gen_random_uuid() just in case, though Pg 13+ includes it by default
  pgm.sql('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  // 1. Create tenants table (users of the dashboard)
  pgm.createTable('tenants', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name: { type: 'text', notNull: true },
    email: { type: 'text', notNull: true, unique: true },
    password: { type: 'text', notNull: true }, // bcrypt hashed password
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  // 2. Create sites table
  pgm.createTable('sites', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true, references: 'tenants(id)', onDelete: 'CASCADE' },
    domain: { type: 'text', notNull: true },
    api_key: { type: 'uuid', notNull: true, unique: true, default: pgm.func('gen_random_uuid()') },
  });

  // 3. Create events table
  pgm.createTable('events', {
    id: { type: 'bigserial', primaryKey: true },
    tenant_id: { type: 'uuid', notNull: true },
    site_id: { type: 'uuid', notNull: true, references: 'sites(id)', onDelete: 'CASCADE' },
    page: { type: 'text', notNull: true },
    referrer: { type: 'text' },
    device: { type: 'text', notNull: true },
    country: { type: 'char(2)' },
    city: { type: 'text' },
    ts: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  // Add check constraint for allowed device types
  pgm.addConstraint('events', 'events_device_check', {
    check: "device IN ('desktop', 'mobile', 'tablet', 'bot', 'unknown')"
  });

  // 4. Create funnels table (per-tenant funnels)
  pgm.createTable('funnels', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true, references: 'tenants(id)', onDelete: 'CASCADE' },
    name: { type: 'text', notNull: true },
    steps: { type: 'text[]', notNull: true }, // Ordered array of paths (up to 5)
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  // 5. Indices for query optimization
  pgm.createIndex('events', ['tenant_id', { name: 'ts', sort: 'DESC' }]);
  pgm.createIndex('events', ['site_id', { name: 'ts', sort: 'DESC' }]);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('funnels');
  pgm.dropTable('events');
  pgm.dropTable('sites');
  pgm.dropTable('tenants');
}
