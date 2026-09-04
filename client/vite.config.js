import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000'
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined,
        inlineDynamicImports: true,
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      manifest: {
        name: 'Voice Memory Vault',
        short_name: 'VoiceVault',
        description: 'A premium voice memory tracker',
        theme_color: '#0f0f11',
        background_color: '#0f0f11',
        display: 'standalone',
        icons: [
          {
            src: 'favicon.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: 'favicon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})
