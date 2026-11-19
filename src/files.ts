import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import mammoth from 'mammoth'
import JSZip from 'jszip'

GlobalWorkerOptions.workerSrc = workerUrl

const limit = 120_000

export async function readUploads(files: File[]) {
  const parts: string[] = []
  for (const file of files) {
    const text = (await readOne(file)).replace(/\u0000/g, '').trim()
    if (!text) throw new Error(`${file.name} 裡沒有讀到文字`)
    parts.push(`【${file.name}】\n${text}`)
  }
  const joined = parts.join('\n\n')
  if (joined.length <= limit) return joined
  return `${joined.slice(0, limit)}\n\n（檔案太長，後面先不送進備課。）`
}

async function readOne(file: File) {
  const name = file.name.toLowerCase()
  if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.text') || file.type.startsWith('text/')) {
    return file.text()
  }
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return readPdf(file)
  if (name.endsWith('.docx')) return readDocx(file)
  if (name.endsWith('.pptx')) return readPptx(file)
  if (name.endsWith('.doc') || name.endsWith('.ppt')) {
    throw new Error(`${file.name} 是舊版格式。請另存成 docx 或 pptx 再上傳。`)
  }
  throw new Error(`${file.name} 目前讀不了。請用 PDF、Word（docx）、PowerPoint（pptx）或純文字。`)
}

async function readPdf(file: File) {
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
  return pages.join('\n')
}

async function readDocx(file: File) {
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
  return result.value
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
