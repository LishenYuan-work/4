<script setup lang="ts">
import { computed, ref } from 'vue'
import { applyCategoryRepresentativeImages, products } from '../data/products'
import type { Order, Product, OrderStatus } from '../types'
import { callCloud, cloudAvailable } from '../utils/cloud'

const read = <T>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) || '') || fallback } catch { return fallback } }
const activeTab = ref<'products' | 'orders'>('products')
const productList = ref<Product[]>(read('fresh-products', products))
applyCategoryRepresentativeImages(productList.value)
localStorage.setItem('fresh-products', JSON.stringify(productList.value))
const orderList = ref<Order[]>(read('fresh-orders', []))
const search = ref('')
const selectedProduct = ref<Product | null>(null)
const draftStock = ref(0)
const draftPrice = ref(0)
const adminKey = ref(localStorage.getItem('fresh-admin-key') || '')
const cloudMode = ref(false)
const adminError = ref('')
const statusOptions: OrderStatus[] = ['待备货', '配送中', '已完成', '已取消', '退款申请中', '已退款', '退款驳回']
const visibleProducts = computed(() => productList.value.filter(item => `${item.name}${item.category}`.includes(search.value)))
const pendingOrders = computed(() => orderList.value.filter(item => ['待备货', '退款申请中'].includes(item.status)).length)
function money(value: number) { return `¥${value.toFixed(2)}` }
function saveProducts() { localStorage.setItem('fresh-products', JSON.stringify(productList.value)) }
function saveAdminKey() { localStorage.setItem('fresh-admin-key', adminKey.value.trim()); void syncCloudAdmin() }
async function syncCloudAdmin() {
  adminError.value = ''
  try {
    const result = await callCloud<{ products?: Product[]; orders?: Order[] }>('adminList', { adminKey: adminKey.value.trim() })
    if (Array.isArray(result.products) && result.products.length) { productList.value = result.products; applyCategoryRepresentativeImages(productList.value) }
    if (Array.isArray(result.orders)) orderList.value = result.orders
    cloudMode.value = true
    saveProducts()
    localStorage.setItem('fresh-orders', JSON.stringify(orderList.value))
  } catch (error) {
    cloudMode.value = false
    adminError.value = error instanceof Error ? error.message : '云端连接失败'
  }
}
void syncCloudAdmin()
async function toggleSale(product: Product) {
  const next = !product.onSale
  product.onSale = next
  saveProducts()
  if (!cloudAvailable()) return
  try {
    await callCloud('adminUpdateProduct', { id: product.id, onSale: next, adminKey: adminKey.value.trim() })
  } catch (error) {
    product.onSale = !next
    saveProducts()
    adminError.value = error instanceof Error ? error.message : '商品状态更新失败'
  }
}
function editProduct(product: Product) { selectedProduct.value = product; draftStock.value = product.stock; draftPrice.value = product.price }
async function saveProduct() {
  if (!selectedProduct.value) return
  const product = selectedProduct.value
  const previous = { stock: product.stock, price: product.price }
  product.stock = Math.max(0, Number.isFinite(draftStock.value) ? Math.floor(draftStock.value) : previous.stock)
  product.price = Math.max(0, Number.isFinite(draftPrice.value) ? draftPrice.value : previous.price)
  saveProducts()
  selectedProduct.value = null
  if (!cloudAvailable()) return
  try {
    await callCloud('adminUpdateProduct', { id: product.id, stock: product.stock, price: product.price, adminKey: adminKey.value.trim() })
  } catch (error) {
    product.stock = previous.stock
    product.price = previous.price
    saveProducts()
    adminError.value = error instanceof Error ? error.message : '商品修改失败'
  }
}
async function updateStatus(order: Order, status: OrderStatus) {
  const previous = order.status
  order.status = status
  localStorage.setItem('fresh-orders', JSON.stringify(orderList.value))
  if (!cloudAvailable()) return
  try {
    await callCloud('adminUpdateOrderStatus', { id: order.id, status, adminKey: adminKey.value.trim() })
  } catch (error) {
    order.status = previous
    localStorage.setItem('fresh-orders', JSON.stringify(orderList.value))
    adminError.value = error instanceof Error ? error.message : '订单状态更新失败'
  }
}
</script>

<template>
  <main class="admin-shell">
    <div class="admin-cloud-panel"><label>uniCloud 密钥<input v-model="adminKey" type="password" placeholder="配置后连接云端" @change="saveAdminKey" /></label><button @click="syncCloudAdmin">连接</button><span>{{ cloudMode ? '云端已连接' : '本地模式' }}</span><small v-if="adminError">{{ adminError }}</small></div>
    <aside class="admin-sidebar"><div class="admin-brand"><span class="admin-mark">鲜</span><div><strong>鲜达集市</strong><small>商家管理后台</small></div></div><nav><button :class="{active: activeTab === 'products'}" @click="activeTab = 'products'"><span>▦</span>商品管理</button><button :class="{active: activeTab === 'orders'}" @click="activeTab = 'orders'"><span>▤</span>订单管理 <b v-if="pendingOrders">{{ pendingOrders }}</b></button></nav><div class="admin-foot"><span class="admin-avatar">李</span><div><strong>店铺管理员</strong><small>演示账号</small></div></div></aside>
    <section class="admin-main"><header class="admin-header"><div><span class="admin-eyebrow">STORE OPERATIONS / 2026</span><h1>{{ activeTab === 'products' ? '商品管理' : '订单管理' }}</h1><p>{{ activeTab === 'products' ? '调整在售商品、价格与库存状态' : '处理接单、备货、配送和退款申请' }}</p></div><a href="/" class="view-shop">查看小程序 ↗</a></header>
      <div v-if="activeTab === 'products'" class="admin-content"><div class="metric-row"><div><span>在售商品</span><strong>{{ productList.filter(item => item.onSale).length }}</strong><small>共 {{ productList.length }} 件</small></div><div><span>库存紧张</span><strong>{{ productList.filter(item => item.stock > 0 && item.stock <= 10).length }}</strong><small>需要及时补货</small></div><div><span>已下架</span><strong>{{ productList.filter(item => !item.onSale).length }}</strong><small>暂不参与销售</small></div></div><div class="toolbar"><label class="admin-search">⌕<input v-model="search" placeholder="搜索商品名称或分类" /></label><span class="toolbar-note">数据保存于本机演示环境</span></div><div class="table-card"><table><thead><tr><th>商品</th><th>分类</th><th>售价</th><th>库存</th><th>销量</th><th>状态</th><th></th></tr></thead><tbody><tr v-for="product in visibleProducts" :key="product.id"><td><div class="table-product"><img :src="product.image" /><div><strong>{{ product.name }}</strong><small>{{ product.spec }} · {{ product.origin }}</small></div></div></td><td>{{ product.category }}</td><td class="money">{{ money(product.price) }}<small>/{{ product.unit }}</small></td><td :class="{warning: product.stock <= 10}">{{ product.stock }}</td><td>{{ product.sales }}</td><td><button :class="['status-switch', { on: product.onSale }]" @click="toggleSale(product)"><i></i>{{ product.onSale ? '在售' : '已下架' }}</button></td><td><button class="edit-button" @click="editProduct(product)">编辑</button></td></tr></tbody></table></div></div>
      <div v-else class="admin-content"><div class="metric-row"><div><span>全部订单</span><strong>{{ orderList.length }}</strong><small>本机演示数据</small></div><div><span>待处理</span><strong>{{ orderList.filter(item => item.status === '待备货').length }}</strong><small>等待备货</small></div><div><span>退款申请</span><strong>{{ orderList.filter(item => item.status === '退款申请中').length }}</strong><small>需要审核</small></div></div><div class="table-card order-table"><table><thead><tr><th>订单</th><th>商品</th><th>收货信息</th><th>金额</th><th>状态</th><th>更新状态</th></tr></thead><tbody><tr v-for="order in orderList" :key="order.id"><td><strong>{{ order.id }}</strong><small>{{ order.createdAt }}</small></td><td><strong>{{ order.items[0]?.name }}</strong><small>{{ order.items.length }} 种商品 · {{ order.deliverySlot }}</small></td><td><strong>{{ order.address.receiver }} {{ order.address.phone }}</strong><small>{{ order.address.detail }}</small></td><td class="money">{{ money(order.totalAmount) }}</td><td><span class="order-status">{{ order.status }}</span></td><td><select :value="order.status" @change="updateStatus(order, ($event.target as HTMLSelectElement).value as OrderStatus)"><option v-for="status in statusOptions" :key="status" :value="status">{{ status }}</option></select></td></tr><tr v-if="!orderList.length"><td colspan="6" class="empty-table">还没有订单，完成一次小程序下单后会显示在这里。</td></tr></tbody></table></div></div>
    </section>
    <div v-if="selectedProduct" class="admin-modal"><div class="admin-dialog"><div class="dialog-head"><div><span class="admin-eyebrow">PRODUCT EDIT</span><h2>编辑商品</h2></div><button @click="selectedProduct = null">×</button></div><p>{{ selectedProduct.name }} · {{ selectedProduct.spec }}</p><label>售价（元）<input v-model.number="draftPrice" type="number" min="0" step="0.1" /></label><label>可售库存<input v-model.number="draftStock" type="number" min="0" /></label><div class="dialog-actions"><button @click="selectedProduct = null">取消</button><button class="save-button" @click="saveProduct">保存修改</button></div></div></div>
  </main>
</template>
