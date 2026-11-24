import type { ForceArrow, ForcesReveal, PlotCurve, PlotPoint, PlotReveal, Reveal } from './model'

export function mergeReveal(existing: Reveal, incoming: Reveal): Reveal | null {
  if (existing.id !== incoming.id || existing.page !== incoming.page) return null
  if (existing.type === 'forces' && incoming.type === 'forces') {
    const a = existing as ForcesReveal
    const b = incoming as ForcesReveal
    const seen = new Set(a.arrows.map((arrow) => arrow.id))
    const mergedArrows: ForceArrow[] = [...a.arrows, ...b.arrows.filter((arrow) => !seen.has(arrow.id))]
    return {
      type: 'forces',
      id: a.id,
      page: a.page,
      body: b.body ?? a.body,
      arrows: mergedArrows,
      caption: b.caption ?? a.caption,
      intent: b.intent ?? a.intent,
    }
  }
  if (existing.type === 'plot' && incoming.type === 'plot') {
    const a = existing as PlotReveal
    const b = incoming as PlotReveal
    const fnSet = new Set((a.curves ?? []).map((curve) => curve.fn))
    const mergedCurves: PlotCurve[] = [
      ...(a.curves ?? []),
      ...(b.curves ?? []).filter((curve) => !fnSet.has(curve.fn)),
    ]
    const pointKey = (p: PlotPoint) => `${p.x}:${p.y}`
    const ptSet = new Set((a.points ?? []).map(pointKey))
    const mergedPoints: PlotPoint[] = [
      ...(a.points ?? []),
      ...(b.points ?? []).filter((point) => !ptSet.has(pointKey(point))),
    ]
    return {
      type: 'plot',
      id: a.id,
      page: a.page,
      xMin: b.xMin ?? a.xMin,
      xMax: b.xMax ?? a.xMax,
      yMin: b.yMin ?? a.yMin,
      yMax: b.yMax ?? a.yMax,
      showAxes: b.showAxes ?? a.showAxes,
      curves: mergedCurves.length ? mergedCurves : undefined,
      points: mergedPoints.length ? mergedPoints : undefined,
      caption: b.caption ?? a.caption,
      intent: b.intent ?? a.intent,
    }
  }
  return null
}

export function upsertReveal(reveals: Reveal[], incoming: Reveal): { reveals: Reveal[]; merged: boolean } {
  const index = reveals.findIndex((item) => item.id === incoming.id)
  if (index < 0) return { reveals: [...reveals, incoming], merged: false }
  const merged = mergeReveal(reveals[index], incoming)
  if (!merged) return { reveals, merged: false }
  const next = [...reveals]
  next[index] = merged
  return { reveals: next, merged: true }
}