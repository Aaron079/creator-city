// Runs once on Next.js server startup (per cold-start instance).
// Applies incremental schema migrations via raw SQL so that
// `prisma migrate deploy` is never required at Vercel build time.
// All statements are idempotent (IF NOT EXISTS / DO…EXCEPTION).

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  try {
    const { db } = await import('@/lib/db')

    // Single round-trip to check all migration state.
    // Previously 7 separate SELECT EXISTS queries (serial, ~700 ms each under load).
    // Now 1 query — 7× fewer DB calls on every cold start.
    const stateRows = await db.$queryRaw<Array<{
      has_asset_listing: boolean
      has_license_grant: boolean
      has_marketplace_order: boolean
      has_refund_request: boolean
      has_membership: boolean
      has_inquiry: boolean
      has_execution_note: boolean
    }>>`
      SELECT
        EXISTS (SELECT 1 FROM information_schema.tables  WHERE table_schema = 'public' AND table_name = 'AssetListing')             AS has_asset_listing,
        EXISTS (SELECT 1 FROM information_schema.tables  WHERE table_schema = 'public' AND table_name = 'LicenseGrant')             AS has_license_grant,
        EXISTS (SELECT 1 FROM information_schema.tables  WHERE table_schema = 'public' AND table_name = 'MarketplaceOrder')         AS has_marketplace_order,
        EXISTS (SELECT 1 FROM information_schema.tables  WHERE table_schema = 'public' AND table_name = 'MarketplaceRefundRequest') AS has_refund_request,
        EXISTS (SELECT 1 FROM information_schema.tables  WHERE table_schema = 'public' AND table_name = 'UserMembership')           AS has_membership,
        EXISTS (SELECT 1 FROM information_schema.tables  WHERE table_schema = 'public' AND table_name = 'MarketplaceInquiry')       AS has_inquiry,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'MarketplaceRefundRequest' AND column_name = 'executionNote'
        )                                                                                                                           AS has_execution_note
    `
    // SELECT always returns exactly 1 row; fallback to all-false for type safety.
    const state = stateRows[0] ?? {
      has_asset_listing: false,
      has_license_grant: false,
      has_marketplace_order: false,
      has_refund_request: false,
      has_membership: false,
      has_inquiry: false,
      has_execution_note: false,
    }

    // In production (all migrations applied): all flags true → 0 additional DB calls.
    console.log('[startup] migration state:', state)

    // ── P0-4: AssetListing ──────────────────────────────────────────────────
    if (!state.has_asset_listing) {
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
    if (!state.has_license_grant) {
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
    if (!state.has_marketplace_order) {
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

    // ── P0-9 / P1-0 / P1-2: incremental column + enum migrations ──────────
    // ALTER TYPE ADD VALUE cannot run inside a transaction block.
    // Guarded by has_execution_note (last column added in this batch).
    // In production: already applied → 0 extra queries.
    if (!state.has_execution_note) {
      // Only run ALTER TABLE on MarketplaceRefundRequest if the table exists
      // (it may be created by the P1-1 block below if brand-new environment).
      await db.$executeRawUnsafe(`ALTER TYPE "MarketplaceOrderStatus" ADD VALUE IF NOT EXISTS 'QUOTED'`)
      await db.$executeRawUnsafe(`ALTER TABLE "MarketplaceOrder" ADD COLUMN IF NOT EXISTS "quotedAt" TIMESTAMP(3)`)
      await db.$executeRawUnsafe(`ALTER TYPE "MarketplaceOrderStatus" ADD VALUE IF NOT EXISTS 'COMPLETED'`)
      await db.$executeRawUnsafe(`ALTER TABLE "MarketplaceOrder" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3)`)
      await db.$executeRawUnsafe(`ALTER TYPE "CreditLedgerType" ADD VALUE IF NOT EXISTS 'MARKETPLACE_PURCHASE'`)
      await db.$executeRawUnsafe(`ALTER TYPE "CreditLedgerType" ADD VALUE IF NOT EXISTS 'MARKETPLACE_SELLER_CREDIT'`)
      await db.$executeRawUnsafe(`ALTER TYPE "MarketplaceOrderStatus"            ADD VALUE IF NOT EXISTS 'REFUNDED'`)
      await db.$executeRawUnsafe(`ALTER TYPE "CreditLedgerType"                  ADD VALUE IF NOT EXISTS 'MARKETPLACE_REFUND'`)
      await db.$executeRawUnsafe(`ALTER TYPE "CreditLedgerType"                  ADD VALUE IF NOT EXISTS 'MARKETPLACE_SELLER_REVERSAL'`)
      await db.$executeRawUnsafe(`ALTER TYPE "MarketplaceRefundRequestStatus"    ADD VALUE IF NOT EXISTS 'EXECUTED'`)
      await db.$executeRawUnsafe(`ALTER TYPE "MarketplaceRefundRequestStatus"    ADD VALUE IF NOT EXISTS 'EXECUTION_FAILED'`)
      await db.$executeRawUnsafe(`ALTER TABLE "MarketplaceOrder"          ADD COLUMN IF NOT EXISTS "refundedAt"    TIMESTAMP(3)`)
      if (state.has_refund_request) {
        await db.$executeRawUnsafe(`ALTER TABLE "MarketplaceRefundRequest"  ADD COLUMN IF NOT EXISTS "executedAt"   TIMESTAMP(3)`)
        await db.$executeRawUnsafe(`ALTER TABLE "MarketplaceRefundRequest"  ADD COLUMN IF NOT EXISTS "executionNote" TEXT`)
      }
      console.log('[startup] incremental marketplace migrations applied (P0-9 / P1-0 / P1-2)')
    }

    // ── P1-1: MarketplaceRefundRequest ─────────────────────────────────────
    if (!state.has_refund_request) {
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
    if (!state.has_membership) {
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

    // ── P1-4D: MarketplaceInquiry ─────────────────────────────────────────────
    if (!state.has_inquiry) {
      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          CREATE TYPE "MarketplaceInquiryStatus" AS ENUM ('PENDING', 'RESPONDED', 'REJECTED', 'CLOSED');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `)

      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "MarketplaceInquiry" (
          "id"          TEXT                       NOT NULL,
          "listingId"   TEXT                       NOT NULL,
          "assetId"     TEXT                       NOT NULL,
          "buyerId"     TEXT                       NOT NULL,
          "sellerId"    TEXT                       NOT NULL,
          "status"      "MarketplaceInquiryStatus" NOT NULL DEFAULT 'PENDING',
          "message"     TEXT,
          "sellerNote"  TEXT,
          "createdAt"   TIMESTAMP(3)               NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt"   TIMESTAMP(3)               NOT NULL,
          "respondedAt" TIMESTAMP(3),
          "closedAt"    TIMESTAMP(3),
          CONSTRAINT "MarketplaceInquiry_pkey" PRIMARY KEY ("id")
        )
      `)

      await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceInquiry_listingId_buyerId_key" ON "MarketplaceInquiry"("listingId", "buyerId")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MarketplaceInquiry_listingId_idx"  ON "MarketplaceInquiry"("listingId")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MarketplaceInquiry_assetId_idx"    ON "MarketplaceInquiry"("assetId")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MarketplaceInquiry_buyerId_idx"    ON "MarketplaceInquiry"("buyerId")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MarketplaceInquiry_sellerId_idx"   ON "MarketplaceInquiry"("sellerId")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MarketplaceInquiry_status_idx"     ON "MarketplaceInquiry"("status")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MarketplaceInquiry_createdAt_idx"  ON "MarketplaceInquiry"("createdAt")`)

      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          ALTER TABLE "MarketplaceInquiry" ADD CONSTRAINT "MarketplaceInquiry_listingId_fkey"
            FOREIGN KEY ("listingId") REFERENCES "AssetListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `)

      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          ALTER TABLE "MarketplaceInquiry" ADD CONSTRAINT "MarketplaceInquiry_assetId_fkey"
            FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `)

      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          ALTER TABLE "MarketplaceInquiry" ADD CONSTRAINT "MarketplaceInquiry_buyerId_fkey"
            FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `)

      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          ALTER TABLE "MarketplaceInquiry" ADD CONSTRAINT "MarketplaceInquiry_sellerId_fkey"
            FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `)

      console.log('[startup] MarketplaceInquiry migration applied')
    }

  } catch (err) {
    // Never crash the server due to migration errors — log and continue.
    console.error('[startup] migration check failed:', err)
  }
}
