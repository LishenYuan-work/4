const https = require('https')
const db = uniCloud.database()
const seedProducts = require('./seed')

const collections = {
  products: db.collection('fresh_products'),
  users: db.collection('fresh_users'),
  addresses: db.collection('fresh_addresses'),
  orders: db.collection('fresh_orders'),
}

const DELIVERY_SLOTS = ['今天 10:00-12:00', '今天 16:00-19:00']
const ORDER_STATUSES = ['待付款', '待备货', '配送中', '已完成', '已取消', '退款申请中', '已退款', '退款驳回']

function clientInfo(context) {
  return typeof context.getClientInfo === 'function' ? context.getClientInfo() || {} : {}
}

function ownerId(context) {
  const info = clientInfo(context)
  return info.openid || info.unionid || `demo:${info.clientIP || 'local'}`
}

function adminAllowed(context, adminKey) {
  const info = clientInfo(context)
  const configuredKeys = String(process.env.FRESH_ADMIN_KEYS || '').split(',').map(item => item.trim()).filter(Boolean)
  const configuredOpenids = String(process.env.FRESH_ADMIN_OPENIDS || '').split(',').map(item => item.trim()).filter(Boolean)
  return (adminKey && configuredKeys.includes(adminKey)) || (info.openid && configuredOpenids.includes(info.openid))
}

function fail(message, code = 'BAD_REQUEST') {
  const error = new Error(message)
  error.code = code
  throw error
}

function requestJson(url, headers, body) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, response => {
      let raw = ''
      response.setEncoding('utf8')
      response.on('data', chunk => { raw += chunk })
      response.on('end', () => {
        let data
        try {
          data = JSON.parse(raw || '{}')
        } catch {
          reject(new Error('AI 服务返回了无法解析的结果'))
          return
        }
        if ((response.statusCode || 500) >= 400) {
          reject(new Error(data.error?.message || data.message || data.code || 'AI 服务调用失败'))
          return
        }
        resolve(data)
      })
    })
    request.on('error', reject)
    request.setTimeout(30000, () => request.destroy(new Error('AI 服务响应超时，请稍后重试')))
    request.write(body)
    request.end()
  })
}

function withTimeout(promise, milliseconds, message) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), milliseconds)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, response => {
      if ((response.statusCode || 500) >= 400) {
        response.resume()
        reject(new Error('无法读取已上传的图片'))
        return
      }
      const chunks = []
      let total = 0
      response.on('data', chunk => {
        total += chunk.length
        if (total > 8 * 1024 * 1024) {
          response.destroy()
          reject(new Error('图片不能超过 8MB'))
          return
        }
        chunks.push(chunk)
      })
      response.on('end', () => resolve(Buffer.concat(chunks)))
    })
    request.setTimeout(15000, () => request.destroy(new Error('图片下载超时，请重新选择图片')))
    request.on('error', reject)
  })
}

function normalizeProduct(product) {
  return {
    id: String(product.id), name: String(product.name || ''), category: String(product.category || ''),
    price: Math.max(0, Number(product.price || 0)), unit: String(product.unit || ''),
    stock: Math.max(0, Math.floor(Number(product.stock || 0))), sales: Math.max(0, Math.floor(Number(product.sales || 0))),
    origin: String(product.origin || ''), spec: String(product.spec || ''), freshness: String(product.freshness || ''),
    description: String(product.description || ''),
    image: String(product.image || ''), tags: Array.isArray(product.tags) ? product.tags.map(String) : [], onSale: product.onSale !== false,
  }
}

async function ensureSeedProducts() {
  const existing = await collections.products.limit(1).get()
  if (existing.data.length) return

  // The first storefront request provisions demo products so setup does not depend on HBuilderX cloud debugging.
  await collections.products.add(seedProducts.map(normalizeProduct))
}

async function listProducts(query = {}) {
  const collection = collections.products
  await ensureSeedProducts()
  const where = {}
  if (query.category) where.category = query.category
  const result = await collection.where(where).orderBy('sales', 'desc').limit(100).get()
  return result.data.map(normalizeProduct)
}

async function findProducts(ids) {
  await ensureSeedProducts()
  const wanted = [...new Set(ids.map(String))]
  const result = await collections.products.where({ id: db.command.in(wanted) }).get()
  return wanted.map(id => result.data.find(product => product.id === id)).filter(Boolean).map(normalizeProduct)
}

function orderStatus(status) {
  return ORDER_STATUSES.includes(status) ? status : '待备货'
}

function validateAddress(address) {
  if (!address || typeof address !== 'object') fail('收货地址不能为空')
  if (!String(address.receiver || '').trim()) fail('收货人不能为空')
  if (!/^1[3-9]\d{9}$/.test(String(address.phone || ''))) fail('手机号格式不正确')
  if (String(address.detail || '').trim().length < 6) fail('详细地址至少填写 6 个字')
}

function updateCount(result) {
  return Number(result?.updated || result?.matched || 0)
}

async function getStoreData(context) {
  const uid = ownerId(context)
  const [products, addresses, orders] = await Promise.all([
    listProducts(),
    collections.addresses.where({ ownerId: uid }).orderBy('createdAt', 'desc').get(),
    collections.orders.where({ ownerId: uid }).orderBy('createdAt', 'desc').limit(100).get(),
  ])
  return { authenticated: !uid.startsWith('anonymous:'), products, addresses: addresses.data, orders: orders.data }
}

module.exports = {
  async getStoreData() {
    return getStoreData(this)
  },

  async recognizeIngredient(payload = {}) {
    const apiKey = String(process.env.DASHSCOPE_API_KEY || '').trim()
    if (!apiKey) fail('AI 服务尚未配置，请在 uniCloud 环境变量中设置 DASHSCOPE_API_KEY', 'AI_NOT_CONFIGURED')

    const fileID = String(payload.fileID || '').trim()
    if (!fileID) fail('没有收到食材图片，请重新选择图片')
    const tempResult = await withTimeout(uniCloud.getTempFileURL({ fileList: [fileID] }), 10000, '获取图片地址超时，请重新选择图片')
    const tempFile = tempResult?.fileList?.[0]
    if (!tempFile?.tempFileURL) fail('图片上传失败，请重新选择图片')
    const imageBuffer = await withTimeout(downloadBuffer(tempFile.tempFileURL), 15000, '图片下载超时，请重新选择图片')
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    const mimeType = allowedMimeTypes.includes(String(payload.mimeType)) ? String(payload.mimeType) : 'image/jpeg'

    const requestBody = JSON.stringify({
      model: String(process.env.QWEN_MODEL || 'qwen-vl-plus'),
      input: {
        messages: [{
          role: 'user',
          content: [
            { image: `data:${mimeType};base64,${imageBuffer.toString('base64')}` },
            { text: '请识别图片中的主要食材。用简体中文简要返回：食材名称、类别、保存建议和一种简单做法。不要猜测图片中没有的内容；如果不是食材，请明确说明。' },
          ],
        }],
      },
      parameters: { result_format: 'message' },
    })
    const response = await withTimeout(requestJson('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
      Authorization: `Bearer ${apiKey}`,
    }, requestBody), 40000, '千问服务响应超时，请稍后重试')
    const content = response?.output?.choices?.[0]?.message?.content
    const text = Array.isArray(content)
      ? content.map(item => typeof item === 'string' ? item : item?.text).filter(Boolean).join('')
      : String(content || '')
    if (!text.trim()) fail('AI 没有返回识别结果，请换一张图片重试')
    return { text: text.trim() }
  },

  async login(payload = {}) {
    const uid = ownerId(this)
    const now = Date.now()
    await collections.users.doc(uid).set({ ownerId: uid, nickname: String(payload.nickname || '微信用户'), updatedAt: now, createdAt: now })
    return { authenticated: !uid.startsWith('anonymous:'), userId: uid }
  },

  async logout() {
    return { authenticated: false }
  },

  async saveAddress(address = {}) {
    const uid = ownerId(this)
    if (uid.startsWith('anonymous:')) fail('请先完成微信登录', 'UNAUTHORIZED')
    validateAddress(address)
    const businessId = String(address.id || `a${Date.now()}`)
    const data = { id: businessId, receiver: String(address.receiver), phone: String(address.phone), detail: String(address.detail), isDefault: address.isDefault === true, ownerId: uid, updatedAt: Date.now() }
    if (data.isDefault) await collections.addresses.where({ ownerId: uid }).update({ isDefault: false, updatedAt: Date.now() })
    const existing = await collections.addresses.where({ ownerId: uid, id: businessId }).limit(1).get()
    if (existing.data.length) await collections.addresses.doc(existing.data[0]._id).update(data)
    else await collections.addresses.add({ ...data, createdAt: Date.now() })
    const current = await collections.addresses.where({ ownerId: uid }).get()
    if (current.data.length && !current.data.some(item => item.isDefault === true)) {
      await collections.addresses.doc(current.data[0]._id).update({ isDefault: true, updatedAt: Date.now() })
    }
    return getStoreData(this)
  },

  async deleteAddress(id) {
    const uid = ownerId(this)
    if (!id) fail('地址编号不能为空')
    const target = await collections.addresses.where({ id: String(id), ownerId: uid }).limit(1).get()
    if (!target.data.length) return getStoreData(this)
    const wasDefault = target.data[0].isDefault === true
    await collections.addresses.doc(target.data[0]._id).remove()
    if (wasDefault) {
      const replacement = await collections.addresses.where({ ownerId: uid }).orderBy('createdAt', 'asc').limit(1).get()
      if (replacement.data.length) await collections.addresses.doc(replacement.data[0]._id).update({ isDefault: true, updatedAt: Date.now() })
    }
    return getStoreData(this)
  },

  async setDefaultAddress(id) {
    const uid = ownerId(this)
    if (!id) fail('地址编号不能为空')
    const target = await collections.addresses.where({ id: String(id), ownerId: uid }).limit(1).get()
    if (!target.data.length) fail('地址不存在')
    await collections.addresses.where({ ownerId: uid }).update({ isDefault: false, updatedAt: Date.now() })
    await collections.addresses.doc(target.data[0]._id).update({ isDefault: true, updatedAt: Date.now() })
    return getStoreData(this)
  },

  async createOrder(payload = {}) {
    const uid = ownerId(this)
    if (uid.startsWith('anonymous:')) fail('请先完成微信登录', 'UNAUTHORIZED')
    const lines = Array.isArray(payload.items) ? payload.items : []
    if (!lines.length) fail('订单没有商品')
    validateAddress(payload.address)
    if (!DELIVERY_SLOTS.includes(String(payload.deliverySlot || ''))) fail('配送时段无效')
    const quantities = new Map()
    for (const line of lines) {
      const productId = String(line?.productId || '')
      const quantity = Number(line?.quantity)
      if (!productId || !Number.isInteger(quantity) || quantity < 1) fail('订单商品数量无效')
      quantities.set(productId, (quantities.get(productId) || 0) + quantity)
    }
    const products = await findProducts([...quantities.keys()])
    const items = [...quantities.entries()].map(([productId, quantity]) => {
      const product = products.find(item => item.id === productId)
      if (!product || !product.onSale || product.stock < quantity) fail(`商品库存不足：${product?.name || productId}`)
      return { productId: product.id, name: product.name, image: product.image, unit: product.unit, price: product.price, quantity }
    })
    if (items.length !== quantities.size) fail('订单中包含不存在的商品')
    const productAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const deliveryFee = productAmount >= 29 ? 0 : 3
    const coupon = Math.min(productAmount + deliveryFee, Math.max(0, Number(payload.coupon || 0)))
    const orderId = String(payload.orderId || `S${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
    const existing = await collections.orders.where({ ownerId: uid, id: orderId }).limit(1).get()
    if (existing.data.length) return existing.data[0]
    const order = {
      id: orderId, ownerId: uid, status: '待备货', createdAt: Date.now(), items, address: payload.address,
      deliverySlot: String(payload.deliverySlot), productAmount, deliveryFee,
      coupon, totalAmount: Math.max(0, productAmount + deliveryFee - coupon), remark: String(payload.remark || ''),
      paymentStatus: '已支付',
    }
    const reserved = []
    try {
      for (const item of items) {
        const result = await collections.products.where({ id: item.productId, onSale: true, stock: db.command.gte(item.quantity) }).update({ stock: db.command.inc(-item.quantity), sales: db.command.inc(item.quantity) })
        if (!updateCount(result)) fail(`商品库存不足：${item.name}`)
        reserved.push(item)
      }
      const result = await collections.orders.add(order)
      return { ...order, _id: result.id }
    } catch (error) {
      for (const item of reserved) {
        await collections.products.where({ id: item.productId }).update({ stock: db.command.inc(item.quantity), sales: db.command.inc(-item.quantity) })
      }
      throw error
    }
  },

  async adminSeedProducts(payload = {}) {
    payload = payload || {}
    if (!adminAllowed(this, payload.adminKey)) fail('管理员权限不足', 'FORBIDDEN')
    const existing = await collections.products.limit(1).get()
    if (existing.data.length && payload.force !== true) return { inserted: 0, message: '商品已初始化，未重复写入' }
    if (payload.force === true) await collections.products.where({}).remove()
    await collections.products.add(seedProducts.map(normalizeProduct))
    return { inserted: seedProducts.length }
  },

  async checkAdminAccess(payload = {}) {
    payload = payload || {}
    return { allowed: adminAllowed(this, payload.adminKey) }
  },

  async adminList(payload = {}) {
    payload = payload || {}
    if (!adminAllowed(this, payload.adminKey)) fail('管理员权限不足', 'FORBIDDEN')
    let products = await collections.products.limit(100).get()
    if (!products.data.length) {
      await collections.products.add(seedProducts.map(normalizeProduct))
      products = await collections.products.limit(100).get()
    }
    const orders = await collections.orders.orderBy('createdAt', 'desc').limit(200).get()
    return { products: products.data, orders: orders.data }
  },

  async adminUpdateProduct(payload = {}) {
    payload = payload || {}
    if (!adminAllowed(this, payload.adminKey)) fail('管理员权限不足', 'FORBIDDEN')
    if (!payload.id) fail('商品编号不能为空')
    const patch = {}
    if (payload.price !== undefined && (!Number.isFinite(Number(payload.price)) || Number(payload.price) < 0)) fail('商品价格无效')
    if (payload.stock !== undefined && (!Number.isInteger(Number(payload.stock)) || Number(payload.stock) < 0)) fail('商品库存无效')
    if (payload.onSale !== undefined && typeof payload.onSale !== 'boolean') fail('商品上下架状态无效')
    if (payload.tags !== undefined && (!Array.isArray(payload.tags) || payload.tags.some(item => typeof item !== 'string' || item.length > 20))) fail('商品标签无效')
    for (const key of ['name', 'category', 'unit', 'origin', 'spec', 'freshness', 'description', 'image']) {
      if (payload[key] === undefined) continue
      const maxLength = key === 'description' ? 500 : key === 'image' ? 1000 : 100
      if (typeof payload[key] !== 'string' || payload[key].trim().length > maxLength) fail(`商品${key}无效`)
      patch[key] = payload[key].trim()
    }
    for (const key of ['price', 'stock', 'onSale', 'tags']) if (payload[key] !== undefined) patch[key] = payload[key]
    patch.updatedAt = Date.now()
    const result = await collections.products.where({ id: String(payload.id) }).update(patch)
    if (!updateCount(result)) fail('商品不存在')
    return { ok: true }
  },

  async adminUpdateOrderStatus(payload = {}) {
    payload = payload || {}
    if (!adminAllowed(this, payload.adminKey)) fail('管理员权限不足', 'FORBIDDEN')
    if (!payload.id) fail('订单编号不能为空')
    const result = await collections.orders.where({ id: String(payload.id) }).update({ status: orderStatus(payload.status), updatedAt: Date.now() })
    if (!updateCount(result)) fail('订单不存在')
    return { ok: true }
  },

  async updateOrderStatus(payload = {}) {
    const uid = ownerId(this)
    if (!payload.id) fail('订单编号不能为空')
    const result = await collections.orders.where({ id: String(payload.id), ownerId: uid }).limit(1).get()
    if (!result.data.length) fail('订单不存在')
    const current = result.data[0].status
    const next = orderStatus(payload.status)
    const allowed = (next === '已取消' && ['待付款', '待备货'].includes(current)) || (next === '退款申请中' && ['待备货', '配送中', '已完成'].includes(current))
    if (!allowed) fail('当前订单状态不允许此操作')
    await collections.orders.doc(result.data[0]._id).update({ status: next, updatedAt: Date.now() })
    return { ok: true, status: next }
  },
}
