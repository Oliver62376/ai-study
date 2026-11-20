import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { UploadMode } from './preferences'

GlobalWorkerOptions.workerSrc = workerUrl

export async function ocrDataUrl(dataUrl: string): Promise<string> {
  const { Capacitor } = await import('@capacitor/core')
  if (Capacitor.getPlatform() === 'ios') {
    const w = window as Window & { StudyOcr?: { recognize: (opts: { dataUrl: string }) => Promise<{ text?: string }> } }
    if (w.StudyOcr?.recognize) {
      try {
        const out = await w.StudyOcr.recognize({ dataUrl })
        return (out.text ?? '').trim()
      } catch {
        /* fall through */
      }
    }
  }
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('chi_tra', 1, { logger: () => {} })
  try {
    const { data } = await worker.recognize(dataUrl)
    return data.text.replace(/\s+/g, ' ').trim()
  } finally {
    await worker.terminate()
  }
}

export async function pdfPageToJpeg(data: Uint8Array, pageNumber: number, scale = 1.6): Promise<string> {
  const pdf = await getDocument({ data }).promise
  const page = await pdf.getPage(pageNumber)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  await page.render({ canvasContext: ctx, viewport, canvas } as Parameters<typeof page.render>[0]).promise
  return canvas.toDataURL('image/jpeg', 0.82)
}

export async function imageFileToJpeg(file: File): Promise<string> {
  const dataUrl = await readAsDataUrl(file)
  if (file.type === 'image/jpeg' || file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg')) {
    return dataUrl
  }
  return rasterizeDataUrl(dataUrl)
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

async function rasterizeDataUrl(dataUrl: string) {
  const image = new Image()
  image.decoding = 'async'
  image.src = dataUrl
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  ctx.drawImage(image, 0, 0)
  return canvas.toDataURL('image/jpeg', 0.85)
}

export interface VisionPage {
  name: string
  page?: number
  dataUrl: string
}

export async function pdfVisionPages(data: Uint8Array, fileName: string): Promise<VisionPage[]> {
  const pdf = await getDocument({ data }).promise
  const pages: VisionPage[] = []
  for (let index = 1; index <= Math.min(pdf.numPages, 12); index += 1) {
    pages.push({
      name: fileName,
      page: index,
      dataUrl: await pdfPageToJpeg(data, index),
    })
  }
  return pages
}

export function visionBlock(pages: VisionPage[]) {
  if (!pages.length) return ''
  return pages
    .map((item) => `【圖片：${item.name}${item.page ? ` 第 ${item.page} 頁` : ''}】（已附上視覺內容，請閱讀圖中文字與圖示）`)
    .join('\n')
}

export function shouldOcr(mode: UploadMode, textEmpty: boolean) {
  return mode === 'ocr' && textEmpty
}

export function shouldVision(mode: UploadMode, isImageOrScan: boolean) {
  return mode === 'vision' && isImageOrScan
}