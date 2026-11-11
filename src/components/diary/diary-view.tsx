import { useEffect, useMemo, useRef, useState } from "react"
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameMonth,
  startOfMonth,
} from "date-fns"
import { ja } from "date-fns/locale"
import { useLiveQuery } from "dexie-react-hooks"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { db, saveDiary, sessionMinutes, type DiaryEntry, type PomodoroSession } from "@/lib/db"
import { formatDuration } from "@/lib/duration"
import { isImeKey } from "@/lib/ime"
import { cn } from "@/lib/utils"

const dateKey = (d: Date) => format(d, "yyyy-MM-dd")

/** 1日1行のスプレッドシート風の日記。今月は今日まで、過去の月は月末まで並べる */
export function DiaryView() {
  const today = new Date()
  const todayKey = dateKey(today)
  const [month, setMonth] = useState(() => startOfMonth(today))
  const isThisMonth = isSameMonth(month, today)
  const days = eachDayOfInterval({ start: month, end: isThisMonth ? today : endOfMonth(month) })
  const from = dateKey(month)
  const to = dateKey(endOfMonth(month))

  const entries = useLiveQuery(
    () => db.diaries.where("date").between(from, to, true, true).toArray(),
    [from, to],
  )
  const sessions = useLiveQuery(
    () =>
      db.pomodoros
        .where("startedAt")
        .between(month.getTime(), addMonths(month, 1).getTime())
        .toArray(),
    [month],
    [] as PomodoroSession[],
  )
  const bodies = useMemo(
    () => new Map((entries ?? []).map((e: DiaryEntry) => [e.date, e.body])),
    [entries],
  )
  const focus = useMemo(() => {
    const map = new Map<string, { count: number; minutes: number }>()
    for (const s of sessions) {
      const key = dateKey(new Date(s.startedAt))
      const cur = map.get(key) ?? { count: 0, minutes: 0 }
      map.set(key, { count: cur.count + 1, minutes: cur.minutes + sessionMinutes(s) })
    }
    return map
  }, [sessions])

  // 開いたらすぐ今日の分を書き始められるよう、今日を選んでおく
  const [active, setActive] = useState<string | null>(todayKey)
  const [editing, setEditing] = useState(false)

  const changeMonth = (next: Date) => {
    setMonth(next)
    setEditing(false)
    setActive(isSameMonth(next, today) ? todayKey : null)
  }

  // 今月は一番下の今日が見えるところまでスクロールしておく
  const scrollRef = useRef<HTMLDivElement>(null)
  const loaded = entries !== undefined
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !loaded) return
    el.scrollTop = isThisMonth ? el.scrollHeight : 0
  }, [loaded, isThisMonth, from])

  const navigate = (from: string, dir: 1 | -1) => {
    const i = days.findIndex((d) => dateKey(d) === from)
    const next = days[Math.min(Math.max(i + dir, 0), days.length - 1)]
    setActive(dateKey(next))
  }

  const commit = (date: string, raw: string, move?: 1 | -1) => {
    setEditing(false)
    if (raw.trimEnd() !== (bodies.get(date) ?? "")) void saveDiary(date, raw)
    if (move) navigate(date, move)
  }

  const written = days.filter((d) => bodies.has(dateKey(d))).length

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <Button
          variant="ghost"
          size="icon-sm"
          title="前の月"
          onClick={() => changeMonth(addMonths(month, -1))}
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="次の月"
          disabled={isThisMonth}
          onClick={() => changeMonth(addMonths(month, 1))}
        >
          <ChevronRightIcon />
        </Button>
        <h2 className="text-sm font-semibold">{format(month, "yyyy年M月", { locale: ja })}</h2>
        {!isThisMonth && (
          <Button variant="outline" size="sm" onClick={() => changeMonth(startOfMonth(today))}>
            今月
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {written} 日分 ・ Shift+Enter で改行
        </span>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
        <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
          <colgroup>
            <col className="w-28" />
            <col />
            <col className="w-36" />
          </colgroup>
          <thead className="sticky top-0 z-20 bg-muted/80 backdrop-blur">
            <tr className="text-left text-xs text-muted-foreground">
              <th className="h-8 border-b px-3 font-medium">日付</th>
              <th className="border-b border-l px-2 font-medium">日記</th>
              <th className="border-b border-l px-2 font-medium">ポモドーロ</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const key = dateKey(d)
              const body = bodies.get(key) ?? ""
              const isActive = active === key
              const weekday = getDay(d)
              const f = focus.get(key)
              return (
                <tr
                  key={key}
                  onMouseDown={(e) => {
                    if (isActive) return
                    // 既定の動作のままだと、出したばかりの入力欄からフォーカスが外れる
                    e.preventDefault()
                    setActive(key)
                    setEditing(false)
                  }}
                >
                  <td className="border-b px-3 py-1.5 align-top leading-6 tabular-nums">
                    <span
                      className={cn(
                        weekday === 0 && "text-red-600 dark:text-red-400",
                        weekday === 6 && "text-blue-600 dark:text-blue-400",
                      )}
                    >
                      {format(d, "d")}
                      <span className="ml-1 text-xs">{format(d, "E", { locale: ja })}</span>
                    </span>
                    {key === todayKey && (
                      <span className="ml-1.5 rounded bg-primary px-1 py-0.5 text-[10px] text-primary-foreground">
                        今日
                      </span>
                    )}
                  </td>
                  <td
                    className={cn(
                      "relative border-b border-l p-0 align-top",
                      isActive && "outline-2 -outline-offset-2 outline-primary",
                    )}
                  >
                    {!(isActive && editing) && (
                      <div className={cn(TEXT_CLASS, "min-h-9")}>{body}</div>
                    )}
                    {isActive && (
                      <DiaryEditor
                        body={body}
                        editing={editing}
                        onStartEdit={() => setEditing(true)}
                        onCommit={(raw, move) => commit(key, raw, move)}
                        onCancel={() => setEditing(false)}
                        onNavigate={(dir) => navigate(key, dir)}
                        onClear={() => void saveDiary(key, "")}
                      />
                    )}
                  </td>
                  <td className="border-b border-l px-2 py-1.5 align-top leading-6 text-xs text-muted-foreground tabular-nums">
                    {f && (
                      <>
                        {f.count} 🍅 ・ {formatDuration(f.minutes)}
                      </>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** 表示と編集欄で文字の折り返しを揃える */
const TEXT_CLASS = "px-2 py-1.5 leading-6 whitespace-pre-wrap [overflow-wrap:anywhere]"

/**
 * 選択中のセルに置く入力欄。
 * 選択中は透明で、文字を打つと今の日記の続きから書き始める（日本語入力にも対応）。
 * 編集中は透明な同じ文章を下に敷いて、行が増えたらセルも高くなるようにしている。
 */
function DiaryEditor({
  body,
  editing,
  onStartEdit,
  onCommit,
  onCancel,
  onNavigate,
  onClear,
}: {
  body: string
  editing: boolean
  onStartEdit: () => void
  onCommit: (value: string, move?: 1 | -1) => void
  onCancel: () => void
  onNavigate: (dir: 1 | -1) => void
  onClear: () => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [draft, setDraft] = useState(body)
  const committed = useRef(false)

  // 書いている途中で別の日をクリックしたときも、書いた分を残す
  const latest = useRef({ draft, editing, onCommit })
  useEffect(() => {
    latest.current = { draft, editing, onCommit }
  })
  useEffect(
    () => () => {
      const { draft, editing, onCommit } = latest.current
      if (editing && !committed.current) {
        committed.current = true
        onCommit(draft)
      }
    },
    [],
  )

  useEffect(() => {
    ref.current?.focus()
  }, [editing])
  // 選択中はカーソルを末尾に置き、打った文字が続きに入るようにする
  useEffect(() => {
    const el = ref.current
    if (el && !editing) el.setSelectionRange(el.value.length, el.value.length)
  }, [editing, body])

  const startEdit = (value: string) => {
    committed.current = false
    setDraft(value)
    onStartEdit()
  }
  const commit = (move?: 1 | -1) => {
    if (committed.current) return
    committed.current = true
    onCommit(draft, move)
  }

  return (
    <>
      {editing && (
        <div aria-hidden className={cn(TEXT_CLASS, "invisible min-h-9")}>
          {draft + "​"}
        </div>
      )}
      <textarea
        ref={ref}
        rows={1}
        className={cn(
          TEXT_CLASS,
          "absolute inset-0 z-10 block h-full w-full resize-none overflow-hidden outline-none",
          editing
            ? "bg-background outline-2 -outline-offset-2 outline-primary"
            : "cursor-default caret-transparent opacity-0",
        )}
        value={editing ? draft : body}
        onChange={(e) => {
          if (editing) setDraft(e.target.value)
          else startEdit(e.target.value)
        }}
        onCompositionStart={() => {
          if (!editing) startEdit(body)
        }}
        onBlur={() => {
          if (editing) commit()
        }}
        onCopy={(e) => {
          if (editing) return
          e.preventDefault()
          e.clipboardData.setData("text/plain", body)
        }}
        onDoubleClick={() => {
          if (!editing) startEdit(body)
        }}
        onKeyDown={(e) => {
          if (isImeKey(e)) return
          if (editing) {
            if (e.key === "Enter" && e.altKey) {
              // Option+Enter でも改行できるようにする（Sheets と同じ）
              e.preventDefault()
              const el = e.currentTarget
              el.setRangeText("\n", el.selectionStart, el.selectionEnd, "end")
              setDraft(el.value)
            } else if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              commit(1)
            } else if (e.key === "Tab") {
              e.preventDefault()
              commit()
            } else if (e.key === "Escape") {
              e.preventDefault()
              committed.current = true
              onCancel()
            }
            return
          }
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault()
            onNavigate(e.key === "ArrowUp" ? -1 : 1)
          } else if (e.key === "Enter") {
            e.preventDefault()
            startEdit(body)
          } else if (e.key === "Backspace" || e.key === "Delete") {
            e.preventDefault()
            onClear()
          } else if (e.key === "Tab") {
            e.preventDefault()
          } else if (e.key === "Escape") {
            e.currentTarget.blur()
          }
        }}
      />
    </>
  )
}
