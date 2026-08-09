import express from 'express'
import cors from 'cors'

const app = express()
const port = process.env.PORT || 8787
const orders = []

app.use(cors())
app.use(express.json({ limit: '2mb' }))

app.get('/api/health', (_, res) => res.json({ ok: true, service: 'fresh-shop-demo-api' }))

app.post('/api/auth/mock-login', (req, res) => {
  res.json({ token: `demo-${Date.now()}`, user: { id: 'demo-user', nickname: req.body?.nickname || '演示用户' } })
})

app.post('/api/orders/validate', (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : []
  const productAmount = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0)
  const deliveryFee = productAmount >= 29 ? 0 : 3
  res.json({ valid: items.length > 0, productAmount, deliveryFee, coupon: Number(req.body?.coupon || 0), totalAmount: Math.max(0, productAmount + deliveryFee - Number(req.body?.coupon || 0)) })
})

app.post('/api/orders', (req, res) => {
  const order = { ...req.body, id: `S${Date.now()}`, status: '待备货', createdAt: new Date().toLocaleString('zh-CN', { hour12: false }) }
  orders.unshift(order)
  res.status(201).json(order)
})

app.get('/api/orders', (_, res) => res.json({ data: orders }))

app.patch('/api/orders/:id/status', (req, res) => {
  const order = orders.find(item => item.id === req.params.id)
  if (!order) return res.status(404).json({ message: '订单不存在' })
  order.status = req.body?.status || order.status
  res.json(order)
})

app.post('/api/ai/recognize', (_, res) => {
  res.json({ category: '叶菜类', title: '新鲜绿叶蔬菜', summary: '建议冷藏保存，清洗后可清炒、白灼或加入汤品。', mode: 'mock' })
})

app.listen(port, () => console.log(`Fresh shop demo API listening on http://localhost:${port}`))
