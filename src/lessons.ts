import type { Persist } from './model'

export interface LessonRecord {
  id: string
  title: string
  updatedAt: number
  snapshot: Persist
}

const KEY = 'ai-study-lessons-v1'
const MAX = 24

export function loadLessons(): LessonRecord[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as LessonRecord[]
    return Array.isArray(list) ? list.filter((item) => item?.id && item?.snapshot?.course) : []
  } catch {
    return []
  }
}

function write(list: LessonRecord[]) {
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
}

export function upsertLesson(snapshot: Persist) {
  if (!snapshot.course) return
  const title = snapshot.course.title.trim() || '未命名課程'
  const list = loadLessons()
  const existing = list.find((item) => item.title === title && item.snapshot.course?.source === snapshot.course?.source)
  const record: LessonRecord = {
    id: existing?.id ?? `L${Date.now()}`,
    title,
    updatedAt: Date.now(),
    snapshot: {
      ...snapshot,
      laser: null,
    },
  }
  const next = [record, ...list.filter((item) => item.id !== record.id)]
  write(next)
}

export function deleteLesson(id: string) {
  write(loadLessons().filter((item) => item.id !== id))
}

export function lessonById(id: string) {
  return loadLessons().find((item) => item.id === id) ?? null
}