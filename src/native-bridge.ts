import type { VisionPage } from './ocr'
import type { Persist } from './model'

export type NativeClassBoot = {
  topic: string
  fileText: string
  vision?: VisionPage[]
  lessonId?: string
  /** 原生「我的課」已存的備課快照，重開時直接回放、不再打 API */
  snapshot?: Persist
}

declare global {
  interface Window {
    aiStudyNativeBoot?: NativeClassBoot
  }
}

export function consumeNativeClassBoot(): NativeClassBoot | null {
  const boot = window.aiStudyNativeBoot
  if (!boot) return null
  if (!boot.topic?.trim() && !boot.fileText?.trim()) return null
  delete window.aiStudyNativeBoot
  return boot
}