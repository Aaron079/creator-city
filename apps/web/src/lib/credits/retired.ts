export function creditRetiredError() {
  return Object.assign(new Error('City 积分制度已停用，不再提供充值、发放或预扣积分。'), { code: 'CREDITS_RETIRED' })
}
