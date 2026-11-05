import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' — сборка работает из любого подкаталога (GitHub Pages), маршруты на hash.
export default defineConfig({
  plugins: [react()],
  base: './',
});
