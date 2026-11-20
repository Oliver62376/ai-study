import type { PageTemplate } from './stylus-prefs'

export interface InkPoint {
  x: number
  y: number
  p?: number
}

export interface InkStroke {
  id: string
  tool: 'pen' | 'fountain' | 'highlighter' | 'shape'
  color: string
  width: number
  points: InkPoint[]
  shape?: 'line' | 'rect' | 'ellipse'
}

export interface TextBox {
  id: string
  x: number
  y: number
  w: number
  h: number
  text: string
  color: string
  fontSize: number
}

export interface PageSticker {
  id: string
  x: number
  y: number
  w: number
  h: number
  dataUrl: string
}

export interface NotePage {
  id: string
  title: string
  template: PageTemplate
  paperColor?: string
  caption: string
  strokes: InkStroke[]
  texts: TextBox[]
  stickers: PageSticker[]
  background?: string
  preview?: string
  updatedAt: number
}

export interface Notebook {
  id: string
  title: string
  folderId?: string
  pages: NotePage[]
  updatedAt: number
}

const KEY = 'ai-study-notebooks-v2'
const LEGACY = 'ai-study-notebook-v1'
const MAX_BOOKS = 32
const MAX_PAGES = 120

export function newId(prefix: string) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

function migrateLegacy(): Notebook[] {
  try {
    const raw = localStorage.getItem(LEGACY)
    if (!raw) return []
    const list = JSON.parse(raw) as { id: string; title: string; caption: string; marks: { color: string; points: string }[]; preview?: string; updatedAt: number }[]
    if (!Array.isArray(list) || !list.length) return []
    const pages: NotePage[] = list.map((item) => ({
      id: item.id,
      title: item.title,
      template: 'ruled' as const,
      caption: item.caption ?? '',
      strokes: (item.marks ?? []).map((mark, index) => ({
        id: `s${index}`,
        tool: 'pen' as const,
        color: mark.color,
        width: 3,
        points: mark.points.split(' ').map((pair) => {
          const [x, y] = pair.split(',').map(Number)
          return { x, y, p: 0.6 }
        }),
      })),
      texts: [],
      stickers: [],
      preview: item.preview,
      updatedAt: item.updatedAt,
    }))
    const book: Notebook = {
      id: newId('B'),
      title: '匯入的筆記',
      pages,
      updatedAt: Date.now(),
    }
    localStorage.removeItem(LEGACY)
    return [book]
  } catch {
    return []
  }
}

export function loadNotebooks(): Notebook[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) {
      const migrated = migrateLegacy()
      if (migrated.length) {
        write(migrated)
        return migrated
      }
      return [defaultNotebook()]
    }
    const list = JSON.parse(raw) as Notebook[]
    return Array.isArray(list) && list.length ? list : [defaultNotebook()]
  } catch {
    return [defaultNotebook()]
  }
}

function write(books: Notebook[]) {
  localStorage.setItem(KEY, JSON.stringify(books.slice(0, MAX_BOOKS)))
}

export function defaultNotebook(): Notebook {
  const page = emptyPage('第 1 頁')
  return { id: newId('B'), title: '我的筆記', pages: [page], updatedAt: Date.now() }
}

export function emptyPage(title: string, template: PageTemplate = 'ruled', paperColor = '#fbfaf7'): NotePage {
  return {
    id: newId('P'),
    title,
    template,
    paperColor,
    caption: '',
    strokes: [],
    texts: [],
    stickers: [],
    updatedAt: Date.now(),
  }
}

export function bookCover(book: Notebook) {
  return book.pages[0]?.preview ?? book.pages[0]?.background ?? ''
}

export function moveNotebookToFolder(bookId: string, folderId: string | undefined) {
  const list = loadNotebooks().map((item) => (item.id === bookId ? { ...item, folderId } : item))
  saveNotebooks(list)
}

export function renameNotebook(bookId: string, title: string) {
  const list = loadNotebooks().map((item) => (item.id === bookId ? { ...item, title: title.trim() || item.title } : item))
  saveNotebooks(list)
}

export function saveNotebooks(books: Notebook[]) {
  write(books.map((book) => ({ ...book, updatedAt: Date.now() })))
}

export function upsertNotebook(book: Notebook) {
  const list = loadNotebooks().filter((item) => item.id !== book.id)
  saveNotebooks([{ ...book, pages: book.pages.slice(0, MAX_PAGES) }, ...list])
}

export function deleteNotebook(id: string) {
  const next = loadNotebooks().filter((item) => item.id !== id)
  saveNotebooks(next.length ? next : [defaultNotebook()])
}

export function pageToTeachingBundle(page: NotePage, bookTitle: string) {
  const lines = [
    `【筆記本：${bookTitle}｜${page.title}】`,
    page.caption.trim() ? `重點：${page.caption.trim()}` : '（含手寫筆記，請結合附圖）',
  ]
  if (page.preview) lines.push('【附圖：筆記頁面】')
  return { text: lines.join('\n'), imageDataUrl: page.preview ?? null }
}

export interface HistoryState {
  strokes: InkStroke[]
  texts: TextBox[]
  stickers: PageSticker[]
}

export function snapshotPage(page: NotePage): HistoryState {
  return {
    strokes: structuredClone(page.strokes),
    texts: structuredClone(page.texts),
    stickers: structuredClone(page.stickers),
  }
}

export function applySnapshot(page: NotePage, snap: HistoryState): NotePage {
  return { ...page, ...snap, updatedAt: Date.now() }
}