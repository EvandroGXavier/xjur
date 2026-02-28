import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // --- CONFIGURAÇÃO DE SERVIDOR (ACESSO EXTERNO) ---
  server: {
    host: true,       // Isso libera o acesso pelo IP da VPS (0.0.0.0)
    port: 5173,       // Tenta a porta 5173 primeiro
    strictPort: false, // Alterado para false: Se a 5173 estiver presa, ele usa a 5174 automaticamente (evitando crash)
    watch: {
      usePolling: true, // Ajuda a detectar mudanças em alguns ambientes VPS/Docker
    }
  }
})