import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Servido em https://<user>.github.io/masmorra-sa/
export default defineConfig({
  base: process.env.VITE_BASE ?? '/masmorra-sa/',
  plugins: [react()],
  build: {
    target: 'es2022',
  },
})
