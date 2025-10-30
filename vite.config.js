import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
