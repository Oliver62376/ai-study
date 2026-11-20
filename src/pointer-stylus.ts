import type { PointerEvent as ReactPointerEvent } from 'react'
import { loadStylusPreferences } from './stylus-prefs'

type PointerLike = ReactPointerEvent<HTMLElement> | PointerEvent

/** iPadOS / Safari：Apple Pencil 為 pointerType === 'pen' */
export function isApplePencil(event: PointerLike) {
  return event.pointerType === 'pen'
}

/** Pencil 2 筆尾橡皮擦（多數為 button === 5 或 buttons 含 32） */
export function isPencilEraserEnd(event: PointerLike) {
  if (event.pointerType !== 'pen') return false
  if (event.button === 5) return true
  return (event.buttons & 32) === 32 && event.button !== 0
}

/** 側邊按鈕（barrel） */
export function isPencilBarrel(event: PointerLike) {
  if (event.pointerType !== 'pen') return false
  return event.button === 2 || (event.buttons & 2) === 2
}

class PalmGuard {
  private penDown = new Set<number>()
  private touchBlockedUntil = 0

  private prefs() {
    return loadStylusPreferences()
  }

  shouldIgnore(event: PointerLike, drawingSurface: boolean): boolean {
    const prefs = this.prefs()
    const type = event.pointerType
  const kind = event.type

    if (type === 'pen') {
      if (kind === 'pointerdown') this.penDown.add(event.pointerId)
      if (kind === 'pointerup' || kind === 'pointercancel') {
        this.penDown.delete(event.pointerId)
        if (this.penDown.size === 0) {
          this.touchBlockedUntil = Date.now() + Math.max(200, prefs.palmRejectionMs)
        }
      }
      return false
    }

    if (type === 'mouse') return false

    if (type === 'touch') {
      if (prefs.pencilOnly && drawingSurface) return true
      if (!prefs.palmRejection) return false
      if (this.penDown.size > 0) return true
      if (Date.now() < this.touchBlockedUntil) return true
      const w = 'width' in event ? event.width : 0
      const h = 'height' in event ? event.height : 0
      if (w > 28 || h > 28) return true
    }

    return false
  }

  readingPressure(event: PointerLike) {
    const prefs = this.prefs()
    if (!prefs.pressure) return 0.65
    if (isApplePencil(event) && event.pressure > 0) return event.pressure
    if (event.pointerType === 'touch') return 0.45
    return 0.6
  }
}

export const globalPalmGuard = new PalmGuard()