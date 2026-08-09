<script setup lang="ts">
import type { CartItem, Product } from '../types'

const props = defineProps<{ product: Product; cart?: CartItem }>()
const emit = defineEmits<{ open: [product: Product]; add: [product: Product]; change: [quantity: number] }>()

function imageSrc(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}
</script>

<template>
  <view class="product-card" @click="emit('open', product)">
    <view class="product-media">
      <image class="product-photo" :src="imageSrc(product.image)" mode="aspectFill" />
    </view>

    <view class="product-card-body">
      <view class="tag-row">
        <text v-for="tag in product.tags.slice(0, 1)" :key="tag" class="product-tag">{{ tag }}</text>
        <text class="stock-mini">{{ product.stock > 0 ? (product.stock <= 10 ? '库存紧张' : '有货') : '缺货' }}</text>
      </view>

      <text class="product-name">{{ product.name }}</text>
      <text class="product-spec">{{ product.spec }} · {{ product.origin }}</text>

      <view class="product-price-row">
        <view class="card-price-block">
          <view class="price-text">
            <text class="price-currency">¥</text>
            <text class="price-value">{{ product.price.toFixed(2) }}</text>
          </view>
          <text class="price-unit">/ {{ product.unit }}</text>
        </view>

        <button v-if="!cart" class="add-button" :disabled="!product.onSale || product.stock <= 0" @click.stop="emit('add', product)">+</button>
        <view v-else class="quantity-control card-control" @click.stop>
          <button :disabled="cart.quantity <= 1" @click="emit('change', cart.quantity - 1)">-</button>
          <text>{{ cart.quantity }}</text>
          <button :disabled="cart.quantity >= product.stock" @click="emit('change', cart.quantity + 1)">+</button>
        </view>
      </view>
    </view>
  </view>
</template>
