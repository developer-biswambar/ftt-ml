import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./testing/setup.js'],
    include: ['testing/integration/**/*.{test,spec}.{js,jsx}'],
    exclude: ['testing/e2e/**/*'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@testing': resolve(__dirname, './testing'),
    },
  },
})