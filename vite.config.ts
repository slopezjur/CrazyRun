import { defineConfig } from 'vite';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  base: '/CrazyRun/',
  plugins: [
    topLevelAwait({
      promiseExportName: '__tla',
      promiseImportName: i => `__tla_${i}`
    })
  ],
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) {
            return 'three-vendor';
          }
        }
      }
    }
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext'
    }
  }
});
