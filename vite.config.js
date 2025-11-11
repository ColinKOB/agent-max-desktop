import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@app': path.resolve(process.cwd(), 'src'),
      '@features': path.resolve(process.cwd(), 'src/features'),
      '@shared': path.resolve(process.cwd(), 'src/shared'),
      '@lib': path.resolve(process.cwd(), 'src/lib'),
      '@electron': path.resolve(process.cwd(), 'electron'),
    },
  },
  base: './',
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
      },
      mangle: {
        // Obfuscate variable names
        toplevel: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor code for better caching and obfuscation
          vendor: ['react', 'react-dom'],
          ui: ['lucide-react'],
          api: ['axios', '@supabase/supabase-js'],
        },
      },
    },
  },
});
