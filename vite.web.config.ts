import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'

const webTags: Record<string, string> = {
  view: 'div',
  text: 'span',
  'scroll-view': 'div',
  image: 'img',
  badge: 'span',
  checkbox: 'input',
}

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          nodeTransforms: [
            (node) => {
              if (node.type === 1 && webTags[node.tag]) node.tag = webTags[node.tag]
            },
          ],
        },
      },
    }),
  ],
  server: { host: '0.0.0.0', port: 5173 },
  build: {
    outDir: 'dist/web',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
})
