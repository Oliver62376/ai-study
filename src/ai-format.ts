/** 讓 AI 輸出較適合 App 內顯示，減少 Markdown 符號。 */
export function formatAiPlainText(raw: string): string {
  let text = raw.trim()
  text = text.replace(/^#{1,6}\s+/gm, '')
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1')
  text = text.replace(/\*([^*]+)\*/g, '$1')
  text = text.replace(/__([^_]+)__/g, '$1')
  text = text.replace(/_([^_]+)_/g, '$1')
  text = text.replace(/^>\s?/gm, '')
  text = text.replace(/^[\t ]*[-*+]\s+/gm, '・')
  text = text.replace(/`([^`]+)`/g, '$1')
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  text = text.replace(/\n{3,}/g, '\n\n')
  return text.trim()
}

export const noMarkdownHint =
  '請用繁體中文純文字回答。不要使用 #、*、**、項目符號或 Markdown。需要分段就空一行；條列請用「1.」「2.」或「・」。'