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
    port: 5173,       // Força a porta que liberamos no Firewall
    strictPort: true, // Se a porta 5173 estiver ocupada, ele dá erro em vez de mudar para 5174
    watch: {
      usePolling: true, // Ajuda a detectar mudanças em alguns ambientes VPS/Docker
    }
  }
})