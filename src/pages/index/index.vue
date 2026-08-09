<script setup lang="ts">
import { computed, ref } from 'vue'
import { useShopStore } from '../../stores/shop'
import ProductCard from '../../components/ProductCard.vue'
import MerchantAdmin from '../../components/MerchantAdmin.vue'
import { productImages } from '../../utils/productImages'
import { callCloud } from '../../utils/cloud'
import type { Address, CartItem, Product } from '../../types'

const shop = useShopStore()
type View = 'home' | 'category' | 'search' | 'detail' | 'cart' | 'checkout' | 'success' | 'orders' | 'order-detail' | 'address' | 'ai' | 'admin'
const view = ref<View>('home')
const keyword = ref('')
const activeCategory = ref<string>('水果')
const sort = ref('综合')
const detailProduct = ref<Product | null>(null)
const detailQty = ref(1)
const buyNowLines = ref<CartItem[] | null>(null)
const showLogin = ref(false)
const showAddressForm = ref(false)
const editingAddress = ref<Address | null>(null)
const addressDraft = ref<Address>({ id: '', receiver: '', phone: '', detail: '', isDefault: true })
const addressError = ref('')
const savingAddress = ref(false)
const submittingOrder = ref(false)
const deliverySlot = ref('今天 16:00-19:00')
const selectedAddressId = ref('')
const remark = ref('')
const useCoupon = ref(true)
const aiImage = ref('')
const aiImageType = ref('image/jpeg')
const aiResult = ref('')
const aiLoading = ref(false)
const orderSuccessId = ref('')
const orderFilter = ref('全部')

const homeFeatured = computed(() => shop.productsState.filter(p => p.tags.includes('推荐')).slice(0, 4))
const homeNew = computed(() => shop.productsState.filter(p => p.tags.includes('新鲜')).slice(0, 4))
const homeHot = computed(() => [...shop.productsState].filter(p => p.tags.includes('热销')).sort((a, b) => b.sales - a.sales).slice(0, 4))
const searchResults = computed(() => keyword.value ? shop.productsState.filter(p => `${p.name}${p.category}${p.origin}${p.spec}`.includes(keyword.value)) : [])
const categoryResults = computed(() => {
  const list = shop.productsState.filter(p => p.category === activeCategory.value)
  return [...list].sort((a, b) => sort.value === '销量' ? b.sales - a.sales : sort.value === '价格低到高' ? a.price - b.price : sort.value === '价格高到低' ? b.price - a.price : Number(b.tags.includes('推荐')) - Number(a.tags.includes('推荐')))
})
const checkoutLines = computed(() => buyNowLines.value ? buyNowLines.value.map(line => ({ ...line, product: shop.productById(line.productId) })).filter(line => line.product) : shop.selectedLines)
const checkoutSubtotal = computed(() => checkoutLines.value.reduce((sum, line) => sum + (line.product?.price || 0) * line.quantity, 0))
const checkoutDelivery = computed(() => checkoutSubtotal.value >= 29 ? 0 : 3)
const checkoutCoupon = computed(() => useCoupon.value ? 3 : 0)
const checkoutTotal = computed(() => Math.max(0, checkoutSubtotal.value + checkoutDelivery.value - checkoutCoupon.value))
const selectedAddress = computed(() => shop.addresses.find(item => item.id === selectedAddressId.value) || shop.addresses.find(item => item.isDefault) || shop.addresses[0])
const currentOrder = computed(() => shop.orders.find(order => order.id === orderSuccessId.value) || shop.orders[0])
const filteredOrders = computed(() => orderFilter.value === '全部' ? shop.orders : shop.orders.filter(order => order.status === orderFilter.value))

function money(value: number) { return `¥${value.toFixed(2)}` }
function stockLabel(product: Product) { if (!product.onSale) return '已下架'; if (product.stock <= 0) return '暂时缺货'; if (product.stock <= 10) return `库存紧张 ${product.stock}`; return `有货 ${product.stock}` }
function productAvailable(product: Product) { return product.onSale && product.stock > 0 }
function go(next: View) { view.value = next; if (next === 'cart') selectedAddressId.value = shop.addresses.find(item => item.isDefault)?.id || '' }
function requireLogin(next: () => void) { if (shop.auth) return next(); showLogin.value = true }
async function completeLogin() {
  try {
    await shop.login()
    showLogin.value = false
  } catch (error) {
    shop.notify(error instanceof Error ? error.message : '登录失败，请稍后重试')
  }
}
function openProduct(product: Product) { detailProduct.value = product; detailQty.value = 1; go('detail') }
function search() { if (!keyword.value.trim()) return shop.notify('请输入商品关键词'); keyword.value = keyword.value.trim(); shop.recordSearch(keyword.value); go('search') }
function searchHistory(item: string) { keyword.value = item; search() }
function setCategory(category: string) { activeCategory.value = category; go('category') }
function addProduct(product: Product, quantity = 1) { requireLogin(() => shop.addToCart(product, quantity)) }
function buyNow() { if (!detailProduct.value) return; requireLogin(() => { buyNowLines.value = [{ productId: detailProduct.value!.id, quantity: detailQty.value, selected: true, snapshotPrice: detailProduct.value!.price }]; go('checkout') }) }
function checkoutCart() { requireLogin(() => { buyNowLines.value = null; selectedAddressId.value = shop.addresses.find(item => item.isDefault)?.id || ''; go('checkout') }) }
async function submitOrder() {
  if (submittingOrder.value) return
  if (!selectedAddress.value) return shop.notify('请先添加收货地址')
  if (!deliverySlot.value) return shop.notify('请选择配送时段')
  submittingOrder.value = true
  try {
    const order = await shop.createOrder({ address: selectedAddress.value, deliverySlot: deliverySlot.value, remark: remark.value, coupon: checkoutCoupon.value, buyNow: buyNowLines.value || undefined })
    orderSuccessId.value = order.id
    go('success')
  } catch (error) {
    shop.notify(error instanceof Error ? error.message : '订单提交失败，请稍后重试')
  } finally {
    submittingOrder.value = false
  }
}
function openOrder(id: string) { orderSuccessId.value = id; go('order-detail') }
function setOrderFilter(status: string) { orderFilter.value = status }
function openAddressForm(address?: Address) {
  editingAddress.value = address || null
  addressDraft.value = address ? { ...address } : { id: '', receiver: '', phone: '', detail: '', isDefault: shop.addresses.length === 0 }
  addressError.value = ''
  showAddressForm.value = true
}
function onPhoneInput(event: { detail?: { value?: string } }) {
  addressDraft.value.phone = String(event.detail?.value || '').replace(/\D/g, '').slice(0, 11)
  addressError.value = ''
}
async function saveAddress() {
  if (savingAddress.value) return
  const receiver = addressDraft.value.receiver.trim()
  const phone = addressDraft.value.phone.replace(/\D/g, '')
  const detail = addressDraft.value.detail.trim()
  addressDraft.value = { ...addressDraft.value, receiver, phone, detail }
  if (!receiver) { addressError.value = '请输入收货人姓名'; return }
  if (!/^1[3-9]\d{9}$/.test(phone)) { addressError.value = '请输入正确的 11 位手机号'; return }
  if (detail.length < 6) { addressError.value = '详细地址至少填写 6 个字'; return }
  savingAddress.value = true
  try {
    await shop.saveAddress({ ...addressDraft.value, id: addressDraft.value.id || `a${Date.now()}` })
    addressError.value = ''
    showAddressForm.value = false
    shop.notify('地址已保存')
  } catch (error) {
    addressError.value = error instanceof Error ? error.message : '地址保存失败，请稍后重试'
  } finally {
    savingAddress.value = false
  }
}
async function deleteAddress(id: string) {
  try {
    await shop.deleteAddress(id)
    shop.notify('地址已删除')
  } catch (error) {
    shop.notify(error instanceof Error ? error.message : '地址删除失败，请稍后重试')
  }
}
async function setDefaultAddress(id: string) {
  try {
    await shop.setDefaultAddress(id)
    shop.notify('默认地址已更新')
  } catch (error) {
    shop.notify(error instanceof Error ? error.message : '默认地址更新失败，请稍后重试')
  }
}
function selectAddress(id: string) { selectedAddressId.value = id; go('checkout') }
async function refund(id: string) {
  try {
    if (await shop.applyRefund(id)) shop.notify('退款申请已提交')
  } catch (error) {
    shop.notify(error instanceof Error ? error.message : '退款申请失败，请稍后重试')
  }
}
async function cancelOrder(id: string) {
  try {
    if (await shop.cancelOrder(id)) shop.notify('订单已取消')
  } catch (error) {
    shop.notify(error instanceof Error ? error.message : '取消订单失败，请稍后重试')
  }
}
async function logout() {
  try {
    await shop.logout()
  } catch (error) {
    shop.notify(error instanceof Error ? error.message : '退出登录失败，请稍后重试')
  }
}
function chooseAiImage() {
  // In H5 this remains a working demo without requiring a device camera.
  if (typeof uni !== 'undefined') {
    uni.chooseImage({ count: 1, sourceType: ['album', 'camera'], success: (result) => {
      const tempFile = result.tempFiles?.[0]
      const selectedPath = tempFile?.path || result.tempFilePaths[0]
      aiImageType.value = tempFile?.type || 'image/jpeg'
      aiResult.value = ''
      uni.compressImage({
        src: selectedPath,
        quality: 70,
        success: compressed => {
          aiImage.value = compressed.tempFilePath
          aiImageType.value = 'image/jpeg'
        },
        fail: () => { aiImage.value = selectedPath },
      })
    } })
    return
  }
  shop.notify('请在微信开发者工具中使用相册或相机上传')
}
async function runAi() {
  if (!aiImage.value) return shop.notify('请先上传食材照片')
  if (aiLoading.value) return
  if (typeof uniCloud === 'undefined' || typeof uniCloud.uploadFile !== 'function') {
    return shop.notify('当前运行环境不支持云端识别，请从 HBuilderX 运行到微信开发者工具')
  }
  aiLoading.value = true
  aiResult.value = ''
  try {
    const upload = await uniCloud.uploadFile({
      filePath: aiImage.value,
      cloudPath: `ai/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`,
    })
    const result = await callCloud<{ text: string }>('recognizeIngredient', { fileID: upload.fileID, mimeType: aiImageType.value })
    aiResult.value = `识别结果：${result.text}`
  } catch (error) {
    shop.notify(error instanceof Error ? error.message : 'AI 识别失败，请稍后重试')
  } finally {
    aiLoading.value = false
  }
}
function cartItem(id: string) { return shop.cart.find(item => item.productId === id) }
function imageSrc(value: unknown) { return typeof value === 'string' ? value.trim() : '' }
function orderImage(item: { productId: string; image?: unknown }) {
  return productImages[item.productId]
    || imageSrc(item.image)
    || imageSrc(shop.productById(item.productId)?.image)
}
</script>

<template>
  <view class="app-shell" :class="{ 'subpage-shell': !['home', 'category', 'search'].includes(view) }">
    <view class="top-safe" />
    <view v-if="['home', 'category', 'search'].includes(view)" class="app-header">
      <view class="brand-row">
        <view><text class="brand-name">鲜达集市</text><text class="brand-sub">新鲜到家，安心每一餐</text></view>
      </view>
      <view class="search-bar" @click="go('search')"><text class="search-icon">⌕</text><input v-model="keyword" placeholder="搜索水果、蔬菜、牛奶" confirm-type="search" @confirm="search" @click.stop /><button @click.stop="search">搜索</button></view>
    </view>

    <scroll-view class="page-scroll" scroll-y>
      <view v-if="view === 'home'" class="page-content">
        <view class="hero-banner"><view class="hero-copy-block"><text class="eyebrow">TODAY'S FRESH PICK</text><text class="hero-title">把新鲜，送到家门口</text><text class="hero-copy">主城区 10 公里内，当日两段时段配送</text><button class="hero-action" @click="go('category')">去逛逛 <text>→</text></button></view><view class="hero-stamp">鲜<br/>达</view><!-- #ifdef MP-WEIXIN --><view class="hero-ring" /><!-- #endif --></view>
        <view class="quick-row"><button @click="go('ai')"><text class="quick-icon">✦</text><view class="quick-copy"><text class="quick-title">AI 食材助手</text><text class="quick-note">拍照识别与简介</text></view><text class="arrow">›</text></button><button @click="go('orders')"><text class="quick-icon orange">▣</text><view class="quick-copy"><text class="quick-title">我的订单</text><text class="quick-note">{{ shop.orders.length ? `已有 ${shop.orders.length} 笔订单` : '查看订单状态' }}</text></view><text class="arrow">›</text></button></view>
        <view class="section-head"><view><text class="section-title">逛逛分类</text><text class="section-note">今天想吃什么</text></view><button class="text-button" @click="go('category')">全部分类 ›</button></view>
        <scroll-view scroll-x class="category-scroll"><button v-for="category in shop.categories" :key="category" class="category-chip" @click="setCategory(category)"><text class="category-icon">{{ category === '水果' ? '◉' : category === '蔬菜' ? '✿' : category === '肉禽蛋奶' ? '◆' : category === '水产' ? '≈' : category === '粮油调味' ? '▦' : '●' }}</text><text>{{ category }}</text></button></scroll-view>
        <view class="section-head"><view><text class="section-title">为你推荐</text><text class="section-note">精选今日好物</text></view><button class="text-button" @click="setCategory('水果')">查看更多 ›</button></view>
        <view class="product-grid"><ProductCard v-for="product in homeFeatured" :key="product.id" :product="product" :cart="cartItem(product.id)" @open="openProduct" @add="addProduct" @change="(qty) => qty ? shop.updateQuantity(product.id, qty) : shop.removeCart(product.id)" /></view>
        <view class="section-head"><view><text class="section-title">新鲜上架</text><text class="section-note">近期开售好物</text></view><button class="text-button" @click="setCategory('蔬菜')">查看更多 ›</button></view>
        <view class="product-grid"><ProductCard v-for="product in homeNew" :key="product.id" :product="product" :cart="cartItem(product.id)" @open="openProduct" @add="addProduct" @change="(qty) => qty ? shop.updateQuantity(product.id, qty) : shop.removeCart(product.id)" /></view>
        <view class="section-head"><view><text class="section-title">大家都在买</text><text class="section-note">按销量排序</text></view><button class="text-button" @click="setCategory('肉禽蛋奶')">查看更多 ›</button></view>
        <view class="product-grid"><ProductCard v-for="product in homeHot" :key="product.id" :product="product" :cart="cartItem(product.id)" @open="openProduct" @add="addProduct" @change="(qty) => qty ? shop.updateQuantity(product.id, qty) : shop.removeCart(product.id)" /></view>
      </view>

      <view v-else-if="view === 'category' || view === 'search'" class="page-content">
        <view class="subpage-head"><button class="back-button" @click="go('home')">‹</button><view><text class="page-title">{{ view === 'search' ? '搜索商品' : activeCategory }}</text><text class="page-caption">{{ view === 'search' ? (keyword ? `“${keyword}”的搜索结果` : '热门搜索') : `${categoryResults.length} 件商品` }}</text></view></view>
        <view v-if="view === 'search' && !keyword" class="search-guide"><text class="block-title">最近搜索</text><view class="tag-row"><button v-for="item in shop.history" :key="item" class="soft-tag" @click="searchHistory(item)">{{ item }}</button><button v-if="shop.history.length" class="clear-button" @click="shop.history = []">清空</button></view><text class="block-title hot-title">热门搜索</text><view class="tag-row"><button v-for="item in ['蓝莓','牛奶','草莓','三文鱼','上海青']" :key="item" class="soft-tag" @click="searchHistory(item)">{{ item }}</button></view></view>
        <view v-if="view === 'category'" class="category-tabs"><button v-for="category in shop.categories" :key="category" :class="['tab', { active: activeCategory === category }]" @click="setCategory(category)">{{ category }}</button></view>
        <view v-if="view === 'category'" class="sort-row"><text class="result-count">共 {{ categoryResults.length }} 件</text><view class="sort-tabs"><button v-for="item in ['综合','销量','价格低到高','价格高到低']" :key="item" :class="['sort-tab', { active: sort === item }]" @click="sort = item">{{ item }}</button></view></view>
        <view v-if="(view === 'search' && keyword && searchResults.length) || (view === 'category' && categoryResults.length)" class="product-grid list-grid"><ProductCard v-for="product in (view === 'search' ? searchResults : categoryResults)" :key="product.id" :product="product" :cart="cartItem(product.id)" @open="openProduct" @add="addProduct" @change="(qty) => qty ? shop.updateQuantity(product.id, qty) : shop.removeCart(product.id)" /></view>
        <view v-else-if="view === 'search' && keyword" class="empty-state"><text class="empty-icon">⌕</text><text class="empty-title">没有找到相关商品</text><text class="empty-copy">换个关键词试试，或者浏览全部商品</text><button class="primary-button" @click="go('category')">查看全部商品</button></view>
      </view>

      <view v-else-if="view === 'detail' && detailProduct" class="page-content detail-page">
        <view class="subpage-head"><button class="back-button" @click="go('category')">‹</button><view><text class="page-title">商品详情</text></view></view>
         <view class="detail-media"><image class="detail-image" :src="detailProduct.image" mode="aspectFill" /></view>
        <view class="detail-intro"><view class="tag-row"><text v-for="tag in detailProduct.tags" :key="tag" class="product-tag">{{ tag }}</text><text class="stock-badge">{{ stockLabel(detailProduct) }}</text></view><text class="detail-name">{{ detailProduct.name }}</text><text class="detail-desc">{{ detailProduct.description || `${detailProduct.origin}直采，精选规格，冷链或适宜方式保存。` }}</text><view class="detail-price"><text>{{ money(detailProduct.price) }}</text><small>/ {{ detailProduct.unit }}</small></view></view>
        <view class="info-panel"><text class="block-title">商品信息</text><view class="info-grid"><view><small>规格</small><text>{{ detailProduct.spec }}</text></view><view><small>产地</small><text>{{ detailProduct.origin }}</text></view><view><small>保鲜提示</small><text>{{ detailProduct.freshness }}</text></view><view><small>累计销量</small><text>{{ detailProduct.sales }}+ </text></view></view></view>
        <view class="quantity-panel"><view><text class="block-title">购买数量</text><text class="panel-note">每次最多购买当前库存</text></view><view class="quantity-control"><button :disabled="detailQty <= 1" @click="detailQty--">−</button><text>{{ detailQty }}</text><button :disabled="detailQty >= detailProduct.stock" @click="detailQty++">＋</button></view></view>
        <view class="bottom-action"><button class="secondary-button" :disabled="!productAvailable(detailProduct)" @click="addProduct(detailProduct, detailQty)">加入购物车</button><button class="primary-button" :disabled="!productAvailable(detailProduct)" @click="buyNow">立即购买</button></view>
      </view>

      <view v-else-if="view === 'cart'" class="page-content">
        <view class="subpage-head"><view><text class="page-title">购物车</text><text class="page-caption">{{ shop.cartCount }} 件商品</text></view><text class="auth-caption">{{ shop.auth ? '已登录' : '登录后可结算' }}</text></view>
         <view v-if="shop.cartLines.length" class="cart-list"><view v-for="line in shop.cartLines" :key="line.productId" :class="['cart-item', { invalid: line.invalid }]" ><button class="check-button" :class="{ checked: line.selected && !line.invalid }" :disabled="line.invalid" @click="shop.toggleCart(line.productId)">{{ line.selected && !line.invalid ? '✓' : '' }}</button><view class="cart-product-thumb"><image class="cart-product-image" :src="imageSrc(line.product?.image)" mode="aspectFill" /></view><view class="cart-main"><view class="cart-title-row"><text class="cart-name">{{ line.product!.name }}</text><button class="delete-button" @click="shop.removeCart(line.productId)">删除</button></view><text class="cart-meta">{{ line.product!.spec }} · {{ line.invalid ? '商品已失效' : stockLabel(line.product!) }}</text><view class="cart-bottom"><text class="price-text">{{ money(line.product!.price) }}</text><view class="quantity-control small"><button :disabled="line.quantity <= 1 || line.invalid" @click="shop.updateQuantity(line.productId, line.quantity - 1)">−</button><text>{{ line.quantity }}</text><button :disabled="line.quantity >= line.product!.stock || line.invalid" @click="shop.updateQuantity(line.productId, line.quantity + 1)">＋</button></view></view></view></view></view>
        <view v-else class="empty-state cart-empty"><text class="empty-icon">▢</text><text class="empty-title">购物车还是空的</text><text class="empty-copy">去挑几样新鲜食材吧</text><button class="primary-button" @click="go('home')">去逛逛</button></view>
        <view v-if="shop.cartLines.length" class="cart-summary"><view><text>已选 {{ shop.selectedLines.reduce((sum, item) => sum + item.quantity, 0) }} 件</text><strong>{{ money(shop.selectedAmount) }}</strong></view><button class="primary-button" :disabled="!shop.selectedLines.length" @click="checkoutCart">去结算</button></view>
      </view>

      <view v-else-if="view === 'checkout'" class="page-content checkout-page">
        <view class="subpage-head"><button class="back-button" @click="go(buyNowLines ? 'detail' : 'cart')">‹</button><view><text class="page-title">确认订单</text><text class="page-caption">作品展示模式，不产生真实支付或配送</text></view></view>
        <view class="checkout-section address-section" @click="go('address')"><view><text class="section-label">配送地址</text><text v-if="selectedAddress" class="address-main">{{ selectedAddress.receiver }} {{ selectedAddress.phone }}</text><text v-if="selectedAddress" class="address-detail">{{ selectedAddress.detail }}</text><text v-else class="address-empty">请添加收货地址</text></view><text class="arrow">›</text></view>
        <view class="checkout-section"><text class="section-label">选择配送时段</text><view class="slot-row"><button v-for="slot in ['今天 10:00-12:00','今天 16:00-19:00']" :key="slot" :class="['slot-button', { active: deliverySlot === slot }]" @click="deliverySlot = slot">{{ slot }}</button></view></view>
        <view class="checkout-section"><view class="section-line"><text class="section-label">商品清单</text><text class="muted">{{ checkoutLines.length }} 种商品</text></view><view v-for="line in checkoutLines" :key="line.productId" class="checkout-item"><view class="checkout-product-thumb"><image class="checkout-product-image" :src="imageSrc(line.product?.image)" mode="aspectFill" /></view><view><text>{{ line.product!.name }}</text><small>{{ line.product!.unit }} × {{ line.quantity }}</small></view><strong>{{ money((line.product!.price || 0) * line.quantity) }}</strong></view></view>
        <view class="checkout-section"><view class="section-line"><text class="section-label">测试优惠券</text><button class="coupon-switch" :class="{ active: useCoupon }" @click="useCoupon = !useCoupon">{{ useCoupon ? '已使用 · 配送券' : '不使用' }}</button></view><text class="coupon-note">演示优惠：减免 {{ money(3) }}，仅用于项目展示</text></view>
        <view class="checkout-section"><text class="section-label">订单备注</text><textarea v-model="remark" class="remark-input" maxlength="100" placeholder="选填，例如：请放在门卫处" /></view>
        <view class="price-panel"><view><text>商品金额</text><strong>{{ money(checkoutSubtotal) }}</strong></view><view><text>配送费</text><strong>{{ checkoutDelivery ? money(checkoutDelivery) : '免配送费' }}</strong></view><view><text>优惠金额</text><strong class="discount">-{{ money(checkoutCoupon) }}</strong></view><view class="total-line"><text>应付金额</text><strong>{{ money(checkoutTotal) }}</strong></view></view>
         <view class="bottom-action checkout-action"><view><text>演示金额</text><strong>{{ money(checkoutTotal) }}</strong></view><button class="primary-button" :disabled="submittingOrder" @click="requireLogin(submitOrder)">{{ submittingOrder ? '提交中...' : '演示下单' }}</button></view>
      </view>

      <view v-else-if="view === 'success' && currentOrder" class="page-content success-page"><view class="success-mark">✓</view><text class="success-title">演示订单已提交</text><text class="success-copy">本项目仅用于作品展示，不产生真实支付、配送或售后</text><view class="success-card"><view><span>订单编号</span><strong>{{ currentOrder.id }}</strong></view><view><span>配送时段</span><strong>{{ currentOrder.deliverySlot }}</strong></view><view><span>演示金额</span><strong>{{ money(currentOrder.totalAmount) }}</strong></view></view><view class="success-actions"><button class="primary-button" @click="openOrder(currentOrder.id)">查看订单</button><button class="secondary-button" @click="go('home')">返回首页</button></view></view>

      <view v-else-if="view === 'orders'" class="page-content"><view class="subpage-head"><view><text class="page-title">我的订单</text><text class="page-caption">跟进每一笔新鲜到家</text></view><text class="auth-caption">{{ shop.orders.length }} 笔</text></view><view class="order-account-bar"><text class="auth-caption">{{ shop.auth ? '当前已登录' : '登录后可查看订单' }}</text><button class="order-auth-button" @click="shop.auth ? logout() : (showLogin = true)">{{ shop.auth ? '退出登录' : '登录' }}</button></view><view class="order-tabs"><button v-for="status in ['全部','待备货','配送中','已完成','退款申请中']" :key="status" :class="['sort-tab', { active: orderFilter === status }]" @click="setOrderFilter(status)">{{ status }}</button></view><view v-if="filteredOrders.length" class="order-list"><view v-for="order in filteredOrders" :key="order.id" class="order-card" @click="openOrder(order.id)"><view class="section-line"><text class="order-number">{{ order.id }}</text><text class="status-text">{{ order.status }}</text></view><text class="order-time">{{ order.createdAt }} · {{ order.deliverySlot }}</text><view class="order-products"><view v-for="item in order.items.slice(0, 3)" :key="item.productId" class="order-product-thumb"><image class="order-product-image" :src="orderImage(item)" mode="aspectFill" /></view><text v-if="order.items.length > 3">+{{ order.items.length - 3 }}</text></view><view class="section-line order-bottom"><text>{{ order.items.reduce((sum, item) => sum + item.quantity, 0) }} 件商品</text><strong>{{ money(order.totalAmount) }}</strong></view></view></view><view v-else class="empty-state"><text class="empty-icon">◌</text><text class="empty-title">还没有订单</text><text class="empty-copy">完成一次下单后就能在这里查看</text><button class="primary-button" @click="go('home')">去逛逛</button></view></view>

      <view v-else-if="view === 'admin'" class="page-content admin-page"><MerchantAdmin @back="go('orders')" /></view>

      <view v-if="view === 'orders'" class="merchant-entry-wrap"><button class="merchant-entry" @click="go('admin')">店铺管理</button></view>

      <view v-else-if="view === 'order-detail' && currentOrder" class="page-content"><view class="subpage-head"><button class="back-button" @click="go('orders')">‹</button><view><text class="page-title">订单详情</text><text class="page-caption">{{ currentOrder.id }}</text></view><text class="status-text">{{ currentOrder.status }}</text></view><view class="status-banner"><text>{{ currentOrder.status === '待备货' ? '商家正在准备你的商品' : currentOrder.status === '配送中' ? '商品正在前往你身边' : currentOrder.status }}</text><text>{{ currentOrder.deliverySlot }}</text></view><view class="checkout-section"><text class="section-label">商品明细</text><view v-for="item in currentOrder.items" :key="item.productId" class="checkout-item"><view class="checkout-product-thumb"><image class="checkout-product-image" :src="orderImage(item)" mode="aspectFill" /></view><view><text>{{ item.name }}</text><small>{{ item.unit }} × {{ item.quantity }}</small></view><strong>{{ money(item.price * item.quantity) }}</strong></view></view><view class="checkout-section"><text class="section-label">收货信息</text><text class="address-main">{{ currentOrder.address.receiver }} {{ currentOrder.address.phone }}</text><text class="address-detail">{{ currentOrder.address.detail }}</text></view><view class="price-panel"><view><text>商品金额</text><strong>{{ money(currentOrder.productAmount) }}</strong></view><view><text>配送费</text><strong>{{ currentOrder.deliveryFee ? money(currentOrder.deliveryFee) : '免配送费' }}</strong></view><view><text>优惠金额</text><strong class="discount">-{{ money(currentOrder.coupon) }}</strong></view><view class="total-line"><text>订单总额</text><strong>{{ money(currentOrder.totalAmount) }}</strong></view></view><view class="detail-buttons"><button v-if="['待付款','待备货'].includes(currentOrder.status)" class="secondary-button danger-outline" @click="cancelOrder(currentOrder.id)">取消订单</button><button v-if="['待备货','配送中','已完成'].includes(currentOrder.status)" class="secondary-button" @click="refund(currentOrder.id)">申请退款</button></view></view>

      <view v-else-if="view === 'address'" class="page-content"><view class="subpage-head"><button class="back-button" @click="go('checkout')">‹</button><view><text class="page-title">地址管理</text><text class="page-caption">配送范围：主城区 10 公里内</text></view></view><view class="address-list"><view v-for="address in shop.addresses" :key="address.id" class="address-card" :class="{ selected: selectedAddressId === address.id }" @click="selectAddress(address.id)"><view class="address-card-head"><text class="address-name">{{ address.receiver }} <small>{{ address.phone }}</small></text><text v-if="address.isDefault" class="default-tag">默认</text></view><text class="address-detail">{{ address.detail }}</text><view class="address-actions"><button @click.stop="setDefaultAddress(address.id)">设为默认</button><button @click.stop="openAddressForm(address)">编辑</button><button @click.stop="deleteAddress(address.id)">删除</button></view></view></view><button class="primary-button add-address" @click="openAddressForm()">＋ 新增地址</button></view>

      <view v-else-if="view === 'ai'" class="page-content ai-page"><view class="subpage-head"><button class="back-button" @click="go('home')">‹</button><view><text class="page-title">AI 食材助手</text><text class="page-caption">图片识别与保存建议</text></view></view><view class="ai-hero"><text class="ai-spark">✦</text><text class="ai-title">拍一张，认识你的食材</text><text class="ai-copy">上传食材照片，生成分类、保存建议和简单做法。</text></view><view class="ai-upload" @click="chooseAiImage"><image v-if="aiImage" :src="aiImage" mode="aspectFill" /><view v-else><text class="upload-icon">＋</text><text>上传食材照片</text><small>支持相册或相机</small></view></view><button class="primary-button ai-button" :disabled="!aiImage || aiLoading" @click="runAi">{{ aiLoading ? '识别中...' : '开始识别' }}</button><view v-if="aiResult" class="ai-result"><text class="section-label">识别结果</text><text>{{ aiResult }}</text></view></view>
    </scroll-view>

    <view v-if="['home','category','search','cart','orders'].includes(view)" class="bottom-nav"><button :class="{ active: view === 'home' }" @click="go('home')"><text>⌂</text><small>首页</small></button><button :class="{ active: view === 'category' || view === 'search' }" @click="go('category')"><text>▦</text><small>分类</small></button><button :class="{ active: view === 'cart' }" @click="go('cart')"><view class="nav-icon-wrap"><text>▣</text><view v-if="shop.cartCount" class="cart-badge">{{ shop.cartCount }}</view></view><small>购物车</small></button><button :class="{ active: view === 'orders' }" @click="go('orders')"><text>≡</text><small>订单</small></button></view>

    <view v-if="shop.toastMessage" class="toast">{{ shop.toastMessage }}</view>
    <view v-if="showLogin" class="modal-mask"><view class="login-modal"><view class="modal-icon">✓</view><text class="modal-title">登录后继续</text><text class="modal-copy">登录后可以保存地址、提交订单并查看配送进度。</text><button class="primary-button" @click="completeLogin">微信一键登录（演示）</button><button class="text-button" @click="showLogin = false">先看看</button></view></view>
      <view v-if="showAddressForm" class="modal-mask"><view class="address-modal"><view class="section-line address-modal-head"><text class="modal-title">{{ editingAddress ? '编辑地址' : '新增地址' }}</text><button class="close-button" @click="showAddressForm = false">×</button></view><input v-model="addressDraft.receiver" maxlength="20" placeholder="收货人姓名" @input="addressError = ''" /><input :value="addressDraft.phone" maxlength="11" placeholder="手机号" type="text" @input="onPhoneInput" /><textarea v-model="addressDraft.detail" maxlength="100" placeholder="详细地址，如道路、门牌号" @input="addressError = ''" /><text v-if="addressError" class="address-error">{{ addressError }}</text><label class="default-check"><checkbox :checked="addressDraft.isDefault" @click="addressDraft.isDefault = !addressDraft.isDefault" />设为默认地址</label><button class="primary-button address-save-button" :disabled="savingAddress" @click.stop="saveAddress">{{ savingAddress ? '保存中...' : '保存地址' }}</button></view></view>
  </view>
</template>

<style scoped>
.merchant-entry-wrap { padding: 0 18px 20px; }
.merchant-entry { width: 100%; height: 42px; border: 1px solid #c8dccb; border-radius: 10px; background: #fff; color: #287543; font-size: 12px; font-weight: 800; line-height: 42px; text-align: center; }
</style>
