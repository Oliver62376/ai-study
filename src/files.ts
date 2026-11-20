import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import mammoth from 'mammoth'
import JSZip from 'jszip'
import { loadPreferences, type UploadMode } from './preferences'
import { imageFileToJpeg, ocrDataUrl, pdfPageToJpeg, shouldOcr, shouldVision, visionBlock, type VisionPage } from './ocr'

GlobalWorkerOptions.workerSrc = workerUrl

const limit = 120_000
const visionLimit = 8

export interface UploadChip {
  id: string
  name: string
  kind: 'text' | 'image' | 'loading' | 'error'
  detail?: string
}

export interface ReadUploadResult {
  text: string
  chips: UploadChip[]
  visionPages: VisionPage[]
}

export async function readUploads(files: File[]): Promise<ReadUploadResult> {
  const mode = loadPreferences().uploadMode
  const parts: string[] = []
  const chips: UploadChip[] = []
  const visionPages: VisionPage[] = []

  for (const file of files) {
    const id = `${file.name}-${file.size}-${file.lastModified}`
    chips.push({ id, name: file.name, kind: 'loading' })
    try {
      const chunk = await readOne(file, mode, visionPages)
      parts.push(`【${file.name}】\n${chunk.text}`)
      const chip: UploadChip = {
        id,
        name: file.name,
        kind: chunk.kind,
        detail: chunk.detail,
      }
      chips.splice(
        chips.findIndex((item) => item.id === id),
        1,
        chip,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : '讀取失敗'
      chips.splice(
        chips.findIndex((item) => item.id === id),
        1,
        { id, name: file.name, kind: 'error', detail: message },
      )
    }
  }

  const visionNote = visionPages.length ? `\n\n${visionBlock(visionPages.slice(0, visionLimit))}` : ''
  let joined = `${parts.join('\n\n')}${visionNote}`
  if (joined.length <= limit) return { text: joined, chips, visionPages: visionPages.slice(0, visionLimit) }
  return {
    text: `${joined.slice(0, limit)}\n\n（內容過長，後段未送入備課。）`,
    chips,
    visionPages: visionPages.slice(0, visionLimit),
  }
}

async function readOne(file: File, mode: UploadMode, visionBucket: VisionPage[]) {
  const name = file.name.toLowerCase()
  const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|heic)$/i.test(name)

  if (isImage) {
    const jpeg = await imageFileToJpeg(file)
    if (shouldVision(mode, true)) {
      visionBucket.push({ name: file.name, dataUrl: jpeg })
      return { text: '（圖片已附上，請依圖作答）', kind: 'image' as const, detail: '視覺模式' }
    }
    if (mode === 'ocr' || mode === 'text') {
      const text = await ocrDataUrl(jpeg)
      if (text) return { text, kind: 'text' as const, detail: 'OCR' }
      if (mode === 'ocr') throw new Error('圖片 OCR 沒有讀到文字')
      visionBucket.push({ name: file.name, dataUrl: jpeg })
      return { text: '（圖片已附上）', kind: 'image' as const, detail: '改以視覺' }
    }
  }

  if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.text') || file.type.startsWith('text/')) {
    const text = (await file.text()).replace(/\u0000/g, '').trim()
    if (!text) throw new Error('檔案沒有文字')
    return { text, kind: 'text' as const }
  }

  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    return readPdf(file, mode, visionBucket)
  }
  if (name.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    const text = result.value.trim()
    if (!text) throw new Error('Word 裡沒有讀到文字')
    return { text, kind: 'text' as const }
  }
  if (name.endsWith('.pptx')) {
    const text = await readPptx(file)
    if (!text) throw new Error('簡報裡沒有讀到文字')
    return { text, kind: 'text' as const }
  }
  if (name.endsWith('.doc') || name.endsWith('.ppt')) {
    throw new Error('舊版格式，請另存成 docx 或 pptx')
  }
  throw new Error('不支援的格式')
}

async function readPdf(file: File, mode: UploadMode, visionBucket: VisionPage[]) {
  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await getDocument({ data }).promise
  const pages: string[] = []
  for (let index = 1; index <= pdf.numPages; index += 1) {
    const page = await pdf.getPage(index)
    const content = await page.getTextContent()
    const line = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/[ \t]+/g, ' ')
      .trim()
    if (line) pages.push(line)
  }
  const textLayer = pages.join('\n').trim()
  if (textLayer) return { text: textLayer, kind: 'text' as const, detail: '文字層' }

  if (mode === 'text') {
    throw new Error('PDF 沒有文字層。請在設定改為 OCR 或視覺模式。')
  }

  const ocrParts: string[] = []
  const maxPages = Math.min(pdf.numPages, 12)
  for (let index = 1; index <= maxPages; index += 1) {
    const jpeg = await pdfPageToJpeg(data, index)
    if (shouldVision(mode, true)) {
      visionBucket.push({ name: file.name, page: index, dataUrl: jpeg })
      ocrParts.push(`（第 ${index} 頁以圖附上）`)
      continue
    }
    if (shouldOcr(mode, true)) {
      const text = await ocrDataUrl(jpeg)
      if (text) ocrParts.push(`第 ${index} 頁：${text}`)
    }
  }
  const merged = ocrParts.join('\n').trim()
  if (!merged && visionBucket.some((item) => item.name === file.name)) {
    return { text: '（掃描 PDF，請閱讀附圖）', kind: 'image' as const, detail: '掃描頁' }
  }
  if (!merged) throw new Error('PDF OCR 沒有讀到內容')
  return { text: merged, kind: 'text' as const, detail: 'OCR' }
}

async function readPptx(file: File) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const names = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => slideNumber(a) - slideNumber(b))
  const slides: string[] = []
  for (const name of names) {
    const xml = await zip.files[name].async('string')
    const text = [...xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)]
      .map((match) => decodeXml(match[1]).trim())
      .filter(Boolean)
      .join(' ')
    if (text) slides.push(text)
  }
  return slides.join('\n')
}

function slideNumber(name: string) {
  return Number(name.match(/slide(\d+)/)?.[1] ?? 0)
}

function decodeXml(value: string) {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&')
}