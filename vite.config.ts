import { defineConfig } from 'vite';

export default defineConfig({
  base: '/CrazyRun/',
  resolve: {
    alias: [{ find: /^three$/, replacement: 'three/webgpu' }]
  },
  build: {
    // three/webgpu is a single indivisible vendor chunk.
    chunkSizeWarningLimit: 1000,
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
    // Pre-bundling relocates these loaders and breaks their import.meta.url-relative decoder paths.
    exclude: ['three/examples/jsm/loaders/DRACOLoader.js', 'three/examples/jsm/loaders/KTX2Loader.js']
  }
});
