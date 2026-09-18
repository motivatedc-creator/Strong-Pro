/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['brand/*.svg', 'brand/*.png', 'icons/*.svg'],
      manifest: {
        name: "Lock'd — Workout Tracker",
        short_name: 'Lockd',
        description:
          'A local-first workout log: keep the receipt. Templates, analytics, measurements and plate math — offline, on your device.',
        theme_color: '#0a0a0b',
        background_color: '#0a0a0b',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['health', 'fitness', 'productivity'],
        icons: [
          { src: 'brand/app-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          {
            src: 'brand/app-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        cleanupOutdatedCaches: true,
        // Take control on the first load so the very next navigation already works
        // offline; updates still wait for an explicit prompt (skipWaiting stays off).
        clientsClaim: true,
        navigateFallback: 'index.html',
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    restoreMocks: true,
  },
});
