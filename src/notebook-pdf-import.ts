import { getDocument } from 'pdfjs-dist'
import { renderPdfPage } from './ocr'
import { emptyPage, type NotePage } from './notebook'

export async function pagesFromPdfFile(file: File, maxPages = 32): Promise<{ title: string; pages: NotePage[] }> {
  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await getDocument({ data: data.slice() }).promise
  const title = file.name.replace(/\.pdf$/i, '') || 'PDF 筆記'
  const pages: NotePage[] = []
  const max = Math.min(pdf.numPages, maxPages)
  for (let index = 1; index <= max; index += 1) {
    const jpeg = await renderPdfPage(pdf, index, 1.5)
    pages.push({
      ...emptyPage(`${title} 第 ${index} 頁`, 'blank'),
      background: jpeg,
    })
  }
  if (!pages.length) throw new Error('PDF 沒有可匯入的頁面')
  return { title, pages }
}