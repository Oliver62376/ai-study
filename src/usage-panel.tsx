import { useState } from 'react'
import { loadGatewayQuotaState, quotaMeters, clearGatewayQuota } from './gateway-quota'
import { loadSettings } from './settings'
import {
  loadTokenTotals,
  loadTokenHistory,
  resetTokenTotals,
  clearTokenHistory,
  type TokenHistoryPoint,
} from './tokens'

function QuotaBar({ label, percentUsed, detail }: { label: string; percentUsed: number; detail: string }) {
  return (
    <article className="quota-card">
      <p className="quota-card-label">{label}</p>
      <p className="quota-card-stat">
        <strong>{percentUsed}%</strong> <span className="quota-card-sub">已使用</span>
      </p>
      <div className="quota-bar" role="progressbar" aria-valuenow={percentUsed} aria-valuemin={0} aria-valuemax={100}>
        <div className="quota-bar-fill" style={{ width: `${Math.min(100, Math.max(0, percentUsed))}%` }} />
      </div>
      <p className="os-muted quota-card-detail">{detail}</p>
    </article>
  )
}

function TokenBarChart({ points }: { points: TokenHistoryPoint[] }) {
  if (!points.length) return <p className="os-muted">尚無呼叫紀錄。成功連線模型後會出現圖表。</p>
  const max = Math.max(1, ...points.map((p) => p.prompt + p.completion))
  return (
    <div className="token-chart" aria-label="最近呼叫 token 用量">
      {points.map((point, index) => {
        const total = point.prompt + point.completion
        const h = Math.max(6, Math.round((total / max) * 100))
        return (
          <div key={`${point.at}-${index}`} className="token-chart-col" title={`輸入 ${point.prompt} · 輸出 ${point.completion}`}>
            <div className="token-chart-stack" style={{ height: `${h}%` }}>
              <span className="token-chart-out" style={{ flex: point.completion }} />
              <span className="token-chart-in" style={{ flex: point.prompt }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function UsagePanel() {
  const settings = loadSettings()
  const official = settings.provider === 'official'
  const [quotaTick, setQuotaTick] = useState(0)
  const [tokenTick, setTokenTick] = useState(0)

  void quotaTick
  void tokenTick

  const meters = quotaMeters(loadGatewayQuotaState())
  const totals = loadTokenTotals()
  const history = loadTokenHistory()

  if (official) {
    const primary = meters.find((m) => m.label === '今日 Token') ?? meters[0]
    return (
      <section className="usage-panel">
        <h2>官方 API 用量</h2>
        <p className="os-muted">數字來自 Gateway 回應的 gateway_quota（-1 表示該項無上限）。</p>
        {!meters.length && <p className="os-muted">尚無資料。請先以啟用碼成功呼叫一次模型。</p>}
        {primary && (
          <QuotaBar
            label={primary.label === '今日 Token' ? '每日 Token 上限' : primary.label}
            percentUsed={primary.percentUsed}
            detail={
              primary.unlimited
                ? `剩餘 ${primary.remaining.toLocaleString()}（無固定上限）`
                : `剩餘 ${primary.remaining.toLocaleString()} / 約 ${primary.cap.toLocaleString()}`
            }
          />
        )}
        <div className="quota-grid">
          {meters
            .filter((m) => m !== primary)
            .map((m) => (
              <QuotaBar
                key={m.label}
                label={m.label}
                percentUsed={m.percentUsed}
                detail={
                  m.unlimited
                    ? `剩餘 ${m.remaining.toLocaleString()}`
                    : `剩餘 ${m.remaining.toLocaleString()} / 約 ${m.cap.toLocaleString()}`
                }
              />
            ))}
        </div>
        <button
          type="button"
          className="nb-plain-btn"
          onClick={() => {
            clearGatewayQuota()
            setQuotaTick((n) => n + 1)
          }}
        >
          清除快取用量顯示
        </button>
      </section>
    )
  }

  return (
    <section className="usage-panel">
      <h2>Token 用量</h2>
      <p className="os-muted">
        輸入（prompt）<strong>{totals.prompt.toLocaleString()}</strong> · 輸出（completion）
        <strong> {totals.completion.toLocaleString()}</strong> · 共 {totals.calls} 次呼叫
      </p>
      <TokenBarChart points={history} />
      <div className="token-legend">
        <span className="token-legend-in">輸入</span>
        <span className="token-legend-out">輸出</span>
      </div>
      <button
        type="button"
        className="nb-plain-btn"
        onClick={() => {
          resetTokenTotals()
          clearTokenHistory()
          setTokenTick((n) => n + 1)
        }}
      >
        歸零統計
      </button>
    </section>
  )
}