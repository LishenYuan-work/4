import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { applyCategoryRepresentativeImages, categories, products } from '../data/products'
import { calculateOrderTotal } from '../utils/commerce'
import { callCloud, cloudAvailable } from '../utils/cloud'
import type { Address, CartItem, Order, OrderStatus, Product } from '../types'

const read = <T>(key: string, fallback: T): T => {
  try {
    if (typeof uni !== 'undefined') {
      const value = uni.getStorageSync(key)
      return value === undefined || value === null ? fallback : value
    }
    if (typeof localStorage !== 'undefined') {
      const value = localStorage.getItem(key)
      if (value === null) return fallback
      const parsed = JSON.parse(value)
      return parsed === null ? fallback : parsed as T
    }
  } catch {
    // Storage can be unavailable in private browsing or a restricted WebView.
  }
  return fallback
}

const write = (key: string, value: unknown) => {
  try {
    if (typeof uni !== 'undefined') {
      uni.setStorageSync(key, value)
    } else if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value))
    }
  } catch {
    // The shopping flow remains usable when persistence is unavailable.
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object'
const textValue = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback
const numberValue = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback

function normalizeCart(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord).map(item => ({
    productId: textValue(item.productId),
    quantity: Math.max(1, Math.floor(numberValue(item.quantity, 1))),
    selected: item.selected !== false,
    snapshotPrice: numberValue(item.snapshotPrice),
  })).filter(item => item.productId)
}

function normalizeAddresses(value: unknown, fallback: Address[]): Address[] {
  if (!Array.isArray(value)) return fallback
  const normalized = value.filter(isRecord).map((item, index) => ({
    id: textValue(item.id, `a${index + 1}`),
    receiver: textValue(item.receiver),
    phone: textValue(item.phone),
    detail: textValue(item.detail),
    isDefault: item.isDefault === true,
  })).filter(item => item.receiver || item.phone || item.detail)
  return normalized.length ? normalized : fallback
}

function normalizeOrders(value: unknown): Order[] {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord).map((order, index) => {
    const items = Array.isArray(order.items) ? order.items.filter(isRecord).map(item => ({
      productId: textValue(item.productId),
      name: textValue(item.name),
      image: textValue(item.image),
      unit: textValue(item.unit),
      price: numberValue(item.price),
      quantity: Math.max(1, Math.floor(numberValue(item.quantity, 1))),
    })).filter(item => item.productId) : []
    const address = isRecord(order.address) ? {
      id: textValue(order.address.id),
      receiver: textValue(order.address.receiver),
      phone: textValue(order.address.phone),
      detail: textValue(order.address.detail),
      isDefault: order.address.isDefault === true,
    } : { id: '', receiver: '', phone: '', detail: '', isDefault: false }
    const createdAt = typeof order.createdAt === 'number' && Number.isFinite(order.createdAt)
      ? new Date(order.createdAt).toLocaleString('zh-CN', { hour12: false })
      : textValue(order.createdAt)
    return {
      id: textValue(order.id, `S${Date.now()}-${index}`),
      createdAt,
      status: textValue(order.status, '待备货') as OrderStatus,
      items,
      address,
      deliverySlot: textValue(order.deliverySlot),
      productAmount: numberValue(order.productAmount),
      deliveryFee: numberValue(order.deliveryFee),
      coupon: numberValue(order.coupon),
      totalAmount: numberValue(order.totalAmount),
      remark: textValue(order.remark),
      paymentStatus: order.paymentStatus === '已支付' ? '已支付' as const : '未支付' as const,
    }
  }).filter(order => order.items.length)
}

function normalizeProducts(value: unknown): Product[] {
  if (!Array.isArray(value)) return products
  const stored = new Map(value.filter(isRecord).map(item => [textValue(item.id), item]))
  return products.map(product => {
    const item = stored.get(product.id)
    if (!item) return { ...product }
    return {
      ...product,
      name: textValue(item.name, product.name),
      price: numberValue(item.price, product.price),
      unit: textValue(item.unit, product.unit),
      stock: Math.max(0, Math.floor(numberValue(item.stock, product.stock))),
      sales: Math.max(0, Math.floor(numberValue(item.sales, product.sales))),
      origin: textValue(item.origin, product.origin),
      spec: textValue(item.spec, product.spec),
      freshness: textValue(item.freshness, product.freshness),
      description: textValue(item.description, product.description || ''),
      image: textValue(item.image, product.image),
      tags: Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === 'string') : product.tags,
      onSale: typeof item.onSale === 'boolean' ? item.onSale : product.onSale,
    }
  })
}

export const useShopStore = defineStore('shop', () => {
  const auth = ref(read<unknown>('fresh-auth', false) === true)
  const cart = ref<CartItem[]>(normalizeCart(read<unknown>('fresh-cart', [])))
  const orders = ref<Order[]>(normalizeOrders(read<unknown>('fresh-orders', [])))
  const defaultAddresses = [{ id: 'a1', receiver: '李深源', phone: '13800138000', detail: '上海市浦东新区张江路 88 号 6 幢 1201', isDefault: true }]
  const addresses = ref<Address[]>(normalizeAddresses(read<unknown>('fresh-addresses', defaultAddresses), defaultAddresses))
  const storedHistory = read<unknown>('fresh-history', ['蓝莓', '牛奶', '三文鱼'])
  const history = ref<string[]>(Array.isArray(storedHistory) ? storedHistory.filter((item): item is string => typeof item === 'string') : ['蓝莓', '牛奶', '三文鱼'])
  const storedProducts = read<unknown>('fresh-products', products)
  const availableProducts = normalizeProducts(storedProducts)
  applyCategoryRepresentativeImages(availableProducts)
  const productsState = ref<Product[]>(availableProducts)
  orders.value.forEach(order => order.items.forEach(item => {
    const product = productsState.value.find(entry => entry.id === item.productId)
    if (product) item.image = product.image
  }))
  write('fresh-auth', auth.value)
  write('fresh-cart', cart.value)
  write('fresh-addresses', addresses.value)
  write('fresh-history', history.value)
  write('fresh-products', productsState.value)
  write('fresh-orders', orders.value)
  const currentOrderId = ref('')
  const toastMessage = ref('')
  const cloudReady = ref(false)

  const persist = () => {
    write('fresh-auth', auth.value)
    write('fresh-cart', cart.value)
    write('fresh-orders', orders.value)
    write('fresh-addresses', addresses.value)
    write('fresh-history', history.value)
    write('fresh-products', productsState.value)
  }
  const notify = (message: string) => { toastMessage.value = message; setTimeout(() => (toastMessage.value = ''), 1800) }
  const productById = (id: string) => productsState.value.find(p => p.id === id)
  const cartLines = computed(() => cart.value.map(item => ({ ...item, product: productById(item.productId), invalid: !productById(item.productId)?.onSale || (productById(item.productId)?.stock || 0) <= 0 || item.quantity > (productById(item.productId)?.stock || 0) })).filter(item => item.product))
  const selectedLines = computed(() => cartLines.value.filter(item => item.selected && !item.invalid))
  const cartCount = computed(() => cart.value.reduce((sum, item) => sum + item.quantity, 0))
  const selectedAmount = computed(() => selectedLines.value.reduce((sum, item) => sum + (item.product?.price || 0) * item.quantity, 0))

  async function hydrateFromCloud() {
    try {
      const snapshot = await callCloud<{ authenticated?: boolean; products?: unknown; addresses?: unknown; orders?: unknown }>('getStoreData')
      if (Array.isArray(snapshot.products) && snapshot.products.length) {
        const nextProducts = normalizeProducts(snapshot.products)
        applyCategoryRepresentativeImages(nextProducts)
        productsState.value = nextProducts
      }
      if (Array.isArray(snapshot.addresses)) addresses.value = normalizeAddresses(snapshot.addresses, [])
      if (Array.isArray(snapshot.orders)) orders.value = normalizeOrders(snapshot.orders)
      auth.value = snapshot.authenticated === true
      cloudReady.value = true
      persist()
    } catch (error) {
      cloudReady.value = false
      console.error('[shop] cloud hydration failed; keeping local state', error)
    }
  }

  const hydrationPromise = hydrateFromCloud()
  const waitForHydration = () => hydrationPromise

  async function login() {
    const previous = auth.value
    auth.value = true
    persist()
    if (cloudAvailable()) {
      try {
        await callCloud('login', { nickname: '微信用户' })
      } catch (error) {
        auth.value = previous
        persist()
        throw error
      }
    }
    notify('已完成演示登录')
  }
  async function logout() {
    auth.value = false
    persist()
    if (cloudAvailable()) await callCloud('logout')
    notify('已退出登录')
  }
  function addToCart(product: Product, quantity = 1) {
    if (!product.onSale || product.stock <= 0) return notify('该商品暂时无法购买')
    const item = cart.value.find(x => x.productId === product.id)
    if (item) item.quantity = Math.min(product.stock, item.quantity + quantity), item.selected = true
    else cart.value.push({ productId: product.id, quantity: Math.min(quantity, product.stock), selected: true, snapshotPrice: product.price })
    persist(); notify('已加入购物车')
  }
  function updateQuantity(id: string, quantity: number) {
    const item = cart.value.find(x => x.productId === id); const product = productById(id)
    if (!item || !product) return
    item.quantity = Math.max(1, Math.min(product.stock, quantity)); persist()
  }
  function toggleCart(id: string) { const item = cart.value.find(x => x.productId === id); if (item) item.selected = !item.selected; persist() }
  function toggleAll(value: boolean) { cart.value.forEach(item => { if (productById(item.productId)?.onSale) item.selected = value }); persist() }
  function removeCart(id: string) { cart.value = cart.value.filter(item => item.productId !== id); persist(); notify('商品已删除') }
  async function saveAddress(address: Address) {
    await waitForHydration()
    const normalized = { ...address, id: address.id || `a${Date.now()}` }
    const previous = addresses.value.map(item => ({ ...item }))
    const applyLocal = () => {
      const index = addresses.value.findIndex(item => item.id === normalized.id)
      if (index >= 0) addresses.value[index] = normalized
      else addresses.value.push(normalized)
      if (normalized.isDefault || addresses.value.length === 1) addresses.value = addresses.value.map(item => ({ ...item, isDefault: item.id === normalized.id }))
    }
    try {
      if (cloudAvailable()) {
        const snapshot = await callCloud<{ addresses?: unknown }>('saveAddress', normalized)
        addresses.value = Array.isArray(snapshot.addresses) ? normalizeAddresses(snapshot.addresses, []) : [normalized]
      } else {
        applyLocal()
      }
      persist()
    } catch (error) {
      addresses.value = previous
      persist()
      throw error
    }
  }
  async function deleteAddress(id: string) {
    await waitForHydration()
    const previous = addresses.value.map(item => ({ ...item }))
    try {
      if (cloudAvailable()) {
        const snapshot = await callCloud<{ addresses?: unknown }>('deleteAddress', id)
        addresses.value = Array.isArray(snapshot.addresses) ? normalizeAddresses(snapshot.addresses, []) : addresses.value.filter(item => item.id !== id)
      } else {
        addresses.value = addresses.value.filter(item => item.id !== id)
        if (addresses.value[0] && !addresses.value.some(item => item.isDefault)) addresses.value[0].isDefault = true
      }
      persist()
    } catch (error) {
      addresses.value = previous
      persist()
      throw error
    }
  }
  async function setDefaultAddress(id: string) {
    await waitForHydration()
    const previous = addresses.value.map(item => ({ ...item }))
    try {
      if (cloudAvailable()) {
        const snapshot = await callCloud<{ addresses?: unknown }>('setDefaultAddress', id)
        addresses.value = Array.isArray(snapshot.addresses) ? normalizeAddresses(snapshot.addresses, []) : addresses.value.map(item => ({ ...item, isDefault: item.id === id }))
      } else {
        addresses.value = addresses.value.map(item => ({ ...item, isDefault: item.id === id }))
      }
      persist()
    } catch (error) {
      addresses.value = previous
      persist()
      throw error
    }
  }
  function recordSearch(keyword: string) { if (!keyword.trim()) return; history.value = [keyword.trim(), ...history.value.filter(item => item !== keyword.trim())].slice(0, 8); persist() }
  async function createOrder(payload: { address: Address; deliverySlot: string; remark: string; coupon: number; buyNow?: CartItem[] }) {
    await waitForHydration()
    const items = payload.buyNow || selectedLines.value
    if (!items.length) throw new Error('请选择至少一件商品')
    const orderItems = items.map(item => {
      const product = productById(item.productId)
      const quantity = Math.floor(Number(item.quantity))
      if (!product || !product.onSale || !Number.isFinite(quantity) || quantity < 1 || quantity > product.stock) throw new Error('商品库存已变化，请返回购物车刷新')
      return { productId: product.id, name: product.name, image: product.image, unit: product.unit, price: product.price, quantity }
    })
    const productAmount = items.reduce((sum, item) => sum + (productById(item.productId)?.price || 0) * item.quantity, 0)
    const { deliveryFee, coupon, totalAmount } = calculateOrderTotal(productAmount, payload.coupon)
    const orderId = `S${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const applyLocalInventory = () => {
      orderItems.forEach(item => {
        const product = productById(item.productId)
        if (product) {
          product.stock = Math.max(0, product.stock - item.quantity)
          product.sales += item.quantity
        }
      })
    }
    if (cloudAvailable()) {
      const remote = await callCloud<unknown>('createOrder', { orderId, items: orderItems, address: payload.address, deliverySlot: payload.deliverySlot, coupon, remark: payload.remark })
      const order = normalizeOrders([remote])[0]
      if (!order) throw new Error('云端返回的订单数据无效')
      orders.value.unshift(order)
      currentOrderId.value = order.id
      applyLocalInventory()
      if (!payload.buyNow) cart.value = cart.value.filter(item => !items.some(line => line.productId === item.productId))
      persist()
      return order
    }
    const order: Order = { id: orderId, createdAt: new Date().toLocaleString('zh-CN', { hour12: false }), status: '待备货', items: orderItems, address: payload.address, deliverySlot: payload.deliverySlot, productAmount, deliveryFee, coupon, totalAmount, remark: payload.remark, paymentStatus: '已支付' }
    orders.value.unshift(order); currentOrderId.value = order.id
    applyLocalInventory()
    if (!payload.buyNow) cart.value = cart.value.filter(item => !items.some(line => line.productId === item.productId))
    persist()
    return order
  }
  function updateOrderStatus(id: string, status: OrderStatus) { const order = orders.value.find(item => item.id === id); if (order) order.status = status; persist() }
  async function cancelOrder(id: string) {
    const order = orders.value.find(item => item.id === id)
    if (!order || !['待付款', '待备货'].includes(order.status)) return false
    const previous = order.status
    if (cloudAvailable()) {
      await callCloud('updateOrderStatus', { id, status: '已取消' })
    }
    order.status = '已取消'
    persist()
    return previous !== order.status
  }
  async function applyRefund(id: string) {
    const order = orders.value.find(item => item.id === id)
    if (!order || !['待备货', '配送中', '已完成'].includes(order.status)) return false
    if (cloudAvailable()) {
      await callCloud('updateOrderStatus', { id, status: '退款申请中' })
    }
    order.status = '退款申请中'
    persist()
    return true
  }
  function updateProduct(id: string, patch: Partial<Product>) { const product = productById(id); if (product) Object.assign(product, patch); persist() }

  return { auth, cart, cartLines, cartCount, selectedLines, selectedAmount, orders, addresses, history, productsState, categories, currentOrderId, toastMessage, cloudReady, productById, login, logout, addToCart, updateQuantity, toggleCart, toggleAll, removeCart, saveAddress, deleteAddress, setDefaultAddress, recordSearch, createOrder, updateOrderStatus, cancelOrder, applyRefund, updateProduct, notify, persist }
})
