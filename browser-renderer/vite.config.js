import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/Luna/render/',
  build: {outDir: '../render', emptyOutDir: true}
});
