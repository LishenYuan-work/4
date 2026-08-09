import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
/* #ifdef MP-WEIXIN */
import './styles.mp-weixin.css'
/* #endif */
/* #ifndef MP-WEIXIN */
import './styles.css'
import './home-fixes.css'
/* #endif */

export function createApp() {
  const app = createSSRApp(App)
  app.use(createPinia())
  return { app }
}
