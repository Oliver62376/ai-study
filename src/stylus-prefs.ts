export type StylusAction =
  | 'pen'
  | 'fountain'
  | 'highlighter'
  | 'eraser'
  | 'lasso'
  | 'undo'
  | 'redo'
  | 'ai'
  | 'toggle_tool'
  | 'none'

export type PageTemplate = 'blank' | 'ruled' | 'grid' | 'dot'

export interface StylusPreferences {
  /** 書寫時忽略手掌／大面積觸控 */
  palmRejection: boolean
  /** 筆離開後仍拒絕觸控的毫秒數 */
  palmRejectionMs: number
  /** 僅 Apple Pencil 可畫墨（手指只能平移／按鈕） */
  pencilOnly: boolean
  /** 依壓感調整筆跡粗細 */
  pressure: boolean
  barrelButton1: StylusAction
  barrelButton2: StylusAction
  doubleTap: StylusAction
  eraserEnd: StylusAction
}

const KEY = 'ai-study-stylus-v1'

export const stylusActionLabels: Record<StylusAction, string> = {
  pen: '原子筆',
  fountain: '鋼筆',
  highlighter: '螢光筆',
  eraser: '橡皮擦',
  lasso: '套索',
  undo: '復原',
  redo: '重做',
  ai: '筆記 AI',
  toggle_tool: '切換上次的工具',
  none: '無',
}

export function defaultStylusPreferences(): StylusPreferences {
  return {
    palmRejection: true,
    palmRejectionMs: 650,
    pencilOnly: false,
    pressure: true,
    barrelButton1: 'eraser',
    barrelButton2: 'toggle_tool',
    doubleTap: 'highlighter',
    eraserEnd: 'eraser',
  }
}

export function loadStylusPreferences(): StylusPreferences {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultStylusPreferences()
    return { ...defaultStylusPreferences(), ...(JSON.parse(raw) as StylusPreferences) }
  } catch {
    return defaultStylusPreferences()
  }
}

export function saveStylusPreferences(prefs: StylusPreferences) {
  localStorage.setItem(KEY, JSON.stringify(prefs))
}

export function runStylusAction(
  action: StylusAction,
  handlers: {
    setTool: (tool: 'pen' | 'fountain' | 'highlighter' | 'eraser' | 'lasso') => void
    undo: () => void
    redo: () => void
    openAi: () => void
    toggleTool: () => void
  },
) {
  switch (action) {
    case 'pen':
      handlers.setTool('pen')
      break
    case 'fountain':
      handlers.setTool('fountain')
      break
    case 'highlighter':
      handlers.setTool('highlighter')
      break
    case 'eraser':
      handlers.setTool('eraser')
      break
    case 'lasso':
      handlers.setTool('lasso')
      break
    case 'undo':
      handlers.undo()
      break
    case 'redo':
      handlers.redo()
      break
    case 'ai':
      handlers.openAi()
      break
    case 'toggle_tool':
      handlers.toggleTool()
      break
    default:
      break
  }
}