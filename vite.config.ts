import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'

function listFiles(dir: string, root = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? listFiles(full, root) : [relative(root, full).split('\\').join('/')]
  })
}

/**
 * O service worker só ativa depois que a primeira página já carregou, então
 * nunca veria os arquivos com hash passarem pela rede. A lista é injetada no
 * build para o pré-cache pegar tudo de uma vez — é o que faz o modo avião
 * funcionar já na segunda visita.
 */
function precacheServiceWorker(): Plugin {
  return {
    name: 'precache-service-worker',
    apply: 'build',
    closeBundle() {
      const outDir = 'dist'
      const swPath = join(outDir, 'sw.js')
      const files = listFiles(outDir)
        .filter((f) => f !== 'sw.js' && !f.endsWith('.map'))
      const precache = ['', ...files]
      const source = readFileSync(swPath, 'utf8')
      const buildId = createHash('sha256').update(precache.join('|')).digest('hex').slice(0, 12)
      writeFileSync(
        swPath,
        source
          .replace('__PRECACHE__', JSON.stringify(precache))
          .replace('__BUILD_ID__', buildId),
      )
    },
  }
}

// Servido em https://<user>.github.io/masmorra-sa/
export default defineConfig({
  base: process.env.VITE_BASE ?? '/masmorra-sa/',
  plugins: [react(), precacheServiceWorker()],
  build: {
    target: 'es2022',
  },
})
