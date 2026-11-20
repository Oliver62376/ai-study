import { useState } from 'react'
import { gradeLabel } from './profile'
import { grade as scoreAnswer, type Difficulty, type QuizQ } from './model'
import { parseQuiz, quizPrompt } from './prompt'
import { askProvider, isConnected, loadSettings } from './settings'
import { ShellPage } from './shell'

export function QuizScreen({
  materialText,
  audience,
  onClose,
  onSettings,
}: {
  materialText: string
  audience: string
  onClose: () => void
  onSettings: () => void
}) {
  const [difficulty, setDifficulty] = useState<Difficulty>('mid')
  const [count, setCount] = useState(3)
  const [queue, setQueue] = useState<QuizQ[]>([])
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<'setup' | 'ask' | 'review' | 'done' | 'empty'>('setup')
  const [draft, setDraft] = useState('')
  const [review, setReview] = useState('')
  const [correctCount, setCorrectCount] = useState(0)
  const [busy, setBusy] = useState(false)
  const [emptyText, setEmptyText] = useState('先備好一堂課，再來測驗。')
  const current = queue[index]

  async function begin() {
    const settings = loadSettings()
    if (!materialText.trim()) {
      setEmptyText('還沒有教材。先在首頁開一堂課。')
      setPhase('empty')
      return
    }
    if (!isConnected(settings)) {
      setEmptyText('測驗由模型依這份教材出題。請先接上模型。')
      setPhase('empty')
      return
    }
    setBusy(true)
    let next: QuizQ[] = []
    const who = audience.trim() || gradeLabel()
    try {
      const raw = await askProvider(
        settings,
        quizPrompt(difficulty, count, who),
        materialText,
        '你只負責依教材出題。照使用者要求的 JSON 格式回覆，不要講課，不要加螢光筆，不要換成別的科目。',
      )
      next = raw ? parseQuiz(raw).slice(0, count) : []
    } catch {
      next = []
    }
    if (next.length === 0) setEmptyText('模型這次沒有出題。再試一次，或檢查 API。')
    setQueue(next)
    setIndex(0)
    setCorrectCount(0)
    setDraft('')
    setReview('')
    setPhase(next.length ? 'ask' : 'empty')
    setBusy(false)
  }

  function answer(text: string) {
    if (!current || !text.trim()) return
    const correct = scoreAnswer(current, text)
    setCorrectCount((value) => value + (correct ? 1 : 0))
    setReview(`${correct ? '這題答對了。' : '這題再看一次。'}${current.explain}`)
    setDraft('')
    setPhase('review')
  }

  function nextQuestion() {
    const following = index + 1
    if (following >= queue.length) {
      setPhase('done')
      return
    }
    setIndex(following)
    setReview('')
    setPhase('ask')
  }

  return (
    <ShellPage onBack={onClose} title="測驗">
      <section className="quiz-board">
        {phase === 'setup' && (
          <div className="quiz-sheet">
            <p className="quiz-kicker">另一面白板</p>
            <p>題目跟上課的白板分開。答完之後，檢討寫在這一面。</p>
            <div className="segmented" role="group" aria-label="難易度">
              {([
                ['easy', '容易'],
                ['mid', '中等'],
                ['hard', '難'],
              ] as const).map(([id, label]) => (
                <button key={id} type="button" aria-pressed={difficulty === id} onClick={() => setDifficulty(id)}>
                  {label}
                </button>
              ))}
            </div>
            <label className="count-line">
              題數 {count}
              <input type="range" min={1} max={8} value={count} onChange={(event) => setCount(Number(event.target.value))} />
            </label>
            <button type="button" className="os-primary" onClick={() => void begin()} disabled={busy}>
              {busy ? '出題中' : '開始作答'}
            </button>
          </div>
        )}
        {phase === 'empty' && (
          <div className="quiz-sheet">
            <h2>這次沒有題目</h2>
            <p>{emptyText}</p>
            {!isConnected(loadSettings()) && (
              <button type="button" className="os-primary" onClick={onSettings}>
                前往模型
              </button>
            )}
            <button type="button" onClick={onClose}>
              返回
            </button>
          </div>
        )}
        {phase === 'ask' && current && (
          <div className="quiz-sheet">
            <p className="quiz-kicker">
              第 {index + 1} / {queue.length} 題
            </p>
            <h2>{current.prompt}</h2>
            {current.kind === 'choice' ? (
              <div className="quiz-choices">
                {current.choices?.map((choice) => (
                  <button key={choice} type="button" onClick={() => answer(choice)}>
                    {choice}
                  </button>
                ))}
              </div>
            ) : (
              <form
                className="quiz-fill"
                onSubmit={(event) => {
                  event.preventDefault()
                  answer(draft)
                }}
              >
                <input value={draft} placeholder="寫下答案" onChange={(event) => setDraft(event.target.value)} />
                <button type="submit" className="os-primary">
                  送出
                </button>
              </form>
            )}
          </div>
        )}
        {phase === 'review' && current && (
          <div className="quiz-sheet">
            <p className="quiz-kicker">檢討</p>
            <h2>{current.prompt}</h2>
            <p className="review-line">{review}</p>
            <button type="button" className="os-primary" onClick={nextQuestion}>
              {index + 1 >= queue.length ? '看結果' : '下一題'}
            </button>
          </div>
        )}
        {phase === 'done' && (
          <div className="quiz-sheet">
            <p className="quiz-kicker">結果</p>
            <h2>
              {correctCount} / {queue.length}
            </h2>
            <p>檢討留在這一面，沒有寫回上課的白板。</p>
            <button type="button" className="os-primary" onClick={onClose}>
              返回
            </button>
          </div>
        )}
      </section>
    </ShellPage>
  )
}