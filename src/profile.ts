export const gradeOptions = [
  { id: 'unspecified', label: '不指定' },
  { id: 'e1', label: '國小一年級' },
  { id: 'e2', label: '國小二年級' },
  { id: 'e3', label: '國小三年級' },
  { id: 'e4', label: '國小四年級' },
  { id: 'e5', label: '國小五年級' },
  { id: 'e6', label: '國小六年級' },
  { id: 'j1', label: '國中一年級' },
  { id: 'j2', label: '國中二年級' },
  { id: 'j3', label: '國中三年級' },
  { id: 'h1', label: '高一' },
  { id: 'h2', label: '高二' },
  { id: 'h3', label: '高三' },
  { id: 'u1', label: '大一' },
  { id: 'u2', label: '大二' },
  { id: 'u3', label: '大三' },
  { id: 'u4', label: '大四' },
  { id: 'u5', label: '大學以上／研究所' },
] as const

export type GradeId = (typeof gradeOptions)[number]['id']

const KEY = 'ai-study-grade-v1'
const defaultGrade: GradeId = 'j2'

export function loadGrade(): GradeId {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultGrade
    return gradeOptions.some((item) => item.id === raw) ? (raw as GradeId) : defaultGrade
  } catch {
    return defaultGrade
  }
}

export function saveGrade(id: GradeId) {
  localStorage.setItem(KEY, id)
}

export function gradeLabel(id: GradeId = loadGrade()) {
  return gradeOptions.find((item) => item.id === id)?.label ?? gradeOptions.find((item) => item.id === defaultGrade)!.label
}