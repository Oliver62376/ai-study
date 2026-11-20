export type UploadMode = 'text' | 'ocr' | 'vision'
export type HomeMode = 'board' | 'chat'
export type NotebookPageNav = 'vertical' | 'horizontal'

export interface AppPreferences {
  uploadMode: UploadMode
  ttsRate: number
  ttsPitch: number
  ttsVoice: string
  homeMode: HomeMode
  notebookPageNav: NotebookPageNav
}

const KEY = 'ai-study-prefs-v1'

export function defaultPreferences(): AppPreferences {
  return {
    uploadMode: 'text',
    ttsRate: 0.92,
    ttsPitch: 1,
    ttsVoice: '',
    homeMode: 'board',
    notebookPageNav: 'vertical',
  }
}

export function loadPreferences(): AppPreferences {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultPreferences()
    const saved = JSON.parse(raw) as Partial<AppPreferences>
    return { ...defaultPreferences(), ...saved }
  } catch {
    return defaultPreferences()
  }
}

export function savePreferences(prefs: AppPreferences) {
  localStorage.setItem(KEY, JSON.stringify(prefs))
}

export const uploadModeLabels: Record<UploadMode, string> = {
  text: '只擷取文字（PDF 內建文字層）',
  ocr: '無文字時逐頁轉圖並本機 OCR',
  vision: '圖片／掃描頁以圖送給支援視覺的模型',
}