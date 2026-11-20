import { toPng } from 'html-to-image'
import { PDFDocument } from 'pdf-lib'

export async function captureSheet(page: HTMLElement) {
  page.classList.add('is-export')
  await document.fonts.ready
  await new Promise((resolve) => window.setTimeout(resolve, 60))
  try {
    const backgroundColor = getComputedStyle(page).backgroundColor || '#fbfaf7'
    return await toPng(page, { pixelRatio: 2, backgroundColor, cacheBust: true })
  } finally {
    page.classList.remove('is-export')
  }
}

async function embedRaster(pdf: PDFDocument, dataUrl: string) {
  if (/image\/jpe?g/i.test(dataUrl) || dataUrl.startsWith('data:image/jp')) {
    return pdf.embedJpg(dataUrl)
  }
  return pdf.embedPng(dataUrl)
}

export async function boardPdf(images: string[]) {
  const pdf = await PDFDocument.create()
  for (const dataUrl of images) {
    const png = await embedRaster(pdf, dataUrl)
    const width = 842
    const height = Math.max(420, Math.round((width * png.height) / png.width))
    const sheet = pdf.addPage([width, height])
    sheet.drawImage(png, { x: 0, y: 0, width, height })
  }
  const bytes = await pdf.save()
  return new Blob([Uint8Array.from(bytes)], { type: 'application/pdf' })
}

async function blobToBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const size = 0x8000
  for (let index = 0; index < bytes.length; index += size) {
    binary += String.fromCharCode(...bytes.subarray(index, index + size))
  }
  return btoa(binary)
}

export async function sharePdf(blob: Blob, filename = '白板.pdf') {
  const file = new File([blob], filename, { type: 'application/pdf' })
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: '白板' })
    return
  }

  const { Capacitor } = await import('@capacitor/core')
  if (Capacitor.isNativePlatform()) {
    const { Directory, Filesystem } = await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')
    const path = `blackboard-${Date.now()}.pdf`
    await Filesystem.writeFile({
      path,
      data: await blobToBase64(blob),
      directory: Directory.Cache,
    })
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache })
    await Share.share({ title: filename, url: uri, dialogTitle: '匯出白板 PDF' })
    return
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
