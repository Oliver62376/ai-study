import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import katex from 'katex'
import type { InkColor, Reveal } from './model'
import { globalPalmGuard } from './pointer-stylus'

const inkClass: Record<InkColor, string> = {
  default: '',
  chalk: 'ink-chalk',
  blue: 'ink-blue',
  red: 'ink-red',
  green: 'ink-green',
}

export function laserFor(reveal: Reveal) {
  if (reveal.type === 'mark') return reveal.id.replace(/^mark-/, '')
  if (reveal.type === 'anim') return 'particle'
  return reveal.id
}

export function anchorPage(id: string, reveals: Reveal[]) {
  for (const item of reveals) {
    if (item.id === id) return item.page
    if (item.type === 'note' && item.anchor === id) return item.page
  }
  if (id === 'particle' || id === 'anim' || id === 'lab') {
    return reveals.find((item) => item.type === 'anim' || item.type === 'lab')?.page ?? 1
  }
  return 0
}

export function hasReveal(reveals: Reveal[], id: string) {
  return reveals.some((item) => item.id === id)
}

export interface Mark {
  page: number
  color: string
  points: string
}

export const markerColors = ['#ffe14a', '#7dff7a', '#ff8ad4'] as const

export interface Glow {
  page: number
  anchor: string
  color: string
}

const glowFill: Record<string, string> = {
  yellow: '#ffe14a',
  green: '#b6f5a8',
  pink: '#ffb3dc',
}

function nearStroke(points: string, x: number, y: number) {
  return points.split(' ').some((pair) => {
    const [px, py] = pair.split(',').map(Number)
    return Math.hypot(px - x, py - y) < 28
  })
}

function Formula({ latex, id }: { latex: string; id: string }) {
  const html = katex.renderToString(latex, { throwOnError: false, displayMode: true })
  return <div className="formula" data-anchor={id} dangerouslySetInnerHTML={{ __html: html }} />
}

function sinePath(amplitude: number, wavelength: number, phase: number) {
  const points: string[] = []
  for (let x = 24; x <= 616; x += 4) {
    const y = 110 - amplitude * Math.sin(((x - 24) / wavelength) * Math.PI * 2 + phase)
    points.push(`${x},${y.toFixed(1)}`)
  }
  return `M${points.join(' L')}`
}

export function WaveFigure({ reveals }: { reveals: Reveal[] }) {
  const eq = hasReveal(reveals, 'mark-eq')
  const crest = hasReveal(reveals, 'mark-crest')
  const trough = hasReveal(reveals, 'mark-trough')
  const amp = hasReveal(reveals, 'mark-amp')
  const lambda = hasReveal(reveals, 'mark-lambda')
  return (
    <svg className="wave" viewBox="0 0 640 230" data-anchor="wave" role="img" aria-label="橫波示意">
      <path d={sinePath(64, 280, 0)} className="wave-line draw" pathLength={1} />
      {eq && <line x1="24" y1="110" x2="616" y2="110" className="wave-eq draw" pathLength={1} data-anchor="eq" />}
      {crest && <circle cx="94" cy="46" r="5" className="wave-dot ink" data-anchor="crest" />}
      {trough && <circle cx="234" cy="174" r="5" className="wave-dot ink" data-anchor="trough" />}
      {amp && (
        <g data-anchor="amp" className="ink">
          <line x1="94" y1="110" x2="94" y2="46" className="wave-arrow draw" pathLength={1} />
          <path d="M88 58 L94 46 L100 58" className="wave-arrow draw" pathLength={1} />
        </g>
      )}
      {lambda && (
        <g data-anchor="lambda" className="ink">
          <path d="M94 198 H374" className="wave-brace draw" pathLength={1} />
          <path d="M94 192 V204 M374 192 V204" className="wave-brace draw" pathLength={1} />
        </g>
      )}
    </svg>
  )
}

export function WaveAnim() {
  const [phase, setPhase] = useState(0)
  useLayoutEffect(() => {
    let frame = 0
    const loop = () => {
      setPhase((value) => value + 0.045)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [])
  const particleY = 110 - 48 * Math.sin(((180 - 24) / 240) * Math.PI * 2 + phase)
  return (
    <figure className="widget" data-anchor="anim">
      <figcaption>動畫：波往右傳，質點只上下振動</figcaption>
      <svg className="wave" viewBox="0 0 640 200">
        <path d={sinePath(48, 240, phase)} className="wave-line" />
        <line x1="24" y1="110" x2="616" y2="110" className="wave-eq" />
        <line x1="180" y1="78" x2="180" y2="142" className="wave-guide" />
        <circle cx="180" cy={particleY} r="7" className="wave-dot" data-anchor="particle" />
      </svg>
    </figure>
  )
}

export function WaveLab() {
  const [amplitude, setAmplitude] = useState(48)
  const [frequency, setFrequency] = useState(2)
  const [phase, setPhase] = useState(0)
  useLayoutEffect(() => {
    let frame = 0
    const loop = () => {
      setPhase((value) => value + 0.02 * frequency)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [frequency])
  const wavelength = 360 / frequency
  return (
    <figure className="widget lab" data-anchor="lab">
      <figcaption>互動：波速先固定。頻率變高，波長變短。</figcaption>
      <svg className="wave" viewBox="0 0 640 200">
        <path d={sinePath(amplitude, wavelength, phase)} className="wave-line" />
        <line x1="24" y1="110" x2="616" y2="110" className="wave-eq" />
      </svg>
      <label>
        振幅 {amplitude}
        <input
          type="range"
          min={24}
          max={72}
          value={amplitude}
          onChange={(event) => setAmplitude(Number(event.target.value))}
        />
      </label>
      <label>
        頻率 {frequency.toFixed(1)}
        <input
          type="range"
          min={1}
          max={4}
          step={0.1}
          value={frequency}
          onChange={(event) => setFrequency(Number(event.target.value))}
        />
      </label>
    </figure>
  )
}

export function Sheet({
  page,
  reveals,
  register,
  marks = [],
  glows = [],
  tool = 'off',
  marker = markerColors[0],
  onMark,
  onEraseMark,
  onEraseGlow,
}: {
  page: number
  reveals: Reveal[]
  register: (page: number, node: HTMLElement | null) => void
  marks?: Mark[]
  glows?: Glow[]
  tool?: 'off' | 'pen' | 'erase'
  marker?: string
  onMark?: (mark: Mark) => void
  onEraseMark?: (mark: Mark) => void
  onEraseGlow?: (glow: Glow) => void
}) {
  const pageItems = reveals.filter((item) => item.page === page)
  const notes = pageItems.filter((item) => item.type === 'note')
  const drawing = useRef<string[]>([])
  const [draft, setDraft] = useState('')
  const [host, setHost] = useState<HTMLElement | null>(null)
  const [glowBoxes, setGlowBoxes] = useState<{ glow: Glow; x: number; y: number; w: number; h: number }[]>([])

  useLayoutEffect(() => {
    if (!host) return
    const place = () => {
      const bounds = host.getBoundingClientRect()
      const next = glows
        .filter((glow) => glow.page === page)
        .flatMap((glow) => {
          const anchor = host.querySelector(`[data-anchor="${CSS.escape(glow.anchor)}"]`)
          if (!anchor) return []
          const box = anchor.getBoundingClientRect()
          return [
            {
              glow,
              x: box.left - bounds.left - 6,
              y: box.top - bounds.top - 4,
              w: Math.max(28, box.width + 12),
              h: Math.max(22, box.height + 8),
            },
          ]
        })
      setGlowBoxes(next)
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(host)
    return () => observer.disconnect()
  }, [host, glows, page, pageItems.length])

  function point(event: ReactPointerEvent<HTMLElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.round(event.clientX - bounds.left),
      y: Math.round(event.clientY - bounds.top),
    }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (tool === 'off') return
    if (globalPalmGuard.shouldIgnore(event, true)) return
    const target = event.target
    if (target instanceof Element && target.closest('input, button, label, a')) return
    const next = point(event)
    if (tool === 'erase') {
      const mark = marks.find((item) => item.page === page && nearStroke(item.points, next.x, next.y))
      if (mark) onEraseMark?.(mark)
      const glow = glowBoxes.find(
        (item) => next.x >= item.x && next.x <= item.x + item.w && next.y >= item.y && next.y <= item.y + item.h,
      )
      if (glow) onEraseGlow?.(glow.glow)
      return
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      /* 指標還沒進到可捕捉的狀態時，這一筆仍可跟著移動畫完 */
    }
    drawing.current = [`${next.x},${next.y}`]
    setDraft(drawing.current.join(' '))
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    if (globalPalmGuard.shouldIgnore(event, drawing.current.length > 0)) return
    if (!drawing.current.length) return
    const next = point(event)
    drawing.current.push(`${next.x},${next.y}`)
    setDraft(drawing.current.join(' '))
  }

  function onPointerUp(event: ReactPointerEvent<HTMLElement>) {
    globalPalmGuard.shouldIgnore(event, false)
    if (drawing.current.length < 2) {
      drawing.current = []
      setDraft('')
      return
    }
    onMark?.({ page, color: marker, points: drawing.current.join(' ') })
    drawing.current = []
    setDraft('')
  }

  return (
    <section
      className={tool === 'off' ? 'sheet' : 'sheet marking apple-pencil-surface'}
      data-page={page}
      ref={(node) => {
        setHost(node)
        register(page, node)
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="sheet-main">
        <p className="page-no">第 {page + 1} 頁</p>
        {pageItems.map((item) => {
          if (item.type === 'text') {
            const tone = item.color ? inkClass[item.color] : ''
            const role =
              item.variant === 'title' ? 'board-title' : item.variant === 'ink' ? 'board-ink' : 'board-text'
            return (
              <p key={item.id} className={`${role}${tone ? ` ${tone}` : ''}`} data-anchor={item.id}>
                {item.text}
              </p>
            )
          }
          if (item.type === 'formula') return <Formula key={item.id} id={item.id} latex={item.latex} />
          if (item.type === 'wave') return <WaveFigure key={item.id} reveals={reveals} />
          if (item.type === 'anim') return <WaveAnim key={item.id} />
          if (item.type === 'lab') return <WaveLab key={item.id} />
          return null
        })}
      </div>
      <aside className="notes">
        {notes.map((item) =>
          item.type === 'note' ? (
            <p key={item.id} className="note" data-note={item.anchor} data-anchor={item.id}>
              {item.text}
            </p>
          ) : null,
        )}
      </aside>
      <Leaders version={pageItems.length} />
      {glowBoxes.map((item) => (
        <div
          key={`${item.glow.anchor}-${item.glow.color}`}
          className="glow"
          style={{
            left: item.x,
            top: item.y,
            width: item.w,
            height: item.h,
            background: glowFill[item.glow.color] ?? item.glow.color,
          }}
        />
      ))}
      <svg className="marks" aria-hidden="true">
        {marks.filter((mark) => mark.page === page).map((mark, index) => (
          <polyline key={index} points={mark.points} stroke={mark.color} />
        ))}
        {draft && <polyline points={draft} stroke={marker} />}
      </svg>
    </section>
  )
}

function Leaders({ version }: { version: number }) {
  const [lines, setLines] = useState<{ x1: number; y1: number; x2: number; y2: number }[]>([])
  const [host, setHost] = useState<SVGSVGElement | null>(null)

  useLayoutEffect(() => {
    if (!host) return
    const sheet = host.closest('.sheet')
    if (!sheet) return
    const measure = () => {
      const bounds = sheet.getBoundingClientRect()
      const next = [...sheet.querySelectorAll<HTMLElement>('[data-note]')].flatMap((note) => {
        const anchorId = note.dataset.note
        if (!anchorId) return []
        const anchor = sheet.querySelector(`[data-anchor="${CSS.escape(anchorId)}"]`)
        if (!anchor) return []
        const from = anchor.getBoundingClientRect()
        const to = note.getBoundingClientRect()
        return [
          {
            x1: from.left - bounds.left + from.width,
            y1: from.top - bounds.top + from.height / 2,
            x2: to.left - bounds.left,
            y2: to.top - bounds.top + to.height / 2,
          },
        ]
      })
      setLines(next)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(sheet)
    return () => observer.disconnect()
  }, [host, version])

  return (
    <svg className="leaders" ref={setHost} aria-hidden="true">
      {lines.map((line, index) => (
        <line key={index} {...line} />
      ))}
    </svg>
  )
}

export function Laser({
  target,
  root,
}: {
  target: string | null
  root: RefObject<HTMLDivElement | null>
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  useLayoutEffect(() => {
    const rootEl = root.current
    if (!target || !rootEl) {
      setPos(null)
      return
    }
    const anchor = rootEl.querySelector(`[data-anchor="${CSS.escape(target)}"]`)
    if (!(anchor instanceof HTMLElement || anchor instanceof SVGElement)) {
      setPos(null)
      return
    }
    const place = () => {
      const from = anchor.getBoundingClientRect()
      const bounds = rootEl.getBoundingClientRect()
      setPos({
        x: from.left - bounds.left + rootEl.scrollLeft + from.width / 2,
        y: from.top - bounds.top + rootEl.scrollTop + from.height / 2,
      })
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(rootEl)
    return () => observer.disconnect()
  }, [target, root])

  if (!pos || !target) return null
  return <div className="laser" style={{ left: pos.x, top: pos.y }} />
}
