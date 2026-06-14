/**
 * P1-4D-2: MarketplaceInquiry service layer — server-side only.
 * No payment, no LicenseGrant, no CreditLedger, no wallet.
 */

import { db } from '@/lib/db'
import { randomUUID } from 'crypto'

export class MarketplaceInquiryError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code)
    this.name = 'MarketplaceInquiryError'
  }
}

const MAX_MESSAGE_LENGTH = 1000
const MAX_SELLER_NOTE_LENGTH = 1000

// ── Serializer ────────────────────────────────────────────────────────────────

export function serializeInquiry(i: {
  id: string
  listingId: string
  assetId: string
  buyerId: string
  sellerId: string
  status: string
  message: string | null
  sellerNote: string | null
  createdAt: Date
  updatedAt: Date
  respondedAt: Date | null
  closedAt: Date | null
}) {
  return {
    id: i.id,
    listingId: i.listingId,
    assetId: i.assetId,
    buyerId: i.buyerId,
    sellerId: i.sellerId,
    status: i.status,
    message: i.message,
    sellerNote: i.sellerNote,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
    respondedAt: i.respondedAt?.toISOString() ?? null,
    closedAt: i.closedAt?.toISOString() ?? null,
  }
}

// ── submitMarketplaceInquiry ──────────────────────────────────────────────────
// Creates a new inquiry or resets a CLOSED/REJECTED one (unique constraint prevents
// a second row). PENDING/RESPONDED → idempotent return.

export async function submitMarketplaceInquiry(
  listingId: string,
  buyerId: string,
  message: string | null | undefined,
) {
  if (message && message.length > MAX_MESSAGE_LENGTH) {
    throw new MarketplaceInquiryError('INQUIRY_MESSAGE_TOO_LONG', `message 不能超过 ${MAX_MESSAGE_LENGTH} 字。`)
  }

  const listing = await db.assetListing.findUnique({
    where: { id: listingId },
    select: { id: true, assetId: true, sellerId: true, status: true },
  })
  if (!listing) throw new MarketplaceInquiryError('LISTING_NOT_FOUND', 'Listing 不存在。')
  if (listing.status !== 'ACTIVE') throw new MarketplaceInquiryError('LISTING_NOT_ACTIVE', 'Listing 未激活，无法提交合作意向。')
  if (listing.sellerId === buyerId) throw new MarketplaceInquiryError('CANNOT_INQUIRE_OWN_LISTING', '不能对自己的 Listing 提交合作意向。')

  const existing = await db.marketplaceInquiry.findUnique({
    where: { listingId_buyerId: { listingId, buyerId } },
  })

  if (existing) {
    if (existing.status === 'PENDING' || existing.status === 'RESPONDED') {
      // Already open — return idempotent
      return existing
    }
    // CLOSED or REJECTED → reopen
    const reset = await db.marketplaceInquiry.update({
      where: { id: existing.id },
      data: {
        status: 'PENDING',
        message: message?.trim() ?? null,
        sellerNote: null,
        respondedAt: null,
        closedAt: null,
      },
    })
    return reset
  }

  return db.marketplaceInquiry.create({
    data: {
      id: randomUUID(),
      listingId,
      assetId: listing.assetId,
      buyerId,
      sellerId: listing.sellerId,
      status: 'PENDING',
      message: message?.trim() ?? null,
    },
  })
}

// ── getMyInquiryForListing ────────────────────────────────────────────────────

export async function getMyInquiryForListing(listingId: string, buyerId: string) {
  return db.marketplaceInquiry.findUnique({
    where: { listingId_buyerId: { listingId, buyerId } },
  })
}

// ── listMarketplaceInquiries ──────────────────────────────────────────────────

const INCLUDE_RELATIONS = {
  listing: { select: { id: true, title: true, licenseMode: true, status: true } },
  asset: { select: { id: true, title: true, name: true, type: true, thumbnailUrl: true } },
  buyer: { select: { id: true, displayName: true, username: true, profile: { select: { avatarUrl: true } } } },
  seller: { select: { id: true, displayName: true, username: true, profile: { select: { avatarUrl: true } } } },
} as const

export async function listMarketplaceInquiries(userId: string, role: 'buyer' | 'seller') {
  const where = role === 'buyer' ? { buyerId: userId } : { sellerId: userId }
  return db.marketplaceInquiry.findMany({
    where,
    include: INCLUDE_RELATIONS,
    orderBy: { updatedAt: 'desc' },
    take: 100,
  })
}

// ── respondMarketplaceInquiry ─────────────────────────────────────────────────

export async function respondMarketplaceInquiry(
  inquiryId: string,
  sellerId: string,
  sellerNote: string,
) {
  if (!sellerNote?.trim()) {
    throw new MarketplaceInquiryError('INQUIRY_SELLER_NOTE_REQUIRED', '回复内容不能为空。')
  }
  if (sellerNote.length > MAX_SELLER_NOTE_LENGTH) {
    throw new MarketplaceInquiryError('INQUIRY_SELLER_NOTE_TOO_LONG', `回复内容不能超过 ${MAX_SELLER_NOTE_LENGTH} 字。`)
  }

  const inquiry = await db.marketplaceInquiry.findUnique({ where: { id: inquiryId } })
  if (!inquiry) throw new MarketplaceInquiryError('INQUIRY_NOT_FOUND', '合作意向不存在。')
  if (inquiry.sellerId !== sellerId) throw new MarketplaceInquiryError('FORBIDDEN', '只有卖家可以回复合作意向。')
  if (inquiry.status !== 'PENDING' && inquiry.status !== 'RESPONDED') {
    throw new MarketplaceInquiryError('INQUIRY_INVALID_STATE', `当前状态 ${inquiry.status} 不允许回复。`)
  }

  return db.marketplaceInquiry.update({
    where: { id: inquiryId },
    data: {
      status: 'RESPONDED',
      sellerNote: sellerNote.trim(),
      respondedAt: new Date(),
      closedAt: null,
    },
  })
}

// ── rejectMarketplaceInquiry ──────────────────────────────────────────────────

export async function rejectMarketplaceInquiry(
  inquiryId: string,
  sellerId: string,
  sellerNote?: string | null,
) {
  if (sellerNote && sellerNote.length > MAX_SELLER_NOTE_LENGTH) {
    throw new MarketplaceInquiryError('INQUIRY_SELLER_NOTE_TOO_LONG', `备注不能超过 ${MAX_SELLER_NOTE_LENGTH} 字。`)
  }

  const inquiry = await db.marketplaceInquiry.findUnique({ where: { id: inquiryId } })
  if (!inquiry) throw new MarketplaceInquiryError('INQUIRY_NOT_FOUND', '合作意向不存在。')
  if (inquiry.sellerId !== sellerId) throw new MarketplaceInquiryError('FORBIDDEN', '只有卖家可以拒绝合作意向。')
  if (inquiry.status !== 'PENDING' && inquiry.status !== 'RESPONDED') {
    throw new MarketplaceInquiryError('INQUIRY_INVALID_STATE', `当前状态 ${inquiry.status} 不允许拒绝。`)
  }

  return db.marketplaceInquiry.update({
    where: { id: inquiryId },
    data: {
      status: 'REJECTED',
      sellerNote: sellerNote?.trim() ?? inquiry.sellerNote,
      respondedAt: new Date(),
    },
  })
}

// ── closeMarketplaceInquiry ───────────────────────────────────────────────────

export async function closeMarketplaceInquiry(inquiryId: string, userId: string) {
  const inquiry = await db.marketplaceInquiry.findUnique({ where: { id: inquiryId } })
  if (!inquiry) throw new MarketplaceInquiryError('INQUIRY_NOT_FOUND', '合作意向不存在。')
  if (inquiry.buyerId !== userId && inquiry.sellerId !== userId) {
    throw new MarketplaceInquiryError('FORBIDDEN', '只有买家或卖家可以关闭合作意向。')
  }
  if (inquiry.status !== 'PENDING' && inquiry.status !== 'RESPONDED') {
    throw new MarketplaceInquiryError('INQUIRY_INVALID_STATE', `当前状态 ${inquiry.status} 不允许关闭。`)
  }

  return db.marketplaceInquiry.update({
    where: { id: inquiryId },
    data: { status: 'CLOSED', closedAt: new Date() },
  })
}
