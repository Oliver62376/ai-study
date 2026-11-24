export type UploadMode = 'text' | 'ocr' | 'vision'
export type HomeMode = 'board' | 'chat'
export type LessonIntent = 'topic' | 'exam' | 'homework'
export type NotebookPageNav = 'vertical' | 'horizontal'
export type MaterialPanelMode = 'material' | 'quiz' | 'notebook'

export interface AppPreferences {
  uploadMode: UploadMode
  ttsRate: number
  ttsPitch: number
  ttsVoice: string
  homeMode: HomeMode
  lessonIntent: LessonIntent
  notebookPageNav: NotebookPageNav
  voiceAutoSend: boolean
  laserEnabled: boolean
  laserSizePx: number
  pauseAfterSentenceMs: number
  pauseOnPageTurnMs: number
  materialPanel: MaterialPanelMode
  /** 進入課堂後自動開啟語音輸入（不錄原聲） */
  autoMicInClass: boolean
}

const KEY = 'ai-study-prefs-v1'

export function defaultPreferences(): AppPreferences {
  return {
    uploadMode: 'text',
    ttsRate: 0.82,
    ttsPitch: 1,
    ttsVoice: '',
    homeMode: 'board',
    lessonIntent: 'topic',
    notebookPageNav: 'vertical',
    voiceAutoSend: false,
    laserEnabled: true,
    laserSizePx: 18,
    pauseAfterSentenceMs: 1500,
    pauseOnPageTurnMs: 2000,
    materialPanel: 'material',
    autoMicInClass: true,
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

export const lessonIntentLabels: Record<LessonIntent, string> = {
  topic: '主題',
  exam: '備考',
  homework: '作業',
}

export const uploadModeLabels: Record<UploadMode, string> = {
  text: '只擷取文字（PDF 內建文字層）',
  ocr: '無文字時逐頁轉圖並本機 OCR',
  vision: '圖片／掃描頁以圖送給支援視覺的模型',
}