import { useState, type ReactNode } from 'react'
import { IconAttach, IconEraser, IconHighlighter, IconRefresh } from './icons'
import type { EraserMode, NbTool, ShapeKind } from './notebook-canvas'

export const QUICK_INK_COLORS = [
  '#1c1c1e',
  '#c41e1e',
  '#1b4fd8',
  '#17803d',
  '#6b3fa0',
  '#f4a100',
  '#e91e8c',
  '#0e8a8a',
  '#ffffff',
]

function ToolChip({
  label,
  active,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button type="button" className={`nb-chip${active ? ' on' : ''}`} onClick={onClick} aria-pressed={!!active}>
      <span className="nb-chip-icon" aria-hidden>
        {children}
      </span>
      <span className="nb-chip-label">{label}</span>
    </button>
  )
}

function IconPen() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M5 19l4-8.5 9-2.5-2.5 9L5 19Z" strokeLinejoin="round" />
    </svg>
  )
}

function IconFountain() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M6 18c2-9 6-12 12-12" strokeLinecap="round" />
      <path d="M8 16c3-4 7-5 10-3" strokeLinecap="round" />
    </svg>
  )
}

function IconLasso() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M8 10a4 4 0 0 1 7.2-2.4c1.5 2 1 5.2-1.4 6.6-1 .6-2.2.5-3.4-.4" strokeLinecap="round" />
    </svg>
  )
}

function IconText() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M6 7h12M12 7v12" strokeLinecap="round" />
    </svg>
  )
}

function IconUndo() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M8 8H5v3M5 11a7 7 0 1 0 1.6-4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ShapeIcon({ kind, active }: { kind: ShapeKind; active?: boolean }) {
  const stroke = active ? '#007aff' : 'currentColor'
  if (kind === 'line')
    return <line x1="5" y1="19" x2="19" y2="5" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
  if (kind === 'rect')
    return <rect x="5" y="7" width="14" height="12" rx="1" stroke={stroke} strokeWidth="2" fill="none" />
  if (kind === 'ellipse')
    return <ellipse cx="12" cy="13" rx="7" ry="5" stroke={stroke} strokeWidth="2" fill="none" />
  if (kind === 'triangle')
    return <polygon points="12,6 19,18 5,18" stroke={stroke} strokeWidth="2" fill="none" strokeLinejoin="round" />
  if (kind === 'arrow')
    return (
      <>
        <path d="M5 12h12M14 8l4 4-4 4" stroke={stroke} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </>
    )
  return (
    <path
      d="M12 5.5l1.3 3.9h4.1l-3.3 2.4 1.3 3.9L12 13 8.6 15.7l1.3-3.9-3.3-2.4h4.1L12 5.5Z"
      stroke={stroke}
      strokeWidth="1.5"
      fill="none"
      strokeLinejoin="round"
    />
  )
}

const SHAPE_KINDS: ShapeKind[] = ['line', 'rect', 'ellipse', 'triangle', 'arrow', 'star']

export function NotebookToolbar({
  tool,
  color,
  width,
  shapeKind,
  eraserMode,
  eraserSize,
  onTool,
  onColor,
  onWidth,
  onShapeKind,
  onEraserMode,
  onEraserSize,
  onUndo,
  onRedo,
  onInsertImage,
  onAttach,
}: {
  tool: NbTool
  color: string
  width: number
  shapeKind: ShapeKind
  eraserMode: EraserMode
  eraserSize: number
  onTool: (t: NbTool) => void
  onColor: (c: string) => void
  onWidth: (n: number) => void
  onShapeKind: (s: ShapeKind) => void
  onEraserMode: (m: EraserMode) => void
  onEraserSize: (n: number) => void
  onUndo: () => void
  onRedo: () => void
  onInsertImage: (file: File) => void
  onAttach: () => void
}) {
  const [penMenu, setPenMenu] = useState(false)
  const [shapeMenu, setShapeMenu] = useState(false)
  const [eraserMenu, setEraserMenu] = useState(false)

  const penActive = tool === 'pen' || tool === 'fountain' || tool === 'highlighter'

  function pickPen(next: NbTool) {
    onTool(next)
    setPenMenu(true)
    setShapeMenu(false)
    setEraserMenu(false)
  }

  return (
    <div className="nb-gn-toolbar no-select" role="toolbar" aria-label="筆記工具">
      <div className="nb-gn-toolbar-main">
        <ToolChip label="筆" active={tool === 'pen'} onClick={() => pickPen('pen')}>
          <IconPen />
        </ToolChip>
        <ToolChip label="鋼筆" active={tool === 'fountain'} onClick={() => pickPen('fountain')}>
          <IconFountain />
        </ToolChip>
        <ToolChip label="螢光" active={tool === 'highlighter'} onClick={() => pickPen('highlighter')}>
          <IconHighlighter />
        </ToolChip>
        <div className="nb-gn-colors">
          {QUICK_INK_COLORS.map((swatch) => (
            <button
              key={swatch}
              type="button"
              className={`nb-gn-swatch${color === swatch ? ' on' : ''}${swatch === '#ffffff' ? ' light' : ''}`}
              style={{ background: swatch }}
              aria-label="筆色"
              onClick={() => onColor(swatch)}
            />
          ))}
          <label className="nb-gn-swatch nb-gn-swatch-more" title="更多顏色">
            <input type="color" value={color} onChange={(event) => onColor(event.target.value)} />
            <span>＋</span>
          </label>
        </div>
        <div className="nb-tool-pop">
          <ToolChip
            label="圖形"
            active={tool === 'shape'}
            onClick={() => {
              onTool('shape')
              setShapeMenu((v) => !v)
              setPenMenu(false)
              setEraserMenu(false)
            }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
              <rect x="4" y="4" width="9" height="9" rx="1" fill="none" stroke="currentColor" strokeWidth="1.75" />
              <circle cx="17" cy="16" r="4" fill="none" stroke="currentColor" strokeWidth="1.75" />
            </svg>
          </ToolChip>
          {shapeMenu && (
            <PopPanel onClose={() => setShapeMenu(false)}>
              <div className="nb-shape-grid">
                {SHAPE_KINDS.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    className={shapeKind === kind ? 'on' : ''}
                    aria-label={kind}
                    onClick={() => {
                      onShapeKind(kind)
                      onTool('shape')
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="28" height="28">
                      <ShapeIcon kind={kind} active={shapeKind === kind} />
                    </svg>
                  </button>
                ))}
              </div>
            </PopPanel>
          )}
        </div>
        <div className="nb-tool-pop">
          <ToolChip
            label="橡皮"
            active={tool === 'eraser'}
            onClick={() => {
              onTool('eraser')
              setEraserMenu((v) => !v)
              setPenMenu(false)
              setShapeMenu(false)
            }}
          >
            <IconEraser />
          </ToolChip>
          {eraserMenu && (
            <PopPanel onClose={() => setEraserMenu(false)}>
              <button type="button" className={eraserMode === 'stroke' ? 'on' : ''} onClick={() => onEraserMode('stroke')}>
                整筆
              </button>
              <button type="button" className={eraserMode === 'pixel' ? 'on' : ''} onClick={() => onEraserMode('pixel')}>
                像素
              </button>
              <label className="nb-width-mini" onPointerDown={(event) => event.stopPropagation()}>
                大小 {eraserSize}
                <input
                  type="range"
                  min={8}
                  max={64}
                  value={eraserSize}
                  onChange={(event) => onEraserSize(Number(event.target.value))}
                />
              </label>
              <div className="nb-eraser-preview" aria-hidden>
                <span style={{ width: eraserSize, height: eraserSize }} />
              </div>
            </PopPanel>
          )}
        </div>
        <ToolChip label="套索" active={tool === 'lasso'} onClick={() => onTool('lasso')}>
          <IconLasso />
        </ToolChip>
        <ToolChip label="文字" active={tool === 'text'} onClick={() => onTool('text')}>
          <IconText />
        </ToolChip>
        <span className="nb-toolbar-sep" />
        <ToolChip label="復原" onClick={() => onUndo()}>
          <IconUndo />
        </ToolChip>
        <ToolChip label="重做" onClick={() => onRedo()}>
          <IconRefresh />
        </ToolChip>
        <label className="nb-chip nb-chip-file">
          <span className="nb-chip-icon">
            <IconAttach />
          </span>
          <span className="nb-chip-label">圖片</span>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) onInsertImage(file)
            }}
          />
        </label>
        <ToolChip label="教材" onClick={() => onAttach()}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
            <path d="M7 17 17 7M10 7h7v7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </ToolChip>
      </div>
      {penMenu && penActive && (
        <div className="nb-gn-toolbar-sub" onPointerDown={(event) => event.stopPropagation()}>
          <label className="nb-width-mini">
            筆粗 {width}
            <input type="range" min={1} max={16} value={width} onChange={(event) => onWidth(Number(event.target.value))} />
          </label>
          <div className="nb-pen-preview" aria-hidden>
            <span style={{ height: Math.max(2, width), background: color }} />
          </div>
          <button type="button" className="nb-plain-btn" onClick={() => setPenMenu(false)}>
            收合
          </button>
        </div>
      )}
    </div>
  )
}

function PopPanel({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div
      className="nb-pop-panel"
      onPointerDown={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
    >
      {children}
      {onClose && (
        <button type="button" className="nb-pop-close" onClick={onClose}>
          關閉
        </button>
      )}
    </div>
  )
}