# 鲜达集市

面向求职面试展示的轻量生鲜商城项目。用户端使用 uni-app + Vue 3 + Pinia，后台使用同一个 Vite 工程的 `/admin.html` 入口，正式后端方案为 uniCloud。

## 在线演示

[打开鲜达集市 H5 演示版](https://lishenyuan001.github.io/2/)

在线演示部署在 GitHub Pages，购物车、地址和订单数据保存在当前浏览器；微信登录、uniCloud 云端数据和小程序专属能力请在微信开发者工具中体验。

## 已实现

- 微信小程序用户端：首页、分类、搜索、商品详情、购物车、地址、配送时段、优惠券、模拟支付、订单、取消订单、退款申请。
- 32 个生鲜示例商品，商品图片保存在 `static/products`，不依赖远程图片域名。
- 简易商家后台：商品上下架、价格库存修改、订单状态更新、退款申请查看。
- AI 食材助手演示：上传图片后返回识别分类和食材简介；真实模型接入应放在后端，不在小程序中暴露 API Key。
- uniCloud 云对象：`uniCloud-aliyun/cloudfunctions/shop`，包含商品、登录、地址、订单和管理员接口。首次读取商品时会自动初始化示例商品。
- 本地演示接口：`server/index.mjs`，仅用于没有云服务空间时的本地调试。

## 运行

```bash
npm install
npm run dev:h5
```

H5 预览地址通常为 `http://localhost:5173`，商家后台为 `http://localhost:5173/admin.html`。

微信小程序：

```bash
npm run build:mp-weixin
```

然后使用微信开发者工具导入 `dist/build/mp-weixin`。首次提交审核前，需要在 `src/manifest.json` 填写小程序 AppID，并按微信要求配置隐私协议、合法域名和登录能力。

后端：

```bash
cd server
npm install
npm run dev
```

用户端现在会优先尝试 uniCloud，云服务未配置时自动回退到本地演示数据。uniCloud 创建、schema 上传、管理员配置和商品初始化步骤见 `docs/unicloud-setup.md`。
