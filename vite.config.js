import { defineConfig } from 'vite'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: 'public',
  publicDir: false,
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index:       resolve(__dirname, 'public/index.html'),
        game:        resolve(__dirname, 'public/game.html'),
        task:        resolve(__dirname, 'public/task.html'),
        unlock:      resolve(__dirname, 'public/unlock.html'),
        leaderboard: resolve(__dirname, 'public/leaderboard.html'),
        vote:        resolve(__dirname, 'public/vote.html'),
        mafia:       resolve(__dirname, 'public/mafia.html'),
        admin:       resolve(__dirname, 'public/admin.html'),
        '404':       resolve(__dirname, 'public/404.html'),
      }
    }
  }
})