import type { VisionPage } from './ocr'

export type NativeClassBoot = {
  topic: string
  fileText: string
  vision?: VisionPage[]
}

declare global {
  interface Window {
    aiStudyNativeBoot?: NativeClassBoot
  }
}

export function consumeNativeClassBoot(): NativeClassBoot | null {
  const boot = window.aiStudyNativeBoot
  if (!boot?.topic && !boot?.fileText) return null
  delete window.aiStudyNativeBoot
  return boot
}