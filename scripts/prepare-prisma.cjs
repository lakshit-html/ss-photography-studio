const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. Resolve DATABASE_URL from process.env or .env file
if (!process.env.DATABASE_URL) {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/^DATABASE_URL=["']?([^"'\r\n]+)["']?/m);
      if (match) {
        process.env.DATABASE_URL = match[1];
      }
    }
  } catch (e) {
    // ignore
  }
}

const dbUrl = process.env.DATABASE_URL || '';
const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

const isPostgres =
  dbUrl.startsWith('postgres://') ||
  dbUrl.startsWith('postgresql://') ||
  dbUrl.startsWith('prisma+postgres://');

if (isPostgres) {
  console.log('[Prisma Config] Detected PostgreSQL connection string.');
  console.log('[Prisma Config] Setting datasource provider to "postgresql"...');
  schema = schema.replace(/provider\s*=\s*"sqlite"/g, 'provider = "postgresql"');
} else {
  console.log('[Prisma Config] Detected SQLite connection string or local fallback.');
  console.log('[Prisma Config] Setting datasource provider to "sqlite"...');
  schema = schema.replace(/provider\s*=\s*"postgresql"/g, 'provider = "sqlite"');
}

fs.writeFileSync(schemaPath, schema, 'utf8');

// 2. Generate Prisma Client
console.log('[Prisma Config] Running prisma generate...');
try {
  execSync('npx prisma generate', { stdio: 'inherit', env: process.env });
} catch (err) {
  console.error('[Prisma Config] prisma generate failed:', err.message);
  process.exit(1);
}

// 3. If connected to PostgreSQL (Vercel / Supabase / Neon), sync the database schema
if (isPostgres) {
  console.log('[Prisma Config] Syncing PostgreSQL database schema (prisma db push)...');
  try {
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      stdio: 'inherit',
      env: process.env,
    });
    console.log('[Prisma Config] PostgreSQL schema synced successfully.');
  } catch (err) {
    console.warn('[Prisma Config] prisma db push notice:', err.message);
  }
}
