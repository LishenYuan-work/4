export function calculateOrderTotal(productAmount: number, coupon = 0) {
  const safeProductAmount = Number.isFinite(productAmount) ? Math.max(0, productAmount) : 0
  const deliveryFee = safeProductAmount >= 29 ? 0 : 3
  const safeCoupon = Number.isFinite(coupon) ? Math.min(safeProductAmount + deliveryFee, Math.max(0, coupon)) : 0
  return { deliveryFee, coupon: safeCoupon, totalAmount: Math.max(0, safeProductAmount + deliveryFee - safeCoupon) }
}
