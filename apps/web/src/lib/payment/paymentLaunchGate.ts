/**
 * Server-side kill switch for all payment / recharge / checkout creation routes.
 *
 * Env: PLATFORM_CREDITS_RECHARGE_ENABLED
 *   - Must equal exactly 'true' to allow order creation.
 *   - Absent or any other value → fail closed.
 *
 * Usage in route handlers (before any DB write or provider call):
 *   const gate = paymentLaunchGate()
 *   if (gate) return NextResponse.json(gate.body, { status: gate.status })
 */

export interface PaymentGateError {
  body: {
    success: false
    errorCode: 'PLATFORM_CREDITS_RECHARGE_DISABLED'
    message: string
  }
  status: 503
}

const GATE_ERROR: PaymentGateError = {
  body: {
    success: false,
    errorCode: 'PLATFORM_CREDITS_RECHARGE_DISABLED',
    message: '平台充值功能暂未开放。',
  },
  status: 503,
}

/**
 * Returns the gate error object when the kill switch is closed, null when open.
 * Never reads the env value beyond a strict equality check; never logs it.
 */
export function paymentLaunchGate(): PaymentGateError | null {
  if (process.env.PLATFORM_CREDITS_RECHARGE_ENABLED !== 'true') {
    return GATE_ERROR
  }
  return null
}
