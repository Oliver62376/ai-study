import { useMemo } from 'react'
import type { ForceArrow, ForcesReveal, PlotCurve, PlotPoint, PlotReveal, WaveParamsReveal } from './model'

const W = 640
const H = 260
const PAD = 36

function evalFn(expr: string, x: number): number | null {
  const body = expr
    .trim()
    .replace(/\^/g, '**')
    .replace(/(\d)x/g, '$1*x')
    .replace(/\)x/g, ')*x')
    .replace(/x(\d)/g, 'x*$1')
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('x', 'Math', `return (${body});`) as (x: number, m: typeof Math) => number
    const y = fn(x, Math)
    return Number.isFinite(y) ? y : null
  } catch {
    return null
  }
}

function mapX(x: number, xMin: number, xMax: number) {
  return PAD + ((x - xMin) / (xMax - xMin)) * (W - PAD * 2)
}

function mapY(y: number, yMin: number, yMax: number) {
  return H - PAD - ((y - yMin) / (yMax - yMin)) * (H - PAD * 2)
}

const curveColors = ['#1a4d8f', '#c23b22', '#1e7a46', '#6b3fa0']

export function PlotFigure({ spec }: { spec: PlotReveal }) {
  const xMin = spec.xMin
  const xMax = spec.xMax
  const yMin = spec.yMin ?? -5
  const yMax = spec.yMax ?? 5
  const showAxes = spec.showAxes !== false
  const curves = spec.curves ?? []
  const points = spec.points ?? []

  const paths = useMemo(() => {
    return curves.map((curve: PlotCurve, index: number) => {
      const pts: string[] = []
      const steps = 120
      for (let i = 0; i <= steps; i += 1) {
        const x = xMin + ((xMax - xMin) * i) / steps
        const y = evalFn(curve.fn, x)
        if (y == null) continue
        if (y < yMin - 2 || y > yMax + 2) continue
        pts.push(`${mapX(x, xMin, xMax).toFixed(1)},${mapY(y, yMin, yMax).toFixed(1)}`)
      }
      if (pts.length < 2) return null
      const color = curve.color?.trim() || curveColors[index % curveColors.length]
      return { d: `M${pts.join(' L')}`, color, label: curve.label }
    })
  }, [curves, xMin, xMax, yMin, yMax])

  return (
    <figure className="widget plot" data-anchor={spec.id}>
      {spec.caption && <figcaption>{spec.caption}</figcaption>}
      <svg className="plot-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={spec.caption ?? '函數圖'}>
        {showAxes && (
          <g className="plot-axes">
            <line x1={PAD} y1={mapY(0, yMin, yMax)} x2={W - PAD} y2={mapY(0, yMin, yMax)} className="axis" />
            <line x1={mapX(0, xMin, xMax)} y1={PAD} x2={mapX(0, xMin, xMax)} y2={H - PAD} className="axis" />
            <text x={W - PAD + 4} y={mapY(0, yMin, yMax) + 4} className="axis-label">
              x
            </text>
            <text x={mapX(0, xMin, xMax) + 4} y={PAD - 6} className="axis-label">
              y
            </text>
          </g>
        )}
        {paths.map(
          (path, index) =>
            path && (
              <g key={index}>
                <path d={path.d} fill="none" stroke={path.color} strokeWidth={2.2} className="plot-curve draw" pathLength={1} />
                {path.label && (
                  <text x={W - PAD - 8} y={PAD + 14 + index * 16} fill={path.color} className="plot-label">
                    {path.label}
                  </text>
                )}
              </g>
            ),
        )}
        {points.map((pt: PlotPoint, index) => (
          <g key={`${pt.x}-${pt.y}-${index}`} data-anchor={pt.label ? `pt-${index}` : undefined}>
            <circle cx={mapX(pt.x, xMin, xMax)} cy={mapY(pt.y, yMin, yMax)} r={5} className="plot-point" />
            {pt.label && (
              <text
                x={mapX(pt.x, xMin, xMax) + 8}
                y={mapY(pt.y, yMin, yMax) - 8}
                className="plot-point-label"
              >
                {pt.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </figure>
  )
}

function ForceArrowGraphic({ ox, oy, dx, dy, color }: { ox: number; oy: number; dx: number; dy: number; color: string }) {
  const x2 = ox + dx
  const y2 = oy + dy
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const px = -uy
  const py = ux
  return (
    <>
      <line x1={ox} y1={oy} x2={x2} y2={y2} stroke={color} strokeWidth={2.5} className="draw" pathLength={1} />
      <path
        d={`M${x2},${y2} L${x2 - ux * 12 + px * 5},${y2 - uy * 12 + py * 5} L${x2 - ux * 12 - px * 5},${y2 - uy * 12 - py * 5} Z`}
        fill={color}
      />
    </>
  )
}

export function ForcesFigure({ spec }: { spec: ForcesReveal }) {
  const vw = 400
  const vh = 280
  const body = spec.body ?? { x: 160, y: 100, w: 80, h: 48, label: '物體' }
  const ox = body.x + body.w / 2
  const oy = body.y + body.h / 2
  return (
    <figure className="widget forces" data-anchor={spec.id}>
      {spec.caption && <figcaption>{spec.caption}</figcaption>}
      <svg viewBox={`0 0 ${vw} ${vh}`} className="forces-svg" role="img" aria-label={spec.caption ?? '受力圖'}>
        <defs>
          <marker id="force-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#2b2b2b" />
          </marker>
        </defs>
        <rect
          x={body.x}
          y={body.y}
          width={body.w}
          height={body.h}
          rx={6}
          className="force-body"
          data-anchor={`${spec.id}-body`}
        />
        {body.label && (
          <text x={ox} y={oy + 5} textAnchor="middle" className="force-body-label">
            {body.label}
          </text>
        )}
        {spec.arrows.map((arrow: ForceArrow) => {
          const color = arrow.color?.trim() || '#2b2b2b'
          const x2 = ox + arrow.dx
          const y2 = oy + arrow.dy
          return (
            <g key={arrow.id} data-anchor={arrow.id} className="force-arrow-g">
              <ForceArrowGraphic ox={ox} oy={oy} dx={arrow.dx} dy={arrow.dy} color={color} />
              <text x={x2 + (arrow.dx >= 0 ? 8 : -8)} y={y2 + (arrow.dy >= 0 ? 18 : -8)} className="force-label">
                {arrow.label}
              </text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

function sinePath(amplitude: number, wavelength: number, phase: number) {
  const points: string[] = []
  for (let x = 24; x <= 616; x += 4) {
    const y = 110 - amplitude * Math.sin(((x - 24) / wavelength) * Math.PI * 2 + phase)
    points.push(`${x},${y.toFixed(1)}`)
  }
  return `M${points.join(' L')}`
}

export function ParamWaveFigure({ spec }: { spec: WaveParamsReveal }) {
  const amp = spec.amplitude ?? 64
  const wavelength = spec.wavelength ?? 280
  const phase = spec.phase ?? 0
  const marks = new Set(spec.marks ?? [])
  return (
    <svg className="wave" viewBox="0 0 640 230" data-anchor={spec.id} role="img" aria-label="波形圖">
      <path d={sinePath(amp, wavelength, phase)} className="wave-line draw" pathLength={1} />
      {marks.has('eq') && (
        <line x1="24" y1="110" x2="616" y2="110" className="wave-eq draw" pathLength={1} data-anchor="eq" />
      )}
      {marks.has('crest') && <circle cx="94" cy={110 - amp} r="5" className="wave-dot ink" data-anchor="crest" />}
      {marks.has('trough') && <circle cx="234" cy={110 + amp} r="5" className="wave-dot ink" data-anchor="trough" />}
      {marks.has('amp') && (
        <g data-anchor="amp" className="ink">
          <line x1="94" y1="110" x2="94" y2={110 - amp} className="wave-arrow draw" pathLength={1} />
          <path d={`M88 ${110 - amp + 12} L94 ${110 - amp} L100 ${110 - amp + 12}`} className="wave-arrow draw" pathLength={1} />
        </g>
      )}
      {marks.has('lambda') && (
        <g data-anchor="lambda" className="ink">
          <path d="M94 198 H374" className="wave-brace draw" pathLength={1} />
          <path d="M94 192 V204 M374 192 V204" className="wave-brace draw" pathLength={1} />
        </g>
      )}
    </svg>
  )
}