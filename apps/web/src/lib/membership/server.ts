/**
 * P1-4B-2: Membership service layer — server-side only.
 * Never import from client components.
 * Does NOT touch PaymentOrder / CreditLedger / UserCreditWallet.
 */

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { jsonError } from '@/lib/api/json-response'
import { MembershipStatus, MembershipOrderStatus } from '@prisma/client'
import type { UserMembership } from '@prisma/client'

// ── membershipGateResponse ────────────────────────────────────────────────────
// Returns NextResponse (403/401) if user is not a member, null if allowed.
// Accepts a minimal structural type to avoid importing CurrentUser.

type MembershipGateUser = { role?: string | null; membershipActive?: boolean | null } | null

export function membershipGateResponse(user: MembershipGateUser): NextResponse | null {
  if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)
  if (user.role === 'ADMIN') return null
  if (user.membershipActive) return null
  return jsonError(
    'MEMBERSHIP_REQUIRED',
    '该功能需要 Creator City 会员。请前往会员中心开通 ¥100/月会员后使用。',
    403,
  )
}

// ── Error ─────────────────────────────────────────────────────────────────────

export class MembershipError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'MembershipError'
  }
}

// ── Month arithmetic ──────────────────────────────────────────────────────────

function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

// ── computeMembershipStatus ───────────────────────────────────────────────────
// Pure function — never touches the DB. Safe to call from getCurrentUser.

export interface MembershipStatusResult {
  active: boolean
  status: MembershipStatus
  expiresAt: Date | null
  planCode: string | null
  daysRemaining: number
}

export function computeMembershipStatus(membership: UserMembership | null): MembershipStatusResult {
  if (!membership) {
    return { active: false, status: MembershipStatus.INACTIVE, expiresAt: null, planCode: null, daysRemaining: 0 }
  }
  if (membership.status !== MembershipStatus.ACTIVE || !membership.expiresAt) {
    return {
      active: false,
      status: membership.status,
      expiresAt: membership.expiresAt,
      planCode: membership.planCode,
      daysRemaining: 0,
    }
  }
  const now = new Date()
  if (membership.expiresAt <= now) {
    return {
      active: false,
      status: MembershipStatus.EXPIRED,
      expiresAt: membership.expiresAt,
      planCode: membership.planCode,
      daysRemaining: 0,
    }
  }
  const msRemaining = membership.expiresAt.getTime() - now.getTime()
  const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24))
  return {
    active: true,
    status: MembershipStatus.ACTIVE,
    expiresAt: membership.expiresAt,
    planCode: membership.planCode,
    daysRemaining,
  }
}

// ── getUserMembership ─────────────────────────────────────────────────────────

export async function getUserMembership(userId: string) {
  const membership = await db.userMembership.findUnique({ where: { userId } })
  return {
    membership,
    ...computeMembershipStatus(membership),
  }
}

// ── Transfer info (static) ────────────────────────────────────────────────────

function buildTransferInfo() {
  return {
    amountCny: 10000,
    amountText: '¥100.00',
    note: '请转账后填写付款备注，管理员人工审核后开通会员。',
  }
}

// ── submitMembershipOrder ─────────────────────────────────────────────────────

export async function submitMembershipOrder(
  userId: string,
  input: { voucherNote?: string },
) {
  if (input.voucherNote && input.voucherNote.length > 1000) {
    throw new MembershipError('VOUCHER_NOTE_TOO_LONG', '付款备注不能超过 1000 字')
  }

  // Return existing PENDING order to prevent duplicate submissions.
  const existing = await db.membershipOrder.findFirst({
    where: { userId, status: MembershipOrderStatus.PENDING },
    orderBy: { createdAt: 'desc' },
  })
  if (existing) {
    return { order: existing, transferInfo: buildTransferInfo() }
  }

  const order = await db.membershipOrder.create({
    data: {
      userId,
      planCode: 'pro_monthly_cny100',
      amountCny: 10000,
      periodMonths: 1,
      status: MembershipOrderStatus.PENDING,
      voucherNote: input.voucherNote ?? null,
    },
  })
  return { order, transferInfo: buildTransferInfo() }
}

// ── updateMembershipOrderVoucher ──────────────────────────────────────────────

export async function updateMembershipOrderVoucher(
  userId: string,
  orderId: string,
  voucherNote: string,
) {
  if (!voucherNote || voucherNote.trim().length < 1) {
    throw new MembershipError('VOUCHER_NOTE_REQUIRED', '请填写付款备注')
  }
  if (voucherNote.length > 1000) {
    throw new MembershipError('VOUCHER_NOTE_TOO_LONG', '付款备注不能超过 1000 字')
  }

  const order = await db.membershipOrder.findFirst({ where: { id: orderId, userId } })
  if (!order) {
    throw new MembershipError('MEMBERSHIP_ORDER_NOT_FOUND', '订单不存在')
  }
  if (order.status !== MembershipOrderStatus.PENDING) {
    throw new MembershipError('MEMBERSHIP_ORDER_NOT_PENDING', '只能修改待审核订单的付款备注')
  }

  return db.membershipOrder.update({ where: { id: orderId }, data: { voucherNote } })
}

// ── approveMembershipOrder ────────────────────────────────────────────────────

export async function approveMembershipOrder(
  orderId: string,
  adminUserId: string,
  adminNote?: string,
) {
  return db.$transaction(async (tx) => {
    const order = await tx.membershipOrder.findUnique({ where: { id: orderId } })
    if (!order) {
      throw new MembershipError('MEMBERSHIP_ORDER_NOT_FOUND', '订单不存在')
    }
    // Idempotent: already approved — return current membership without re-stacking.
    if (order.status === MembershipOrderStatus.APPROVED) {
      const membership = await tx.userMembership.findUnique({ where: { userId: order.userId } })
      return { order, membership }
    }
    if (order.status === MembershipOrderStatus.REJECTED) {
      throw new MembershipError('MEMBERSHIP_ORDER_ALREADY_REJECTED', '已拒绝的订单不能审批')
    }
    if (order.status === MembershipOrderStatus.CANCELLED) {
      throw new MembershipError('MEMBERSHIP_ORDER_NOT_PENDING', '已取消的订单不能审批')
    }

    // Update order → APPROVED
    const updatedOrder = await tx.membershipOrder.update({
      where: { id: orderId },
      data: {
        status: MembershipOrderStatus.APPROVED,
        adminUserId,
        adminNote: adminNote ?? null,
      },
    })

    // Compute new expiry
    const now = new Date()
    const existing = await tx.userMembership.findUnique({ where: { userId: order.userId } })

    let startsAt: Date
    let expiresAt: Date

    if (
      existing &&
      existing.status === MembershipStatus.ACTIVE &&
      existing.expiresAt !== null &&
      existing.expiresAt > now
    ) {
      // Active membership — stack months on top of existing expiry
      startsAt = existing.startsAt ?? now
      expiresAt = addMonths(existing.expiresAt, order.periodMonths)
    } else {
      // No membership, expired, inactive, or suspended — fresh activation
      startsAt = now
      expiresAt = addMonths(now, order.periodMonths)
    }

    const membership = await tx.userMembership.upsert({
      where: { userId: order.userId },
      create: {
        userId: order.userId,
        status: MembershipStatus.ACTIVE,
        planCode: order.planCode,
        startsAt,
        expiresAt,
        sourceOrderId: order.id,
        adminNote: adminNote ?? null,
      },
      update: {
        status: MembershipStatus.ACTIVE,
        planCode: order.planCode,
        startsAt,
        expiresAt,
        sourceOrderId: order.id,
        adminNote: adminNote ?? null,
      },
    })

    return { order: updatedOrder, membership }
  })
}

// ── rejectMembershipOrder ─────────────────────────────────────────────────────

export async function rejectMembershipOrder(
  orderId: string,
  adminUserId: string,
  adminNote: string,
) {
  return db.$transaction(async (tx) => {
    const order = await tx.membershipOrder.findUnique({ where: { id: orderId } })
    if (!order) {
      throw new MembershipError('MEMBERSHIP_ORDER_NOT_FOUND', '订单不存在')
    }
    if (order.status !== MembershipOrderStatus.PENDING) {
      throw new MembershipError('MEMBERSHIP_ORDER_NOT_PENDING', '只能拒绝待处理订单')
    }

    const updatedOrder = await tx.membershipOrder.update({
      where: { id: orderId },
      data: {
        status: MembershipOrderStatus.REJECTED,
        adminUserId,
        adminNote,
      },
    })

    return { order: updatedOrder }
  })
}
