import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Vite 配置
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: '5177'
  }
})
