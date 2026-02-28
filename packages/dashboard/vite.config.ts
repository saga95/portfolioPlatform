import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths({ root: '../..' })],
  root: __dirname,
  build: {
    outDir: '../../dist/packages/dashboard',
    emptyOutDir: true,
    reportCompressedSize: true,
  },
  server: {
    port: 4200,
    host: 'localhost',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    passWithNoTests: true,
    coverage: {
      reportsDirectory: '../../coverage/packages/dashboard',
      provider: 'v8',
    },
  },
});
