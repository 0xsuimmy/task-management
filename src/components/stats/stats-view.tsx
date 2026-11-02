import { useMemo, useState } from "react"
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import { ja } from "date-fns/locale"
import { useLiveQuery } from "dexie-react-hooks"
import { ChevronLeftIcon, ChevronRightIcon, Trash2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { OptionBadge } from "@/components/task-table/option-badge"
import { findOption, useColumns, useTasks } from "@/hooks/use-data"
import {
  db,
  deletePomodoro,
  sessionMinutes,
  STATUS_COLUMN_ID,
  type Column,
  type PomodoroSession,
  type Task,
} from "@/lib/db"
import { formatDuration } from "@/lib/duration"
import { BarChart, type Bucket } from "./bar-chart"

type Range = "day" | "week" | "month"

const NO_TASK = "__none__"

function periodOf(range: Range, anchor: Date) {
  if (range === "day") return { start: startOfDay(anchor), end: endOfDay(anchor) }
  if (range === "week") {
    return {
      start: startOfWeek(anchor, { weekStartsOn: 1 }),
      end: endOfWeek(anchor, { weekStartsOn: 1 }),
    }
  }
  return { start: startOfMonth(anchor), end: endOfMonth(anchor) }
}

function buildBuckets(range: Range, start: Date, end: Date, sessions: PomodoroSession[]): Bucket[] {
  if (range === "day") {
    const buckets: Bucket[] = Array.from({ length: 24 }, (_, h) => ({
      label: h % 3 === 0 ? String(h) : "",
      title: `${h}:00 – ${h + 1}:00`,
      minutes: 0,
      count: 0,
    }))
    for (const s of sessions) {
      const b = buckets[new Date(s.startedAt).getHours()]
      b.minutes += sessionMinutes(s)
      b.count += 1
    }
    return buckets
  }
  const days = eachDayOfInterval({ start, end })
  const buckets: Bucket[] = days.map((d) => ({
    label:
      range === "week"
        ? format(d, "E", { locale: ja })
        : d.getDate() === 1 || d.getDate() % 5 === 0
          ? String(d.getDate())
          : "",
    title: format(d, "M月d日 (E)", { locale: ja }),
    minutes: 0,
    count: 0,
    highlight: isToday(d),
  }))
  for (const s of sessions) {
    const b = buckets[differenceInCalendarDays(new Date(s.startedAt), start)]
    if (!b) continue
    b.minutes += sessionMinutes(s)
    b.count += 1
  }
  return buckets
}

export function StatsView() {
  const [range, setRange] = useState<Range>("week")
  const [anchor, setAnchor] = useState(() => new Date())
  const tasks = useTasks()
  const columns = useColumns()

  const { start, end } = periodOf(range, anchor)
  const sessions = useLiveQuery(
    () =>
      db.pomodoros
        .where("startedAt")
        .between(start.getTime(), end.getTime(), true, true)
        .toArray(),
    [start.getTime(), end.getTime()],
    [] as PomodoroSession[],
  )

  const totalMinutes = sessions.reduce((sum, s) => sum + sessionMinutes(s), 0)
  const buckets = buildBuckets(range, start, end, sessions)

  // アプリを使っていない日まで数えると小さくなりすぎるので、作業した日だけで平均する
  const workedDays = new Set(sessions.map((s) => format(s.startedAt, "yyyy-MM-dd"))).size

  const shift = (dir: 1 | -1) =>
    setAnchor((d) =>
      range === "day" ? addDays(d, dir) : range === "week" ? addDays(d, 7 * dir) : addMonths(d, dir),
    )

  const title =
    range === "day"
      ? format(start, "yyyy年M月d日 (E)", { locale: ja })
      : range === "week"
        ? `${format(start, "yyyy年M月d日", { locale: ja })} – ${format(end, "M月d日", { locale: ja })}`
        : format(start, "yyyy年M月", { locale: ja })

  const thisPeriodLabel = range === "day" ? "今日" : range === "week" ? "今週" : "今月"
  const sortedByTime = [...sessions].sort((a, b) => a.startedAt - b.startedAt)

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto grid max-w-5xl gap-6 p-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>
            {thisPeriodLabel}
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => shift(-1)}>
            <ChevronLeftIcon />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => shift(1)}>
            <ChevronRightIcon />
          </Button>
          <h2 className="text-lg font-medium">{title}</h2>
          <Tabs value={range} onValueChange={(v) => setRange(v as Range)} className="ml-auto">
            <TabsList>
              <TabsTrigger value="day">日</TabsTrigger>
              <TabsTrigger value="week">週</TabsTrigger>
              <TabsTrigger value="month">月</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <StatTile label="ポモドーロ" value={`${sessions.length}`} unit="回" />
          <StatTile label="集中時間" value={totalMinutes ? formatDuration(totalMinutes) : "0m"} />
          {range === "day" ? (
            <StatTile
              label="作業していた時間帯"
              value={
                sortedByTime.length
                  ? `${format(sortedByTime[0].startedAt, "H:mm")} – ${format(sortedByTime[sortedByTime.length - 1].endedAt, "H:mm")}`
                  : "—"
              }
            />
          ) : (
            <StatTile
              label="作業した日の平均"
              value={workedDays ? formatDuration(Math.round(totalMinutes / workedDays)) : "0m"}
              unit={workedDays ? `（${workedDays}日）` : undefined}
            />
          )}
        </div>

        <section className="grid gap-3 rounded-xl border p-4">
          <h3 className="text-sm font-medium">
            {range === "day" ? "時間帯ごとの集中時間" : "日ごとの集中時間"}
          </h3>
          {sessions.length ? (
            <BarChart buckets={buckets} />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              この期間に完了したポモドーロはありません
            </p>
          )}
        </section>

        {sessions.length > 0 && (
          <Breakdown sessions={sessions} tasks={tasks} columns={columns} totalMinutes={totalMinutes} />
        )}

        {sessions.length > 0 && <SessionLog sessions={sessions} tasks={tasks} columns={columns} />}
      </div>
    </div>
  )
}

function StatTile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">
        {value}
        {unit && <span className="ml-0.5 text-sm font-normal text-muted-foreground">{unit}</span>}
      </div>
    </div>
  )
}

/** タスクが消えていても、記録した時点の名前で表示する */
function sessionTitle(s: PomodoroSession, tasks: Task[]) {
  const task = s.taskId ? tasks.find((t) => t.id === s.taskId) : undefined
  return task?.title || s.taskTitle || (s.taskId ? "（削除したタスク）" : "タスクなし")
}

function projectColumn(columns: Column[]) {
  return columns.find((c) => c.type === "select" && c.id !== STATUS_COLUMN_ID)
}

function Breakdown({
  sessions,
  tasks,
  columns,
  totalMinutes,
}: {
  sessions: PomodoroSession[]
  tasks: Task[]
  columns: Column[]
  totalMinutes: number
}) {
  const project = projectColumn(columns)
  const [by, setBy] = useState<"task" | "project">("task")

  const rows = useMemo(() => {
    const map = new Map<string, { key: string; name: string; minutes: number; count: number }>()
    for (const s of sessions) {
      let key: string
      let name: string
      if (by === "project" && project) {
        const task = tasks.find((t) => t.id === s.taskId)
        const option = task ? findOption(project, task.values[project.id]) : undefined
        key = option?.id ?? NO_TASK
        name = option?.label ?? `${project.name}なし`
      } else {
        key = s.taskId ?? NO_TASK
        name = sessionTitle(s, tasks)
      }
      const row = map.get(key) ?? { key, name, minutes: 0, count: 0 }
      row.minutes += sessionMinutes(s)
      row.count += 1
      map.set(key, row)
    }
    return [...map.values()].sort((a, b) => b.minutes - a.minutes)
  }, [sessions, tasks, by, project])
  const max = Math.max(...rows.map((r) => r.minutes))

  return (
    <section className="grid gap-3 rounded-xl border p-4">
      <div className="flex items-center">
        <h3 className="text-sm font-medium">何に時間を使ったか</h3>
        {project && (
          <Tabs value={by} onValueChange={(v) => setBy(v as "task" | "project")} className="ml-auto">
            <TabsList>
              <TabsTrigger value="task" className="text-xs">
                タスク別
              </TabsTrigger>
              <TabsTrigger value="project" className="text-xs">
                {project.name}別
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>
      <div className="grid gap-1.5">
        {rows.map((r) => {
          const option = by === "project" && project ? findOption(project, r.key) : undefined
          return (
            <div key={r.key} className="grid grid-cols-[minmax(0,14rem)_1fr_auto] items-center gap-3 text-sm">
              <span className="truncate">
                {option ? <OptionBadge option={option} /> : r.name}
              </span>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-red-500 dark:bg-red-400"
                  style={{ width: `${(r.minutes / max) * 100}%` }}
                />
              </div>
              <span className="w-36 text-right text-xs text-muted-foreground tabular-nums">
                {r.count} 🍅 ・ {formatDuration(r.minutes)} ・ {Math.round((r.minutes / totalMinutes) * 100)}%
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function SessionLog({
  sessions,
  tasks,
  columns,
}: {
  sessions: PomodoroSession[]
  tasks: Task[]
  columns: Column[]
}) {
  const project = projectColumn(columns)
  // 新しい日が上
  const days = useMemo(() => {
    const sorted = [...sessions].sort((a, b) => b.startedAt - a.startedAt)
    const groups: { day: Date; items: PomodoroSession[] }[] = []
    for (const s of sorted) {
      const last = groups[groups.length - 1]
      if (last && isSameDay(last.day, s.startedAt)) last.items.push(s)
      else groups.push({ day: new Date(s.startedAt), items: [s] })
    }
    return groups
  }, [sessions])

  return (
    <section className="grid gap-3 rounded-xl border p-4">
      <h3 className="text-sm font-medium">履歴</h3>
      {days.map(({ day, items }) => {
        const minutes = items.reduce((sum, s) => sum + sessionMinutes(s), 0)
        return (
          <div key={day.toISOString()} className="grid gap-1">
            <div className="flex items-baseline gap-2 border-b pb-1 text-xs">
              <span className="font-medium">{format(day, "M月d日 (E)", { locale: ja })}</span>
              <span className="text-muted-foreground tabular-nums">
                {items.length} 🍅 ・ {formatDuration(minutes)}
              </span>
            </div>
            {[...items].reverse().map((s) => {
              const task = tasks.find((t) => t.id === s.taskId)
              const option = project && task ? findOption(project, task.values[project.id]) : undefined
              return (
                <div key={s.id} className="group grid grid-cols-[6.5rem_1fr_auto_auto] items-center gap-3 text-sm">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {format(s.startedAt, "H:mm")} – {format(s.endedAt, "H:mm")}
                  </span>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate">{sessionTitle(s, tasks)}</span>
                    {option && <OptionBadge option={option} className="shrink-0" />}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {sessionMinutes(s)}分
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    title="この記録を削除"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={() => void deletePomodoro(s.id)}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              )
            })}
          </div>
        )
      })}
    </section>
  )
}
