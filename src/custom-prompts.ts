/** 使用者可改寫的提示詞；白板 JSON 工具規格始終由程式附加，不在此檔。 */

export const APP_VERSION = '0.3.9-beta'

export type PromptSlot = 'plan' | 'chat' | 'notebook' | 'quiz' | 'teach'

export interface CustomPrompts {
  plan: string
  chat: string
  notebook: string
  quiz: string
  /** 講課人格／風格，會加在 boardToolPrompt 之後，不包含白板工具語法 */
  teach: string
}

const KEY = 'ai-study-custom-prompts-v1'

export function defaultCustomPrompts(): CustomPrompts {
  return { plan: '', chat: '', notebook: '', quiz: '', teach: '' }
}

export function loadCustomPrompts(): CustomPrompts {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultCustomPrompts()
    return { ...defaultCustomPrompts(), ...(JSON.parse(raw) as Partial<CustomPrompts>) }
  } catch {
    return defaultCustomPrompts()
  }
}

export function saveCustomPrompts(prompts: CustomPrompts) {
  localStorage.setItem(KEY, JSON.stringify(prompts))
}

export function appendExtra(base: string, extra: string, label: string) {
  const tail = extra.trim()
  if (!tail) return base
  return `${base}\n\n【${label}】\n${tail}`
}

export const promptSlotLabels: Record<PromptSlot, string> = {
  plan: '備課',
  chat: 'Chat',
  notebook: '筆記 AI',
  quiz: '測驗出題',
  teach: '講課風格（不含白板工具）',
}

export const promptTemplateFiles: Record<PromptSlot, string> = {
  plan: '備課-自訂提示詞.txt',
  chat: 'Chat-自訂提示詞.txt',
  notebook: '筆記AI-自訂提示詞.txt',
  quiz: '測驗-自訂提示詞.txt',
  teach: '講課風格-自訂提示詞.txt',
}

export function templateBody(slot: PromptSlot): string {
  const hint = '（可留空；白板 JSON 工具指令由 App 自動附加，請勿寫在這裡。）\n\n'
  const samples: Record<PromptSlot, string> = {
    plan: `${hint}例：多用在生活中舉例，每一步板書少字；需要示意時用 diagram.svg 畫箭頭／圖形，並寫 intent 教學意圖。`,
    chat: `${hint}例：回答先用一句結論，再給步驟，適合國中自學；可引用記憶庫中的學習背景。`,
    notebook: `${hint}例：解釋手寫時假設學生基礎弱，多提醒易錯點。`,
    quiz: `${hint}例：題目情境化，避免純定義背誦。`,
    teach: `${hint}例：語氣像耐心班導；學生卡住時可用 draws 畫小 SVG 示意，並用 teachingIntent 說明這張圖的目的。`,
  }
  return samples[slot]
}

export function readmePromptText(appVersion: string) {
  return [
    'AI Study 自訂提示詞說明',
    `版本 ${appVersion}`,
    '',
    '此資料夾內的 txt 可編輯後，在 App「設定 → 提示詞」匯入或貼上。',
    '',
    '【永遠由 App 內建、不需也不應寫入 txt】',
    '- 白板講課的 JSON 格式（say、highlights、draws／SVG）',
    '- 備課課程結構 JSON（sections、steps、reveals、diagram.svg）',
    '- 測驗題目 JSON（questions）',
    '- 記憶庫條目（在設定 → 記憶庫管理；備課／講課會自動注入）',
    '',
    '【可自訂的 txt】',
    '- 備課-自訂提示詞.txt → 教學風格、科目語氣',
    '- 講課風格-自訂提示詞.txt → 打斷補充時的人格與用語',
    '- Chat / 筆記AI / 測驗 → 各模式語氣與規則',
    '',
    '修改後在 App 內匯入對應欄位並「儲存設定」。',
  ].join('\n')
}

export async function exportPromptPack(appVersion: string) {
  const readme = readmePromptText(appVersion)
  const entries = (Object.keys(promptTemplateFiles) as PromptSlot[]).map((slot) => ({
    name: promptTemplateFiles[slot],
    text: templateBody(slot),
  }))
  return { readme, entries }
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}