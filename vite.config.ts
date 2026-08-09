import { defineConfig } from 'vite'
import uniPlugin from '@dcloudio/vite-plugin-uni'

const uni = (uniPlugin as { default?: () => unknown }).default ?? uniPlugin

export default defineConfig({
  plugins: [uni()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      ignored: ['**/static/products/p03.jpg', '**/static/products/p17.jpg'],
    },
  },
})
