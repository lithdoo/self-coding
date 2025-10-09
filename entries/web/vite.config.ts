import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    vueDevTools(),
  ],
  server:{
    proxy:{'/ai/':{
      target:'http://localhost:7890/',
      ws:true,
      changeOrigin:true
    }}
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@pkg': fileURLToPath(new URL('../../packages/', import.meta.url)),
      '@proj': fileURLToPath(new URL('../../projects/', import.meta.url))
    },
  },
})
