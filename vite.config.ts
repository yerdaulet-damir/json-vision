import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the same build works both on the web (served at root)
  // and inside a VS Code webview (assets loaded via vscode-resource URIs).
  base: './',
  plugins: [
    react(),
    tailwindcss(),
  ],
})
