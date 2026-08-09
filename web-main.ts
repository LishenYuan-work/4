import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import IndexPage from './src/pages/index/index.vue'
import './src/styles.css'
import './src/home-fixes.css'

const app = createSSRApp(IndexPage)
app.use(createPinia())
app.mount('#app')
