import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
      '@state': fileURLToPath(new URL('./src/state', import.meta.url)),
      '@ui': fileURLToPath(new URL('./src/ui', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Вендор (React + AntD) — отдельным кэшируемым чанком, чтобы правки
        // приложения не инвалидировали тяжёлую библиотеку (§8.2). Ленивая
        // загрузка фоновых атласов — этап E.
        manualChunks: {
          'vendor-antd': ['antd', '@ant-design/icons'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    globals: false,
  },
})
