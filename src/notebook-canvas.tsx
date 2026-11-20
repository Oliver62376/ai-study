import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { globalPalmGuard, isPencilBarrel, isPencilEraserEnd } from './pointer-stylus'
import { loadStylusPreferences } from './stylus-prefs'
import type { InkPoint, InkStroke, NotePage, TextBox } from './notebook'
import type { PageTemplate } from './stylus-prefs'

export type NbTool = 'pen' | 'fountain' | 'highlighter' | 'eraser' | 'lasso' | 'shape' | 'text'
export type ShapeKind = 'line' | 'rect' | 'ellipse'
export type EraserMode = 'stroke' | 'pixel'

const HIGHLIGHTER = '#ffe14a88'

function widthFor(tool: NbTool, base: number, pressure: number, usePressure: boolean) {
  const p = usePressure ? Math.max(0.15, pressure || 0.5) : 0.7
  if (tool === 'highlighter') return base * 2.4
  if (tool === 'fountain') return base * (0.5 + p * 1.1)
  return base * (0.45 + p * 0.9)
}

function polylineD(points: InkPoint[]) {
  if (points.length < 2) return ''
  return `M${points.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' L')}`
}

function inPolygon(x: number, y: number, poly: InkPoint[]) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x
    const yi = poly[i].y
    const xj = poly[j].x
    const yj = poly[j].y
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function splitStrokeByErase(stroke: InkStroke, x: number, y: number, radius: number): InkStroke[] {
  if (stroke.tool === 'shape') return [stroke]
  const segments: InkPoint[][] = []
  let current: InkPoint[] = []
  for (const pt of stroke.points) {
    const hit = Math.hypot(pt.x - x, pt.y - y) < radius
    if (hit) {
      if (current.length >= 2) segments.push(current)
      current = []
    } else {
      current.push(pt)
    }
  }
  if (current.length >= 2) segments.push(current)
  if (!segments.length) return []
  if (segments.length === 1 && segments[0].length === stroke.points.length) return [stroke]
  return segments.map((points, index) => ({
    ...stroke,
    id: index === 0 ? stroke.id : `${stroke.id}x${index}`,
    points,
  }))
}

export function NotebookCanvas({
  page,
  tool,
  color,
  baseWidth,
  shapeKind,
  eraserMode,
  eraserSize,
  onChange,
  lassoIds,
  onLasso,
  onPencilShortcut,
  compact,
}: {
  page: NotePage
  tool: NbTool
  color: string
  baseWidth: number
  shapeKind: ShapeKind
  eraserMode: EraserMode
  eraserSize: number
  onChange: (patch: Partial<Pick<NotePage, 'strokes' | 'texts' | 'stickers'>>) => void
  lassoIds: Set<string>
  onLasso: (ids: Set<string>) => void
  onPencilShortcut?: (slot: 'barrel1' | 'barrel2' | 'doubleTap' | 'eraser') => void
  compact?: boolean
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const drawing = useRef<InkPoint[]>([])
  const shapeStart = useRef<InkPoint | null>(null)
  const [draft, setDraft] = useState<InkStroke | null>(null)
  const [lassoDraft, setLassoDraft] = useState<InkPoint[]>([])

  const templateClass = useMemo(() => `nb-template nb-${page.template}`, [page.template])
  const paperBg = page.paperColor ?? '#fbfaf7'

  const localPoint = useCallback((event: ReactPointerEvent<SVGElement | HTMLElement>) => {
    const host = wrapRef.current?.querySelector('.nb-sheet') as HTMLElement | null
    if (!host) return { x: 0, y: 0, p: event.pressure }
    const bounds = host.getBoundingClientRect()
    return {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
      p: globalPalmGuard.readingPressure(event as unknown as ReactPointerEvent<HTMLElement>),
    }
  }, [])

  useEffect(() => {
    const onShortcut = (event: Event) => {
      const detail = (event as CustomEvent<{ slot: 'barrel1' | 'barrel2' | 'doubleTap' | 'eraser' }>).detail
      if (!detail) return
      window.dispatchEvent(new CustomEvent('notebook-stylus', { detail }))
    }
    window.addEventListener('study-stylus', onShortcut)
    return () => window.removeEventListener('study-stylus', onShortcut)
  }, [])

  function inkMode() {
    return tool !== 'text'
  }

  function commitStroke(stroke: InkStroke) {
    onChange({ strokes: [...page.strokes, stroke] })
  }

  function eraseStrokeAt(x: number, y: number) {
    const hit = page.strokes.find((stroke) =>
      stroke.points.some((pt) => Math.hypot(pt.x - x, pt.y - y) < Math.max(12, stroke.width * 2)),
    )
    if (hit) onChange({ strokes: page.strokes.filter((item) => item.id !== hit.id) })
  }

  function erasePixelAt(x: number, y: number) {
    const radius = eraserSize
    const strokes = page.strokes.flatMap((stroke) => splitStrokeByErase(stroke, x, y, radius))
    if (strokes.length !== page.strokes.length || strokes.some((s, i) => s !== page.strokes[i])) {
      onChange({ strokes })
    }
  }

  function finishLasso(points: InkPoint[]) {
    if (points.length < 3) return
    const ids = new Set<string>()
    for (const stroke of page.strokes) {
      const center = stroke.points[Math.floor(stroke.points.length / 2)]
      if (center && inPolygon(center.x, center.y, points)) ids.add(stroke.id)
    }
    onLasso(ids)
    setLassoDraft([])
  }

  function onPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    const pointer = event as unknown as ReactPointerEvent<HTMLElement>
    if (globalPalmGuard.shouldIgnore(pointer, inkMode())) return
    if (isPencilEraserEnd(pointer) && onPencilShortcut) {
      event.preventDefault()
      onPencilShortcut('eraser')
      return
    }
    if (isPencilBarrel(pointer) && onPencilShortcut) {
      onPencilShortcut('barrel1')
    }
    const pt = localPoint(event)
    if (tool === 'eraser') {
      if (eraserMode === 'pixel') erasePixelAt(pt.x, pt.y)
      else eraseStrokeAt(pt.x, pt.y)
      return
    }
    if (tool === 'lasso') {
      setLassoDraft([pt])
      return
    }
    if (tool === 'shape') {
      shapeStart.current = pt
      setDraft({
        id: 'draft',
        tool: 'shape',
        color,
        width: baseWidth,
        points: [pt, pt],
        shape: shapeKind,
      })
      return
    }
    if (tool === 'text') {
      const box: TextBox = {
        id: `t${Date.now()}`,
        x: pt.x,
        y: pt.y,
        w: 280,
        h: 120,
        text: '點兩下編輯文字',
        color,
        fontSize: 18,
      }
      onChange({ texts: [...page.texts, box] })
      return
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      /* ignore */
    }
    drawing.current = [pt]
    setDraft({
      id: 'draft',
      tool: tool === 'highlighter' ? 'highlighter' : tool === 'fountain' ? 'fountain' : 'pen',
      color: tool === 'highlighter' ? HIGHLIGHTER : color,
      width: widthFor(tool, baseWidth, pt.p ?? 0.5, loadStylusPreferences().pressure),
      points: drawing.current,
    })
  }

  function onPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const pointer = event as unknown as ReactPointerEvent<HTMLElement>
    if (globalPalmGuard.shouldIgnore(pointer, inkMode() && drawing.current.length > 0)) return
    const pt = localPoint(event)
    if (tool === 'eraser') {
      if (eraserMode === 'pixel') erasePixelAt(pt.x, pt.y)
      else eraseStrokeAt(pt.x, pt.y)
      return
    }
    if (tool === 'lasso' && lassoDraft.length) {
      setLassoDraft((pts) => [...pts, pt])
      return
    }
    if (draft?.tool === 'shape' && shapeStart.current) {
      setDraft({ ...draft, points: [shapeStart.current, pt] })
      return
    }
    if (!drawing.current.length) return
    drawing.current.push(pt)
    if (draft)
      setDraft({
        ...draft,
        width: widthFor(tool, baseWidth, pt.p ?? 0.5, loadStylusPreferences().pressure),
        points: [...drawing.current],
      })
  }

  function onPointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    globalPalmGuard.shouldIgnore(event as unknown as ReactPointerEvent<HTMLElement>, false)
    if (lassoDraft.length) {
      finishLasso(lassoDraft)
      return
    }
    if (draft?.tool === 'shape' && draft.points.length >= 2) {
      commitStroke({ ...draft, id: `s${Date.now()}` })
      setDraft(null)
      shapeStart.current = null
      return
    }
    if (drawing.current.length > 1 && draft) {
      commitStroke({ ...draft, id: `s${Date.now()}` })
    }
    drawing.current = []
    setDraft(null)
  }

  function renderShape(stroke: InkStroke) {
    const [a, b] = stroke.points
    if (!a || !b) return null
    if (stroke.shape === 'line')
      return (
        <line
          key={stroke.id}
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke={stroke.color}
          strokeWidth={stroke.width}
          strokeLinecap="round"
        />
      )
    if (stroke.shape === 'rect')
      return (
        <rect
          key={stroke.id}
          x={Math.min(a.x, b.x)}
          y={Math.min(a.y, b.y)}
          width={Math.abs(b.x - a.x)}
          height={Math.abs(b.y - a.y)}
          fill="none"
          stroke={stroke.color}
          strokeWidth={stroke.width}
        />
      )
    return (
      <ellipse
        key={stroke.id}
        cx={(a.x + b.x) / 2}
        cy={(a.y + b.y) / 2}
        rx={Math.abs(b.x - a.x) / 2}
        ry={Math.abs(b.y - a.y) / 2}
        fill="none"
        stroke={stroke.color}
        strokeWidth={stroke.width}
      />
    )
  }

  return (
    <div className={`nb-canvas-wrap${compact ? ' nb-canvas-compact' : ''}`} ref={wrapRef}>
      <div className="nb-viewport">
        <div className={`nb-sheet ${templateClass}`} style={{ backgroundColor: paperBg }}>
          {page.background && <img className="nb-background" src={page.background} alt="" draggable={false} />}
          {page.stickers.map((sticker) => (
            <img
              key={sticker.id}
              className="nb-sticker"
              src={sticker.dataUrl}
              alt=""
              style={{ left: sticker.x, top: sticker.y, width: sticker.w, height: sticker.h }}
            />
          ))}
          {page.texts.map((box) => (
            <textarea
              key={box.id}
              className="nb-textbox selectable"
              style={{ left: box.x, top: box.y, width: box.w, height: box.h, color: box.color, fontSize: box.fontSize }}
              value={box.text}
              onChange={(event) =>
                onChange({
                  texts: page.texts.map((item) => (item.id === box.id ? { ...item, text: event.target.value } : item)),
                })
              }
            />
          ))}
          <svg
            className="nb-ink apple-pencil-surface"
            viewBox="0 0 820 1060"
            preserveAspectRatio="xMidYMid meet"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {page.strokes.map((stroke) =>
              stroke.tool === 'shape' ? (
                renderShape(stroke)
              ) : (
                <path
                  key={stroke.id}
                  d={polylineD(stroke.points)}
                  fill="none"
                  stroke={stroke.color}
                  strokeWidth={stroke.width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={stroke.tool === 'highlighter' ? 0.45 : 1}
                />
              ),
            )}
            {page.strokes.map((stroke) =>
              lassoIds.has(stroke.id) ? (
                stroke.tool === 'shape' ? (
                  <g key={`sel-${stroke.id}`} pointerEvents="none">
                    {renderShape({ ...stroke, color: '#007aff' })}
                  </g>
                ) : (
                  <path
                    key={`sel-${stroke.id}`}
                    d={polylineD(stroke.points)}
                    fill="none"
                    stroke="#007aff"
                    strokeWidth={Math.max(stroke.width + 2, stroke.width * 1.2)}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="10 7"
                    opacity={0.95}
                    pointerEvents="none"
                  />
                )
              ) : null,
            )}
            {draft &&
              (draft.tool === 'shape' ? (
                renderShape(draft)
              ) : (
                <path
                  d={polylineD(draft.points)}
                  fill="none"
                  stroke={draft.color}
                  strokeWidth={draft.width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={draft.tool === 'highlighter' ? 0.45 : 0.9}
                />
              ))}
            {lassoDraft.length > 1 && (
              <path
                d={polylineD(lassoDraft)}
                fill="rgba(0,122,255,0.08)"
                stroke="#007aff"
                strokeWidth={1.5}
                strokeDasharray="6 4"
              />
            )}
          </svg>
        </div>
      </div>
    </div>
  )
}

export function templateLabel(t: PageTemplate) {
  return t === 'blank' ? '空白' : t === 'ruled' ? '橫線' : t === 'grid' ? '方格' : '點線'
}