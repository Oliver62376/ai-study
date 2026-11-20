import { useState, type ReactNode } from 'react'
import {
  IconBtn,
  IconEraser,
  IconHighlighter,
  IconRefresh,
  IconAttach,
} from './icons'
import type { EraserMode, NbTool, ShapeKind } from './notebook-canvas'

function IconPen() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M5 19l4-8.5 9-2.5-2.5 9L5 19Z" strokeLinejoin="round" />
    </svg>
  )
}

function IconLasso() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M8 10a4 4 0 0 1 7.2-2.4c1.5 2 1 5.2-1.4 6.6-1 .6-2.2.5-3.4-.4" strokeLinecap="round" />
    </svg>
  )
}

function IconShapes() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="5" y="5" width="8" height="8" rx="1" />
      <circle cx="17" cy="15" r="4" />
    </svg>
  )
}

function IconText() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M6 7h12M12 7v12" strokeLinecap="round" />
    </svg>
  )
}

function IconUndo() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M8 8H5v3M5 11a7 7 0 1 0 1.6-4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

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
  const [penOpen, setPenOpen] = useState(false)
  const [shapeOpen, setShapeOpen] = useState(false)
  const [eraserOpen, setEraserOpen] = useState(false)

  return (
    <div className="nb-toolbar nb-toolbar-icons no-select" role="toolbar" aria-label="筆記工具">
      <IconBtn label="原子筆" className={tool === 'pen' ? 'active' : ''} onClick={() => onTool('pen')}>
        <IconPen />
      </IconBtn>
      <IconBtn label="鋼筆" className={tool === 'fountain' ? 'active' : ''} onClick={() => onTool('fountain')}>
        <span className="nb-glyph">F</span>
      </IconBtn>
      <IconBtn label="螢光筆" className={tool === 'highlighter' ? 'active' : ''} onClick={() => onTool('highlighter')}>
        <IconHighlighter />
      </IconBtn>
      <div className="nb-tool-pop">
        <IconBtn
          label="筆設定"
          className={penOpen ? 'active' : ''}
          onClick={() => {
            setPenOpen((v) => !v)
            setEraserOpen(false)
            setShapeOpen(false)
          }}
        >
          <span className="nb-glyph">⋯</span>
        </IconBtn>
        {penOpen && (
          <PopPanel className="glass-pop">
            <label className="nb-width-mini">
              粗細 {width}
              <input type="range" min={1} max={12} value={width} onChange={(e) => onWidth(Number(e.target.value))} />
            </label>
          </PopPanel>
        )}
      </div>
      <label className="nb-color-wheel" title="筆色">
        <span className="swatch" style={{ background: color }} aria-hidden />
        <input type="color" value={color} onChange={(e) => onColor(e.target.value)} />
      </label>
      <div className="nb-tool-pop">
        <IconBtn
          label="圖形"
          className={tool === 'shape' ? 'active' : ''}
          onClick={() => {
            onTool('shape')
            setShapeOpen((v) => !v)
            setEraserOpen(false)
            setPenOpen(false)
          }}
        >
          <IconShapes />
        </IconBtn>
        {shapeOpen && (
          <PopPanel className="glass-pop">
            {(
              [
                ['line', '直線'],
                ['rect', '方框'],
                ['ellipse', '圓'],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" className={shapeKind === id ? 'on' : ''} onClick={() => onShapeKind(id)}>
                {label}
              </button>
            ))}
          </PopPanel>
        )}
      </div>
      <div className="nb-tool-pop">
        <IconBtn
          label="橡皮擦"
          className={tool === 'eraser' ? 'active' : ''}
          onClick={() => {
            onTool('eraser')
            setEraserOpen((v) => !v)
            setShapeOpen(false)
            setPenOpen(false)
          }}
        >
          <IconEraser />
        </IconBtn>
        {eraserOpen && (
          <PopPanel className="glass-pop">
            <button type="button" className={eraserMode === 'stroke' ? 'on' : ''} onClick={() => onEraserMode('stroke')}>
              整筆
            </button>
            <button type="button" className={eraserMode === 'pixel' ? 'on' : ''} onClick={() => onEraserMode('pixel')}>
              像素
            </button>
            <label className="nb-width-mini">
              大小 {eraserSize}
              <input type="range" min={8} max={48} value={eraserSize} onChange={(e) => onEraserSize(Number(e.target.value))} />
            </label>
          </PopPanel>
        )}
      </div>
      <IconBtn label="套索" className={tool === 'lasso' ? 'active' : ''} onClick={() => onTool('lasso')}>
        <IconLasso />
      </IconBtn>
      <IconBtn label="文字" className={tool === 'text' ? 'active' : ''} onClick={() => onTool('text')}>
        <IconText />
      </IconBtn>
      <span className="nb-toolbar-sep" />
      <IconBtn label="復原" onClick={onUndo}>
        <IconUndo />
      </IconBtn>
      <IconBtn label="重做" onClick={onRedo}>
        <IconRefresh />
      </IconBtn>
      <label className="nb-insert-image">
        <IconAttach />
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
      <IconBtn label="加入教材" onClick={onAttach}>
        <span className="nb-glyph">↗</span>
      </IconBtn>
    </div>
  )
}

function PopPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`nb-pop-panel ${className ?? ''}`}>{children}</div>
}