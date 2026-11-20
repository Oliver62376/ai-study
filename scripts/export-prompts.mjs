import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const version = pkg.version

const desktop = path.join(process.env.USERPROFILE || process.env.HOME || '', 'Desktop', 'ai-study-prompts')
fs.mkdirSync(desktop, { recursive: true })

const hint = '（可留空；白板 JSON 工具指令由 App 自動附加，請勿寫在這裡。）\n\n'

const files = {
  'README-提示詞說明.txt': [
    'AI Study 自訂提示詞說明',
    `版本 ${version}`,
    '',
    '此資料夾內的 txt 可編輯後，在 App「設定 → 提示詞」匯入或貼上。',
    '',
    '【永遠由 App 內建、不需也不應寫入 txt】',
    '- 白板講課 JSON（say、highlights）',
    '- 備課課程結構 JSON（sections、steps、reveals）',
    '- 測驗 JSON（questions）',
    '',
    '【可自訂的 txt】',
    '- 備課 / 講課風格 / Chat / 筆記AI / 測驗',
    '',
  ].join('\n'),
  '備課-自訂提示詞.txt': `${hint}例：多用生活例子，板書少字多圖示。`,
  'Chat-自訂提示詞.txt': `${hint}例：先一句結論，再分步說明。`,
  '筆記AI-自訂提示詞.txt': `${hint}例：解釋手寫筆記時多提醒易錯點。`,
  '測驗-自訂提示詞.txt': `${hint}例：題目情境化。`,
  '講課風格-自訂提示詞.txt': `${hint}例：語氣像耐心班導（不含白板工具語法）。`,
}

for (const [name, body] of Object.entries(files)) {
  fs.writeFileSync(path.join(desktop, name), body, 'utf8')
}

console.log(`Wrote ${Object.keys(files).length} files to ${desktop}`)