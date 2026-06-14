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

    // ── P0-6: MarketplaceOrder ──────────────────────────────────────────────

    const orderCheck = await db.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'MarketplaceOrder'
      ) AS exists
    `

    if (!orderCheck[0]?.exists) {
      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          CREATE TYPE "MarketplaceOrderStatus" AS ENUM ('PENDING', 'CANCELLED', 'REJECTED');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `)

      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "MarketplaceOrder" (
          "id"                  TEXT                     NOT NULL,
          "listingId"           TEXT                     NOT NULL,
          "assetId"             TEXT                     NOT NULL,
          "buyerId"             TEXT                     NOT NULL,
          "sellerId"            TEXT                     NOT NULL,
          "priceCredits"        INTEGER                  NOT NULL,
          "platformFeeCredits"  INTEGER,
          "sellerAmountCredits" INTEGER,
          "status"              "MarketplaceOrderStatus" NOT NULL DEFAULT 'PENDING',
          "message"             TEXT,
          "failureReason"       TEXT,
          "metadataJson"        JSONB,
          "createdAt"           TIMESTAMP(3)             NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt"           TIMESTAMP(3)             NOT NULL,
          "cancelledAt"         TIMESTAMP(3),
          "rejectedAt"          TIMESTAMP(3),
          CONSTRAINT "MarketplaceOrder_pkey" PRIMARY KEY ("id")
        )
      `)

      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MarketplaceOrder_listingId_idx" ON "MarketplaceOrder"("listingId")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MarketplaceOrder_assetId_idx"   ON "MarketplaceOrder"("assetId")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MarketplaceOrder_buyerId_idx"   ON "MarketplaceOrder"("buyerId")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MarketplaceOrder_sellerId_idx"  ON "MarketplaceOrder"("sellerId")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MarketplaceOrder_status_idx"    ON "MarketplaceOrder"("status")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MarketplaceOrder_createdAt_idx" ON "MarketplaceOrder"("createdAt")`)

      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_listingId_fkey"
            FOREIGN KEY ("listingId") REFERENCES "AssetListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `)
      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_buyerId_fkey"
            FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `)
      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_sellerId_fkey"
            FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `)
      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_assetId_fkey"
            FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `)

      console.log('[startup] MarketplaceOrder migration applied')
    }

    // ── P0-9: MarketplaceOrder QUOTED state ────────────────────────────────
    // ALTER TYPE ADD VALUE cannot run inside a transaction block; run unconditionally.
    await db.$executeRawUnsafe(`ALTER TYPE "MarketplaceOrderStatus" ADD VALUE IF NOT EXISTS 'QUOTED'`)
    await db.$executeRawUnsafe(`ALTER TABLE "MarketplaceOrder" ADD COLUMN IF NOT EXISTS "quotedAt" TIMESTAMP(3)`)
    console.log('[startup] MarketplaceOrder QUOTED migration checked')

    // ── P1-0: Marketplace Settlement v1 ────────────────────────────────────
    await db.$executeRawUnsafe(`ALTER TYPE "MarketplaceOrderStatus" ADD VALUE IF NOT EXISTS 'COMPLETED'`)
    await db.$executeRawUnsafe(`ALTER TABLE "MarketplaceOrder" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3)`)
    await db.$executeRawUnsafe(`ALTER TYPE "CreditLedgerType" ADD VALUE IF NOT EXISTS 'MARKETPLACE_PURCHASE'`)
    await db.$executeRawUnsafe(`ALTER TYPE "CreditLedgerType" ADD VALUE IF NOT EXISTS 'MARKETPLACE_SELLER_CREDIT'`)
    console.log('[startup] Marketplace Settlement v1 migration checked')

    // ── P1-2: Marketplace Refund Execution ─────────────────────────────────
    await db.$executeRawUnsafe(`ALTER TYPE "MarketplaceOrderStatus"            ADD VALUE IF NOT EXISTS 'REFUNDED'`)
    await db.$executeRawUnsafe(`ALTER TYPE "CreditLedgerType"                  ADD VALUE IF NOT EXISTS 'MARKETPLACE_REFUND'`)
    await db.$executeRawUnsafe(`ALTER TYPE "CreditLedgerType"                  ADD VALUE IF NOT EXISTS 'MARKETPLACE_SELLER_REVERSAL'`)
    await db.$executeRawUnsafe(`ALTER TYPE "MarketplaceRefundRequestStatus"    ADD VALUE IF NOT EXISTS 'EXECUTED'`)
    await db.$executeRawUnsafe(`ALTER TYPE "MarketplaceRefundRequestStatus"    ADD VALUE IF NOT EXISTS 'EXECUTION_FAILED'`)
    await db.$executeRawUnsafe(`ALTER TABLE "MarketplaceOrder"          ADD COLUMN IF NOT EXISTS "refundedAt"    TIMESTAMP(3)`)
    await db.$executeRawUnsafe(`ALTER TABLE "MarketplaceRefundRequest"  ADD COLUMN IF NOT EXISTS "executedAt"   TIMESTAMP(3)`)
    await db.$executeRawUnsafe(`ALTER TABLE "MarketplaceRefundRequest"  ADD COLUMN IF NOT EXISTS "executionNote" TEXT`)
    console.log('[startup] Marketplace Refund Execution migration checked')

    // ── P1-1: MarketplaceRefundRequest ─────────────────────────────────────
    const refundReqCheck = await db.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'MarketplaceRefundRequest'
      ) AS exists
    `
    if (!refundReqCheck[0]?.exists) {
      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          CREATE TYPE "MarketplaceRefundRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `)
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "MarketplaceRefundRequest" (
          "id"         TEXT                             NOT NULL,
          "orderId"    TEXT                             NOT NULL,
          "buyerId"    TEXT                             NOT NULL,
          "sellerId"   TEXT                             NOT NULL,
          "assetId"    TEXT                             NOT NULL,
          "status"     "MarketplaceRefundRequestStatus" NOT NULL DEFAULT 'PENDING',
          "reason"     TEXT                             NOT NULL,
          "adminNote"  TEXT,
          "createdAt"  TIMESTAMP(3)                     NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "reviewedAt" TIMESTAMP(3),
          CONSTRAINT "MarketplaceRefundRequest_pkey" PRIMARY KEY ("id")
        )
      `)
      await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceRefundRequest_orderId_key"   ON "MarketplaceRefundRequest"("orderId")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MarketplaceRefundRequest_buyerId_idx"          ON "MarketplaceRefundRequest"("buyerId")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MarketplaceRefundRequest_sellerId_idx"         ON "MarketplaceRefundRequest"("sellerId")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MarketplaceRefundRequest_status_idx"           ON "MarketplaceRefundRequest"("status")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MarketplaceRefundRequest_createdAt_idx"        ON "MarketplaceRefundRequest"("createdAt")`)
      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          ALTER TABLE "MarketplaceRefundRequest" ADD CONSTRAINT "MarketplaceRefundRequest_orderId_fkey"
            FOREIGN KEY ("orderId") REFERENCES "MarketplaceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `)
      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          ALTER TABLE "MarketplaceRefundRequest" ADD CONSTRAINT "MarketplaceRefundRequest_buyerId_fkey"
            FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `)
      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          ALTER TABLE "MarketplaceRefundRequest" ADD CONSTRAINT "MarketplaceRefundRequest_sellerId_fkey"
            FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `)
      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          ALTER TABLE "MarketplaceRefundRequest" ADD CONSTRAINT "MarketplaceRefundRequest_assetId_fkey"
            FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `)
      console.log('[startup] MarketplaceRefundRequest migration applied')
    }

    // ── P1-4B: UserMembership + MembershipOrder ─────────────────────────────
    const membershipCheck = await db.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'UserMembership'
      ) AS exists
    `

    if (!membershipCheck[0]?.exists) {
      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          CREATE TYPE "MembershipStatus" AS ENUM ('INACTIVE', 'ACTIVE', 'EXPIRED', 'SUSPENDED');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `)

      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          CREATE TYPE "MembershipOrderStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `)

      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "UserMembership" (
          "id"            TEXT                NOT NULL,
          "userId"        TEXT                NOT NULL,
          "status"        "MembershipStatus"  NOT NULL DEFAULT 'INACTIVE',
          "planCode"      TEXT                NOT NULL DEFAULT 'pro_monthly_cny100',
          "startsAt"      TIMESTAMP(3),
          "expiresAt"     TIMESTAMP(3),
          "sourceOrderId" TEXT,
          "adminNote"     TEXT,
          "createdAt"     TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt"     TIMESTAMP(3)        NOT NULL,
          CONSTRAINT "UserMembership_pkey" PRIMARY KEY ("id")
        )
      `)

      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "MembershipOrder" (
          "id"           TEXT                     NOT NULL,
          "userId"       TEXT                     NOT NULL,
          "planCode"     TEXT                     NOT NULL DEFAULT 'pro_monthly_cny100',
          "amountCny"    INTEGER                  NOT NULL DEFAULT 10000,
          "periodMonths" INTEGER                  NOT NULL DEFAULT 1,
          "status"       "MembershipOrderStatus"  NOT NULL DEFAULT 'PENDING',
          "voucherNote"  TEXT,
          "adminUserId"  TEXT,
          "adminNote"    TEXT,
          "createdAt"    TIMESTAMP(3)             NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt"    TIMESTAMP(3)             NOT NULL,
          CONSTRAINT "MembershipOrder_pkey" PRIMARY KEY ("id")
        )
      `)

      await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "UserMembership_userId_key"  ON "UserMembership"("userId")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MembershipOrder_userId_idx"        ON "MembershipOrder"("userId")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MembershipOrder_status_idx"        ON "MembershipOrder"("status")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MembershipOrder_createdAt_idx"     ON "MembershipOrder"("createdAt")`)

      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          ALTER TABLE "UserMembership" ADD CONSTRAINT "UserMembership_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `)

      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          ALTER TABLE "MembershipOrder" ADD CONSTRAINT "MembershipOrder_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `)

      console.log('[startup] UserMembership + MembershipOrder migration applied')
    }
  } catch (err) {
    // Never crash the server due to migration errors — log and continue.
    console.error('[startup] migration check failed:', err)
  }
}
