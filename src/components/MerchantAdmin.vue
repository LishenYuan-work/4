<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { callCloud } from '../utils/cloud'
import { categories } from '../data/products'
import type { Category, Order, OrderStatus, Product } from '../types'

type AdminOrder = Omit<Order, 'createdAt'> & { createdAt: string | number }

const emit = defineEmits<{ back: [] }>()

const activeTab = ref<'products' | 'orders'>('products')
const authorized = ref(false)
const loading = ref(true)
const verifying = ref(false)
const savingId = ref('')
const error = ref('')
const adminKey = ref('')
const search = ref('')
const products = ref<Product[]>([])
const orders = ref<AdminOrder[]>([])
const editingProduct = ref<Product | null>(null)
const draft = ref({
  name: '', category: '水果' as Category, unit: '', origin: '', spec: '', freshness: '', description: '', image: '', tags: '', price: '', stock: '', onSale: true,
})
const draftImagePath = ref('')
const uploadingImage = ref(false)

const statusOptions: OrderStatus[] = ['待备货', '配送中', '已完成', '已取消', '退款申请中', '已退款', '退款驳回']
const visibleProducts = computed(() => {
  const keyword = search.value.trim()
  if (!keyword) return products.value
  return products.value.filter(item => `${item.name}${item.category}${item.spec}`.includes(keyword))
})
const pendingOrders = computed(() => orders.value.filter(item => ['待备货', '退款申请中'].includes(item.status)).length)

function money(value: number) {
  return `¥${Number(value || 0).toFixed(2)}`
}

function formatDate(value: string | number) {
  if (typeof value === 'number') return new Date(value).toLocaleString('zh-CN', { hour12: false })
  return value || '-'
}

function statusIndex(status: OrderStatus) {
  const index = statusOptions.indexOf(status)
  return index < 0 ? 0 : index
}

async function loadAdminData(showError = false) {
  error.value = ''
  loading.value = true
  try {
    // Pass an object even before the key is entered. Some uniCloud runtimes
    // serialize undefined as null, which would break payload.adminKey.
    const payload = adminKey.value.trim() ? { adminKey: adminKey.value.trim() } : {}
    const result = await callCloud<{ products?: Product[]; orders?: AdminOrder[] }>('adminList', payload)
    products.value = Array.isArray(result.products) ? result.products : []
    orders.value = Array.isArray(result.orders) ? result.orders : []
    authorized.value = true
  } catch (cause) {
    authorized.value = false
    if (showError || adminKey.value.trim()) error.value = cause instanceof Error ? cause.message : '管理员验证失败'
  } finally {
    loading.value = false
  }
}

async function verifyAdmin() {
  if (!adminKey.value.trim()) {
    error.value = '请输入管理密钥'
    return
  }
  verifying.value = true
  error.value = ''
  try {
    const result = await callCloud<{ allowed?: boolean }>('checkAdminAccess', { adminKey: adminKey.value.trim() })
    if (result.allowed !== true) {
      error.value = '管理密钥不正确，请重新输入'
      return
    }
    await loadAdminData(true)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '云端管理服务连接失败'
  } finally {
    verifying.value = false
  }
}

async function probeAdminAccess() {
  loading.value = true
  error.value = ''
  try {
    const result = await callCloud<{ allowed?: boolean }>('checkAdminAccess', {})
    if (result.allowed === true) await loadAdminData()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '云端管理服务未连接'
  } finally {
    loading.value = false
  }
}

function editProduct(product: Product) {
  editingProduct.value = product
  draft.value = {
    name: product.name, category: product.category, unit: product.unit, origin: product.origin, spec: product.spec,
    freshness: product.freshness, description: product.description || '', image: product.image, tags: product.tags.join(', '),
    price: String(product.price), stock: String(product.stock), onSale: product.onSale,
  }
  draftImagePath.value = ''
}

function chooseProductImage() {
  if (typeof uni === 'undefined') return
  uni.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'], success: result => {
    const filePath = result.tempFilePaths?.[0]
    if (!filePath) return
    draftImagePath.value = filePath
    draft.value.image = filePath
  } })
}

async function toggleSale(product: Product) {
  const next = !product.onSale
  savingId.value = product.id
  error.value = ''
  try {
    await callCloud('adminUpdateProduct', { id: product.id, onSale: next, ...(adminKey.value.trim() ? { adminKey: adminKey.value.trim() } : {}) })
    product.onSale = next
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '商品状态更新失败'
  } finally {
    savingId.value = ''
  }
}

async function saveProduct() {
  const product = editingProduct.value
  const price = Number(draft.value.price)
  const stock = Number(draft.value.stock)
  if (!product) return
  const fields = ['name', 'unit', 'origin', 'spec', 'freshness'] as const
  if (fields.some(key => !draft.value[key].trim())) {
    error.value = '商品名称、单位、产地、规格和保鲜提示不能为空'
    return
  }
  if (!Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0 || draft.value.description.length > 500) {
    error.value = '请填写正确的价格、库存和商品描述（不超过500字）'
    return
  }
  savingId.value = product.id
  error.value = ''
  try {
    let image = draft.value.image.trim()
    if (draftImagePath.value) {
      if (typeof uniCloud === 'undefined' || typeof uniCloud.uploadFile !== 'function') throw new Error('当前环境不支持图片上传，请从 HBuilderX 运行到微信开发者工具')
      uploadingImage.value = true
      const upload = await uniCloud.uploadFile({ filePath: draftImagePath.value, cloudPath: `merchant/products/${product.id}-${Date.now()}.jpg` })
      image = String(upload.fileID || '')
      if (!image) throw new Error('图片上传失败，请重新选择')
    }
    const tags = draft.value.tags.split(/[,，]/).map(item => item.trim()).filter(Boolean).slice(0, 8)
    await callCloud('adminUpdateProduct', {
      id: product.id, name: draft.value.name.trim(), category: draft.value.category, unit: draft.value.unit.trim(), origin: draft.value.origin.trim(),
      spec: draft.value.spec.trim(), freshness: draft.value.freshness.trim(), description: draft.value.description.trim(), image, tags,
      price, stock, onSale: draft.value.onSale, ...(adminKey.value.trim() ? { adminKey: adminKey.value.trim() } : {}),
    })
    Object.assign(product, { name: draft.value.name.trim(), category: draft.value.category, unit: draft.value.unit.trim(), origin: draft.value.origin.trim(), spec: draft.value.spec.trim(), freshness: draft.value.freshness.trim(), description: draft.value.description.trim(), image, tags, price, stock, onSale: draft.value.onSale })
    editingProduct.value = null
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '商品修改失败'
  } finally {
    uploadingImage.value = false
    savingId.value = ''
  }
}

async function updateOrderStatus(order: AdminOrder, event: { detail?: { value?: string } }) {
  const status = statusOptions[Number(event.detail?.value)]
  if (!status || status === order.status) return
  savingId.value = order.id
  error.value = ''
  try {
    await callCloud('adminUpdateOrderStatus', { id: order.id, status, ...(adminKey.value.trim() ? { adminKey: adminKey.value.trim() } : {}) })
    order.status = status
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '订单状态更新失败'
  } finally {
    savingId.value = ''
  }
}

onMounted(() => { void probeAdminAccess() })
</script>

<template>
  <view class="merchant-admin">
    <view class="subpage-head admin-head">
      <button class="back-button" @click="emit('back')">‹</button>
      <view><text class="page-title">商家管理</text><text class="page-caption">商品、库存和订单状态</text></view>
      <button class="admin-refresh" :disabled="loading" @click="loadAdminData(true)">刷新</button>
    </view>

    <view v-if="loading" class="admin-state"><text>正在连接云端管理数据...</text></view>

    <view v-else-if="!authorized" class="admin-auth">
      <text class="admin-auth-title">管理员验证</text>
      <text class="admin-auth-copy">输入服务空间中配置的管理密钥后，才可查看和修改商品、库存及订单。本次输入仅保留在当前页面，不会保存到小程序。</text>
      <input v-model="adminKey" class="admin-key-input" password maxlength="128" placeholder="请输入管理密钥" @confirm="verifyAdmin" />
      <text v-if="error" class="admin-error">{{ error }}</text>
      <button class="primary-button admin-auth-button" :disabled="verifying" @click="verifyAdmin">{{ verifying ? '验证中...' : '进入管理后台' }}</button>
    </view>

    <template v-else>
      <view class="admin-summary">
        <view><text>在售商品</text><text class="admin-number">{{ products.filter(item => item.onSale).length }}</text></view>
        <view><text>库存紧张</text><text class="admin-number">{{ products.filter(item => item.stock > 0 && item.stock <= 10).length }}</text></view>
        <view><text>待处理订单</text><text class="admin-number">{{ pendingOrders }}</text></view>
      </view>

      <view class="admin-tabs">
        <button :class="{ active: activeTab === 'products' }" @click="activeTab = 'products'">商品管理</button>
        <button :class="{ active: activeTab === 'orders' }" @click="activeTab = 'orders'">订单管理</button>
      </view>
      <text v-if="error" class="admin-error admin-operation-error">{{ error }}</text>

      <view v-if="activeTab === 'products'">
        <view class="admin-search"><input v-model="search" placeholder="搜索商品名称或分类" /></view>
        <view v-for="product in visibleProducts" :key="product.id" class="admin-list-item">
          <image class="admin-product-image" :src="product.image" mode="aspectFill" />
          <view class="admin-product-main">
            <view class="admin-product-title"><text>{{ product.name }}</text><text :class="['admin-sale-status', { off: !product.onSale }]">{{ product.onSale ? '在售' : '已下架' }}</text></view>
            <text class="admin-product-meta">{{ product.spec }} · {{ product.category }}</text>
            <view class="admin-product-bottom"><text class="admin-product-price">{{ money(product.price) }}/{{ product.unit }}</text><text :class="{ 'admin-stock-warning': product.stock <= 10 }">库存 {{ product.stock }}</text></view>
            <view class="admin-actions"><button class="admin-text-button" :disabled="savingId === product.id" @click="toggleSale(product)">{{ product.onSale ? '下架商品' : '上架商品' }}</button><button class="admin-edit-button" @click="editProduct(product)">编辑</button></view>
          </view>
        </view>
        <view v-if="!visibleProducts.length" class="admin-state"><text>没有匹配的商品</text></view>
      </view>

      <view v-else>
        <view v-for="order in orders" :key="order.id" class="admin-order-item">
          <view class="admin-order-head"><text class="admin-order-id">{{ order.id }}</text><text class="status-text">{{ order.status }}</text></view>
          <text class="admin-order-time">{{ formatDate(order.createdAt) }} · {{ order.deliverySlot }}</text>
          <text class="admin-order-product">{{ order.items[0]?.name || '商品信息缺失' }} · 共 {{ order.items.reduce((sum, item) => sum + item.quantity, 0) }} 件</text>
          <view class="admin-order-foot"><view><text class="admin-order-address">{{ order.address.receiver }} {{ order.address.phone }}</text><text class="admin-order-amount">{{ money(order.totalAmount) }}</text></view><picker :range="statusOptions" :value="statusIndex(order.status)" @change="updateOrderStatus(order, $event)"><view class="admin-picker">{{ savingId === order.id ? '更新中...' : '更新状态' }}</view></picker></view>
        </view>
        <view v-if="!orders.length" class="admin-state"><text>云端还没有订单</text></view>
      </view>
    </template>

    <view v-if="editingProduct" class="admin-modal-mask">
      <view class="admin-modal">
        <text class="admin-modal-title">编辑商品</text>
        <view class="admin-image-editor"><image v-if="draft.image" class="admin-image-preview" :src="draft.image" mode="aspectFill" /><view v-else class="admin-image-empty">暂无商品图片</view><button class="admin-image-button" @click="chooseProductImage">{{ draftImagePath ? '重新选择图片' : '上传商品图片' }}</button></view>
        <text class="admin-field-label">商品名称</text>
        <input v-model="draft.name" class="admin-field" maxlength="50" placeholder="请输入商品名称" />
        <view class="admin-field-row"><view><text class="admin-field-label">分类</text><picker :range="categories" :value="categories.indexOf(draft.category)" @change="draft.category = categories[Number($event.detail.value)] as Category"><view class="admin-picker admin-field">{{ draft.category }}</view></picker></view><view><text class="admin-field-label">计价单位</text><input v-model="draft.unit" class="admin-field" maxlength="30" placeholder="如 500g/盒" /></view></view>
        <text class="admin-field-label">产地</text>
        <input v-model="draft.origin" class="admin-field" maxlength="50" placeholder="请输入产地" />
        <text class="admin-field-label">规格 / 包装</text>
        <input v-model="draft.spec" class="admin-field" maxlength="50" placeholder="请输入规格或包装" />
        <text class="admin-field-label">保鲜提示</text>
        <input v-model="draft.freshness" class="admin-field" maxlength="80" placeholder="请输入保存方式" />
        <text class="admin-field-label">商品描述</text>
        <textarea v-model="draft.description" class="admin-textarea" maxlength="500" placeholder="介绍商品卖点、口感或使用建议" />
        <text class="admin-field-label">标签（用逗号分隔）</text>
        <input v-model="draft.tags" class="admin-field" maxlength="100" placeholder="如 推荐, 新鲜" />
        <view class="admin-field-row"><view><text class="admin-field-label">售价（元）</text><input v-model="draft.price" class="admin-field" type="digit" placeholder="请输入售价" /></view><view><text class="admin-field-label">可售库存</text><input v-model="draft.stock" class="admin-field" type="number" placeholder="请输入库存" /></view></view>
        <label class="admin-sale-check"><checkbox :checked="draft.onSale" @click="draft.onSale = !draft.onSale" />商品上架</label>
        <view class="admin-modal-actions"><button class="secondary-button" @click="editingProduct = null">取消</button><button class="primary-button" :disabled="savingId === editingProduct.id" @click="saveProduct">{{ uploadingImage ? '上传图片中...' : savingId === editingProduct.id ? '保存中...' : '保存修改' }}</button></view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.merchant-admin { padding-bottom: 28rpx; }
.admin-head { align-items: center; }
.admin-refresh { margin-left: auto; min-width: 88rpx; height: 56rpx; padding: 0 16rpx; border: 1rpx solid #bdd7c3; border-radius: 8rpx; background: #fff; color: #2f7d45; font-size: 24rpx; line-height: 56rpx; }
.admin-state { min-height: 280rpx; display: flex; align-items: center; justify-content: center; padding: 30rpx; color: #768279; font-size: 28rpx; text-align: center; }
.admin-auth { margin: 28rpx; padding: 40rpx 32rpx; border: 1rpx solid #dce8de; border-radius: 8rpx; background: #fff; }
.admin-auth-title, .admin-modal-title { display: block; color: #20352a; font-size: 36rpx; font-weight: 700; }
.admin-auth-copy { display: block; margin-top: 18rpx; color: #657269; font-size: 26rpx; line-height: 1.7; }
.admin-key-input, .admin-field, .admin-search { box-sizing: border-box; width: 100%; border: 1rpx solid #cbd9cd; border-radius: 8rpx; background: #f8fbf8; }
.admin-key-input, .admin-field { height: 84rpx; margin-top: 30rpx; padding: 0 24rpx; color: #26382c; font-size: 28rpx; }
.admin-auth-button { width: 100%; margin-top: 28rpx; }
.admin-error { display: block; margin-top: 18rpx; color: #c84444; font-size: 24rpx; line-height: 1.5; }
.admin-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14rpx; margin: 28rpx; }
.admin-summary > view { min-height: 148rpx; padding: 20rpx; border: 1rpx solid #dce8de; border-radius: 8rpx; background: #fff; }
.admin-summary text { display: block; color: #6b786f; font-size: 23rpx; }
.admin-summary .admin-number { margin-top: 13rpx; color: #226a3b; font-size: 45rpx; font-weight: 700; }
.admin-tabs { display: flex; gap: 16rpx; margin: 0 28rpx 20rpx; border-bottom: 1rpx solid #dce8de; }
.admin-tabs button { flex: 1; height: 78rpx; border: 0; border-radius: 0; background: transparent; color: #6a786e; font-size: 28rpx; line-height: 78rpx; }
.admin-tabs button.active { border-bottom: 4rpx solid #2f8b4d; color: #21703c; font-weight: 700; }
.admin-operation-error { margin: 0 28rpx 18rpx; }
.admin-search { height: 76rpx; margin: 0 28rpx 20rpx; padding: 0 20rpx; }
.admin-search input { height: 76rpx; color: #28392e; font-size: 27rpx; }
.admin-list-item, .admin-order-item { display: flex; gap: 20rpx; margin: 0 28rpx 18rpx; padding: 20rpx; border: 1rpx solid #dce8de; border-radius: 8rpx; background: #fff; }
.admin-product-image { width: 132rpx; height: 132rpx; flex: 0 0 132rpx; border-radius: 6rpx; background: #edf5ed; }
.admin-product-main { min-width: 0; flex: 1; }
.admin-product-title, .admin-product-bottom, .admin-actions, .admin-order-head, .admin-order-foot { display: flex; align-items: center; justify-content: space-between; gap: 14rpx; }
.admin-product-title > text:first-child { min-width: 0; overflow: hidden; color: #24372a; font-size: 29rpx; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.admin-sale-status { flex: 0 0 auto; padding: 4rpx 10rpx; border-radius: 4rpx; background: #e2f3e6; color: #287643; font-size: 21rpx; }
.admin-sale-status.off { background: #f2f2f2; color: #788179; }
.admin-product-meta, .admin-order-time, .admin-order-product, .admin-order-address { display: block; margin-top: 10rpx; color: #6b786f; font-size: 23rpx; line-height: 1.45; }
.admin-product-bottom { margin-top: 14rpx; }
.admin-product-price, .admin-order-amount { color: #d76736; font-size: 27rpx; font-weight: 700; }
.admin-stock-warning { color: #bf7a26; }
.admin-actions { justify-content: flex-end; margin-top: 12rpx; }
.admin-actions button { min-width: 116rpx; height: 52rpx; padding: 0 14rpx; border-radius: 6rpx; font-size: 23rpx; line-height: 52rpx; }
.admin-text-button { border: 1rpx solid #d6ded6; background: #fff; color: #5a6960; }
.admin-edit-button { border: 1rpx solid #71ae82; background: #f1f9f2; color: #23713d; }
.admin-order-item { display: block; }
.admin-order-id { color: #293a2e; font-size: 27rpx; font-weight: 700; }
.admin-order-foot { margin-top: 18rpx; }
.admin-picker { min-width: 142rpx; height: 54rpx; padding: 0 12rpx; border: 1rpx solid #a9cbb1; border-radius: 6rpx; background: #f3faf4; color: #25713e; font-size: 23rpx; line-height: 54rpx; text-align: center; }
.admin-modal-mask { position: fixed; z-index: 30; inset: 0; display: flex; align-items: flex-end; background: rgba(18, 35, 23, 0.45); }
.admin-modal { box-sizing: border-box; width: 100%; max-height: 90vh; overflow-y: auto; padding: 34rpx 32rpx calc(34rpx + env(safe-area-inset-bottom)); border-radius: 12rpx 12rpx 0 0; background: #fff; }
.admin-modal-product { display: block; margin-top: 12rpx; color: #6b786f; font-size: 25rpx; }
.admin-field-label { display: block; margin-top: 28rpx; color: #3e5044; font-size: 26rpx; }
.admin-field { margin-top: 12rpx; }
.admin-image-editor { display: flex; align-items: center; gap: 18rpx; margin-top: 22rpx; }
.admin-image-preview, .admin-image-empty { flex: 0 0 150rpx; width: 150rpx; height: 150rpx; border-radius: 8rpx; background: #edf5ed; }
.admin-image-empty { display: flex; align-items: center; justify-content: center; padding: 16rpx; box-sizing: border-box; color: #7a887e; font-size: 23rpx; text-align: center; }
.admin-image-button { min-height: 64rpx; padding: 0 22rpx; border: 1rpx solid #71ae82; border-radius: 8rpx; background: #f1f9f2; color: #23713d; font-size: 25rpx; line-height: 64rpx; }
.admin-field-row { display: flex; gap: 16rpx; }
.admin-field-row > view { min-width: 0; flex: 1; }
.admin-field-row .admin-field-label { white-space: nowrap; }
.admin-textarea { box-sizing: border-box; width: 100%; height: 144rpx; margin-top: 12rpx; padding: 18rpx 24rpx; border: 1rpx solid #cbd9cd; border-radius: 8rpx; background: #f8fbf8; color: #26382c; font-size: 28rpx; line-height: 1.5; }
.admin-sale-check { display: flex; align-items: center; gap: 8rpx; margin-top: 24rpx; color: #526258; font-size: 26rpx; }
.admin-modal-actions { display: flex; gap: 18rpx; margin-top: 34rpx; }
.admin-modal-actions button { flex: 1; }
</style>
