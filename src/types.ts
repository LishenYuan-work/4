export type Category = '水果' | '蔬菜' | '肉禽蛋奶' | '水产' | '粮油调味' | '熟食及其他'
export type Product = {
  id: string
  name: string
  category: Category
  price: number
  unit: string
  stock: number
  sales: number
  origin: string
  spec: string
  freshness: string
  description?: string
  image: string
  tags: string[]
  onSale: boolean
}
export type CartItem = { productId: string; quantity: number; selected: boolean; snapshotPrice: number }
export type Address = { id: string; receiver: string; phone: string; detail: string; isDefault: boolean }
export type OrderStatus = '待付款' | '待备货' | '配送中' | '已完成' | '已取消' | '退款申请中' | '已退款' | '退款驳回'
export type Order = {
  id: string
  createdAt: string
  status: OrderStatus
  items: Array<{ productId: string; name: string; image: string; unit: string; price: number; quantity: number }>
  address: Address
  deliverySlot: string
  productAmount: number
  deliveryFee: number
  coupon: number
  totalAmount: number
  remark: string
  paymentStatus?: '未支付' | '已支付'
}
