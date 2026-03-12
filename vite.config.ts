import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import contentKeysPlugin from './vite-plugin-content-keys.js';

export default defineConfig({
  plugins: [react(), contentKeysPlugin()],
  optimizeDeps: {
    exclude: ['lucide-react'],
    // Force React pre-bundling
    include: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-dom/client'
    ]
  },
  server: {
    historyApiFallback: true,
  },
  build: {
    chunkSizeWarningLimit: 600,
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2020',
    // CRITICAL: Prevent circular dependency
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // Force React into its own chunk - MUST load first
          'vendor-react': [
            'react',
            'react-dom',
            'react/jsx-runtime',
            'react-dom/client'
          ],
          // Router separate
          'vendor-router': ['react-router-dom'],
          // Toast separate
          'vendor-toast': ['react-hot-toast'],
          // Supabase separate
          'vendor-supabase': ['@supabase/supabase-js'],
        },
        // CRITICAL: Ensure consistent chunk order
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  // CRITICAL: Prevent React duplication
  resolve: {
    dedupe: ['react', 'react-dom', 'react-router-dom'],
  },
});