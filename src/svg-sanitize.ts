/** 白板用：只允許靜態示意 SVG，擋 script / 事件屬性。 */
export function sanitizeBoardSvg(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed || !/<svg[\s>]/i.test(trimmed)) return null
  if (typeof DOMParser === 'undefined') return trimmed.length <= 12000 ? trimmed : null

  const doc = new DOMParser().parseFromString(trimmed, 'image/svg+xml')
  const root = doc.documentElement
  if (root.nodeName.toLowerCase() !== 'svg') return null

  const allowed = new Set([
    'svg',
    'g',
    'path',
    'line',
    'circle',
    'ellipse',
    'rect',
    'polyline',
    'polygon',
    'text',
    'tspan',
    'defs',
    'marker',
    'lineargradient',
    'radialgradient',
    'stop',
    'title',
    'desc',
  ])

  const walk = (node: Element): boolean => {
    const tag = node.tagName.toLowerCase()
    if (!allowed.has(tag)) {
      node.remove()
      return false
    }
    for (const attr of [...node.attributes]) {
      const name = attr.name.toLowerCase()
      if (name.startsWith('on') || name === 'href' && attr.value.trim().toLowerCase().startsWith('javascript:')) {
        node.removeAttribute(attr.name)
        continue
      }
      if (tag === 'svg' || tag === 'g' || tag === 'path' || tag === 'line' || tag === 'circle') {
        /* keep */
      } else if (name === 'style' && /url\s*\(/i.test(attr.value)) {
        node.removeAttribute(attr.name)
      }
    }
    for (const child of [...node.children]) {
      walk(child)
    }
    return true
  }

  walk(root)
  const out = new XMLSerializer().serializeToString(root)
  return out.length <= 16000 ? out : null
}