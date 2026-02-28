import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { SessionData } from '../types/session'
import TagFilter, { filterByTags } from '../components/TagFilter'
import styles from './TokensPage.module.css'

interface Props {
  sessions: SessionData[]
}

interface LogTokenEntry {
  date: string
  tokens: number
  utilisation: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TooltipContent = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#0a0e1f',
      border: '1px solid #1a2a4a',
      padding: '8px 12px',
      fontFamily: 'inherit',
      fontSize: 11,
    }}>
      <div style={{ color: '#4a7a9b', marginBottom: 4 }}>{label}</div>
      {payload.map((p: { name: string; value: number; color: string }, i: number) => (
        <div key={i} style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
        </div>
      ))}
    </div>
  )
}

const basename = (path: string): string =>
  path.split('/').filter(Boolean).pop() || path

type TimeRange = '1D' | '1W' | '1M' | 'ALL'

function filterByRange<T extends { date: string }>(data: T[], range: TimeRange): T[] {
  if (range === 'ALL') return data
  const now = Date.now()
  const ms = range === '1D' ? 86400000 : range === '1W' ? 604800000 : 2592000000
  const cutoff = new Date(now - ms).toISOString().slice(0, 10)
  return data.filter((d) => d.date >= cutoff)
}

export default function TokensPage({ sessions }: Props) {
  const [logTokens, setLogTokens] = useState<LogTokenEntry[]>([])
  const [range, setRange] = useState<TimeRange>('1M')
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())

  useEffect(() => {
    window.gridwatchAPI.getLogTokens().then(setLogTokens).catch(() => {})
  }, [])

  const filtered = filterByTags(sessions, selectedTags)
  const sessionsWithData = filtered.filter((s) => s.peakTokens > 0)
  const avgUtilisation = sessionsWithData.length > 0
    ? sessionsWithData.reduce((sum, s) => sum + s.peakUtilisation, 0) / sessionsWithData.length
    : 0
  const maxTokens = sessionsWithData.length > 0
    ? Math.max(...sessionsWithData.map((s) => s.peakTokens))
    : 0

  // Line chart data: one point per log file entry (by date)
  // Aggregate by date (multiple log files can share the same date), keeping peak tokens
  const lineMap = new Map<string, { tokens: number; utilisation: number }>()
  logTokens.forEach((entry) => {
    const existing = lineMap.get(entry.date)
    if (!existing || entry.tokens > existing.tokens) {
      lineMap.set(entry.date, { tokens: entry.tokens, utilisation: entry.utilisation })
    }
  })
  const lineData = filterByRange(
    Array.from(lineMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { tokens, utilisation }]) => ({ date, tokens, util: utilisation })),
    range,
  )

  const hasData = lineData.length > 0

  return (
    <div className={styles.page}>
      <div className={styles.pageTitle}>TOKEN USAGE</div>
      <TagFilter sessions={sessions} selectedTags={selectedTags} onChange={setSelectedTags} />

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{sessionsWithData.length}</div>
          <div className={styles.statLabel}>SESSIONS WITH DATA</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{avgUtilisation.toFixed(1)}%</div>
          <div className={styles.statLabel}>AVG PEAK UTILISATION</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{maxTokens.toLocaleString()}</div>
          <div className={styles.statLabel}>MAX TOKENS SEEN</div>
        </div>
      </div>

      {!hasData && (
        <div className={styles.empty}>NO TOKEN DATA AVAILABLE</div>
      )}

      {hasData && (
        <div className={styles.rangeRow}>
          {(['1D', '1W', '1M', 'ALL'] as TimeRange[]).map((r) => (
            <button
              key={r}
              className={`${styles.rangeBtn} ${range === r ? styles.rangeBtnActive : ''}`}
              onClick={() => setRange(r)}
            >{r}</button>
          ))}
        </div>
      )}

      {lineData.length > 0 && (
        <div className={styles.chartPanel}>
          <div className={styles.chartTitle}>PEAK TOKEN USAGE OVER TIME</div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={lineData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid stroke="#1a2a4a" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fill: '#4a7a9b', fontSize: 10 }} />
              <YAxis tick={{ fill: '#4a7a9b', fontSize: 10 }} />
              <Tooltip content={<TooltipContent />} />
              <Line
                type="monotone"
                dataKey="tokens"
                name="Tokens"
                stroke="#00f5ff"
                strokeWidth={2}
                dot={{ fill: '#ff6600', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className={styles.contextNote}>Context window: 128,000 tokens</div>
        </div>
      )}

      {sessionsWithData.length > 0 && (
        <div className={styles.chartPanel}>
          <div className={styles.chartTitle}>TOKEN USAGE BY SESSION</div>
          <table className={styles.sessionTable}>
            <thead>
              <tr className={styles.tableHeader}>
                <th className={styles.thLeft}>SUMMARY</th>
                <th className={styles.thLeft}>REPOSITORY</th>
                <th className={styles.thRight}>PEAK TOKENS</th>
                <th className={styles.thRight}>PEAK %</th>
                <th className={styles.thBar}></th>
              </tr>
            </thead>
            <tbody>
              {[...sessionsWithData]
                .sort((a, b) => b.peakTokens - a.peakTokens)
                .map((s, i) => {
                  const pct = (s.peakTokens / 128000) * 100
                  const repo = s.repository || basename(s.cwd)
                  const summary = s.summary || s.lastUserMessage || '—'
                  return (
                    <tr
                      key={s.id}
                      className={styles.tableRow}
                      style={{ background: i % 2 === 1 ? 'rgba(0,245,255,0.02)' : undefined }}
                    >
                      <td className={styles.tdSummary}>{summary}</td>
                      <td className={styles.tdRepo}>{repo}</td>
                      <td className={styles.tdRight}>{s.peakTokens.toLocaleString()}</td>
                      <td className={styles.tdRight}>{s.peakUtilisation.toFixed(1)}%</td>
                      <td className={styles.tdBar}>
                        <div className={styles.miniBarTrack}>
                          <div
                            className={styles.miniBarFill}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
