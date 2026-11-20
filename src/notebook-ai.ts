import { appendExtra, loadCustomPrompts } from './custom-prompts'
import { gradeLabel } from './profile'
import { askProvider, isConnected, loadSettings } from './settings'
import type { VisionPage } from './ocr'

export type NotebookAiMode = 'explain' | 'summarize' | 'quiz' | 'clean'

const prompts: Record<NotebookAiMode, string> = {
  explain: '你是家教。看這頁筆記（含手寫），用繁體中文解釋重點與推論步驟。缺字處合理補齊但不要瞎編。',
  summarize: '整理這頁筆記成條列重點（5 點內），繁體中文，適合考前複習。',
  quiz: '依這頁筆記出 3 題小測驗（含答案與一句檢討），繁體中文，程度符合學生年級。',
  clean: '把筆記內容轉成乾淨的教科書式段落（保留公式與符號），繁體中文。',
}

export async function runNotebookAi(
  mode: NotebookAiMode,
  context: string,
  imageDataUrl: string | null,
): Promise<string> {
  const settings = loadSettings()
  if (!isConnected(settings)) throw new Error('尚未連接模型')
  const vision: VisionPage[] = imageDataUrl ? [{ name: '筆記頁', dataUrl: imageDataUrl }] : []
  const who = gradeLabel()
  const raw = await askProvider(
    settings,
    '請處理這頁筆記。',
    `${context}\n\n（學生年級：${who}）`,
    appendExtra(prompts[mode], loadCustomPrompts().notebook, '筆記 AI 風格補充'),
    vision,
  )
  return (raw ?? '沒有回覆').trim()
}