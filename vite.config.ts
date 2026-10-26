import { defineConfig } from 'vite';

export default defineConfig({
  base: '/CrazyRun/',
  resolve: {
    alias: [{ find: /^three$/, replacement: 'three/webgpu' }]
  },
  build: {
    // The WebGPU bundle uses native top-level await, which every WebGPU-capable browser supports.
    target: 'esnext',
    // three/webgpu is a single indivisible vendor chunk.
    chunkSizeWarningLimit: 800,
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
