import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';

export default defineConfig({
  plugins: [vue()],
  // Lee el .env de la RAÍZ del proyecto. Vite SOLO expone al navegador las variables con
  // prefijo VITE_; las privadas (DB_PASSWORD, JWT_SECRET, SMTP_PASS...) nunca se incluyen.
  // ⚠️ No pongas el prefijo VITE_ a ningún secreto.
  envDir: path.resolve(__dirname, '..'),
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: { port: 5173 },
  build: { sourcemap: false },
});
