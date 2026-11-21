import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const src = path.join(root, 'dist')
const dest = path.join(root, 'native', 'AIStudy', 'Resources', 'WebApp')

if (!fs.existsSync(src)) {
  console.error('dist/ not found — run: npm run build')
  process.exit(1)
}

fs.rmSync(dest, { recursive: true, force: true })
fs.mkdirSync(dest, { recursive: true })
fs.cpSync(src, dest, { recursive: true })
console.log(`Copied web bundle → ${dest}`)