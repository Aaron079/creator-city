// Runs once on Next.js server startup (per cold-start instance).
// Applies P0-4 (AssetListing) and P0-5 (LicenseGrant) migrations via raw SQL
// so that prisma migrate deploy is never required at Vercel build time.
// All statements are idempotent (IF NOT EXISTS / DO…EXCEPTION).

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  try {
    const { db } = await import('@/lib/db')

    // ── P0-4: AssetListing ──────────────────────────────────────────────────

    const listingCheck = await db.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'AssetListing'
      ) AS exists
    `

    if (!listingCheck[0]?.exists) {
      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          CREATE TYPE "AssetListingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `)

      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "AssetListing" (
          "id"                          TEXT                 NOT NULL,
          "assetId"                     TEXT                 NOT NULL,
          "sellerId"                    TEXT                 NOT NULL,
          "status"                      "AssetListingStatus" NOT NULL DEFAULT 'DRAFT',
          "licenseMode"                 TEXT                 NOT NULL,
          "priceCredits"                INTEGER,
          "title"                       TEXT,
          "description"                 TEXT,
          "commercialUse"               BOOLEAN              NOT NULL DEFAULT false,
          "derivativeAllowed"           BOOLEAN              NOT NULL DEFAULT false,
          "attributionRequired"         BOOLEAN              NOT NULL DEFAULT true,
          "sourceMarketplaceIntentJson" JSONB,
          "createdAt"                   TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt"                   TIMESTAMP(3)         NOT NULL,
          "publishedAt"                 TIMESTAMP(3),
          CONSTRAINT "AssetListing_pkey" PRIMARY KEY ("id")
        )
      `)

      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AssetListing_assetId_idx"     ON "AssetListing"("assetId")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AssetListing_sellerId_idx"    ON "AssetListing"("sellerId")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AssetListing_status_idx"      ON "AssetListing"("status")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AssetListing_createdAt_idx"   ON "AssetListing"("createdAt")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AssetListing_publishedAt_idx" ON "AssetListing"("publishedAt")`)

      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          ALTER TABLE "AssetListing" ADD CONSTRAINT "AssetListing_assetId_fkey"
            FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `)
      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          ALTER TABLE "AssetListing" ADD CONSTRAINT "AssetListing_sellerId_fkey"
            FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `)

      console.log('[startup] AssetListing migration applied')
    }

    // ── P0-5: LicenseGrant ──────────────────────────────────────────────────

    const grantCheck = await db.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'LicenseGrant'
      ) AS exists
    `

    if (!grantCheck[0]?.exists) {
      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          CREATE TYPE "LicenseGrantStatus" AS ENUM ('ACTIVE', 'REVOKED');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `)

      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "LicenseGrant" (
          "id"          TEXT                 NOT NULL,
          "listingId"   TEXT                 NOT NULL,
          "buyerId"     TEXT                 NOT NULL,
          "sellerId"    TEXT                 NOT NULL,
          "assetId"     TEXT                 NOT NULL,
          "licenseMode" TEXT                 NOT NULL,
          "paidCredits" INTEGER              NOT NULL DEFAULT 0,
          "status"      "LicenseGrantStatus" NOT NULL DEFAULT 'ACTIVE',
          "grantedAt"   TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "expiresAt"   TIMESTAMP(3),
          "revokedAt"   TIMESTAMP(3),
          "termsJson"   JSONB,
          CONSTRAINT "LicenseGrant_pkey" PRIMARY KEY ("id")
        )
      `)

      await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "LicenseGrant_listingId_buyerId_key" ON "LicenseGrant"("listingId", "buyerId")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LicenseGrant_buyerId_idx"   ON "LicenseGrant"("buyerId")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LicenseGrant_sellerId_idx"  ON "LicenseGrant"("sellerId")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LicenseGrant_assetId_idx"   ON "LicenseGrant"("assetId")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LicenseGrant_listingId_idx" ON "LicenseGrant"("listingId")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LicenseGrant_status_idx"    ON "LicenseGrant"("status")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LicenseGrant_grantedAt_idx" ON "LicenseGrant"("grantedAt")`)

      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          ALTER TABLE "LicenseGrant" ADD CONSTRAINT "LicenseGrant_listingId_fkey"
            FOREIGN KEY ("listingId") REFERENCES "AssetListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `)
      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          ALTER TABLE "LicenseGrant" ADD CONSTRAINT "LicenseGrant_buyerId_fkey"
            FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `)
      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          ALTER TABLE "LicenseGrant" ADD CONSTRAINT "LicenseGrant_sellerId_fkey"
            FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `)
      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          ALTER TABLE "LicenseGrant" ADD CONSTRAINT "LicenseGrant_assetId_fkey"
            FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `)

      console.log('[startup] LicenseGrant migration applied')
    }
  } catch (err) {
    // Never crash the server due to migration errors — log and continue.
    console.error('[startup] migration check failed:', err)
  }
}
