/** Credit purchase creation is permanently retired. Historical callbacks remain separate. */
export interface PaymentGateError {
  body: {
    success: false
    errorCode: 'PLATFORM_CREDITS_RECHARGE_DISABLED'
    message: string
  }
  status: 503
}

export function paymentLaunchGate(scope: 'credits' | 'service-order' = 'credits'): PaymentGateError | null {
  // The ordinary order route keeps its existing launch flag, independent of retired credits.
  if (scope === 'service-order' && process.env.PLATFORM_CREDITS_RECHARGE_ENABLED === 'true') return null
  return {
    body: {
      success: false,
      errorCode: 'PLATFORM_CREDITS_RECHARGE_DISABLED',
      message: scope === 'credits' ? 'City 积分制度已停用，不再提供积分充值。' : '平台支付功能暂未开放。',
    },
    status: 503,
  }
}
