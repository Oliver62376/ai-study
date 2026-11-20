import { newId } from './notebook'

export interface NotebookFolder {
  id: string
  name: string
}

const KEY = 'ai-study-notebook-folders-v1'

export function loadFolders(): NotebookFolder[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as NotebookFolder[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function saveFolders(list: NotebookFolder[]) {
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 64)))
}

export function createFolder(name: string) {
  const folder: NotebookFolder = { id: newId('F'), name: name.trim() || '資料夾' }
  saveFolders([folder, ...loadFolders()])
  return folder
}

export function deleteFolder(id: string) {
  saveFolders(loadFolders().filter((item) => item.id !== id))
}

export function renameFolder(id: string, name: string) {
  saveFolders(loadFolders().map((item) => (item.id === id ? { ...item, name: name.trim() || item.name } : item)))
}