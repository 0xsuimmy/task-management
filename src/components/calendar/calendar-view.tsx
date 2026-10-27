import { useEffect, useMemo, useRef, useState } from "react"
import { useDndMonitor, useDroppable } from "@dnd-kit/core"
import {
  addDays,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfWeek,
} from "date-fns"
import { ja } from "date-fns/locale"
import { useLiveQuery } from "dexie-react-hooks"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAllBlocks, useColumns, useTasks } from "@/hooks/use-data"
import {
  addTimeBlock,
  db,
  ESTIMATE_COLUMN_ID,
  updateTimeBlock,
  type Column,
  type Task,
  type TimeBlock,
} from "@/lib/db"
import { cn } from "@/lib/utils"
import { CalendarEvent } from "./calendar-event"
import { CreateEventPopover, type Draft } from "./create-event-popover"
import {
  clamp,
  DAY_MIN,
  DEFAULT_DURATION,
  HOUR_PX,
  layoutLanes,
  minuteAt,
  PX_PER_MIN,
  snap,
  SNAP,
} from "./layout"

type View = "week" | "day"

const dateKey = (d: Date) => format(d, "yyyy-MM-dd")

export function CalendarView() {
  const [anchor, setAnchor] = useState(() => new Date())
  const [view, setView] = useState<View>("week")
  const [draft, setDraft] = useState<Draft | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const columns = useColumns()
  const tasks = useTasks()
  const allBlocks = useAllBlocks()
  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  const scheduledIds = useMemo(() => new Set(allBlocks.map((b) => b.taskId)), [allBlocks])

  const days =
    view === "week"
      ? eachDayOfInterval({
          start: startOfWeek(anchor, { weekStartsOn: 1 }),
          end: endOfWeek(anchor, { weekStartsOn: 1 }),
        })
      : [anchor]
  const first = dateKey(days[0])
  const last = dateKey(days[days.length - 1])
  const blocks = useLiveQuery(
    () => db.timeBlocks.where("date").between(first, last, true, true).toArray(),
    [first, last],
    [] as TimeBlock[],
  )

  const scrollRef = useRef<HTMLDivElement>(null)
  const columnRefs = useRef(new Map<string, HTMLDivElement>())

  // 表示を切り替えたら現在時刻の少し前（8時より前なら8時）までスクロール
  useEffect(() => {
    const now = new Date()
    const min = Math.max(8 * 60, now.getHours() * 60 + now.getMinutes() - 90)
    scrollRef.current?.scrollTo({ top: min * PX_PER_MIN })
  }, [view])

  useDndMonitor({
    onDragStart() {
      setSelected(null)
      setDraft(null)
    },
    onDragEnd({ active, over, delta, activatorEvent }) {
      const overId = String(over?.id ?? "")
      if (!overId.startsWith("day:")) return
      const date = overId.slice(4)
      const data = active.data.current as { type: string; taskId?: string; block?: TimeBlock }
      if (data.type === "block" && data.block) {
        const start = clamp(
          snap(data.block.start + delta.y / PX_PER_MIN),
          0,
          DAY_MIN - data.block.duration,
        )
        void updateTimeBlock(data.block.id, { date, start })
      } else if (data.type === "task" && data.taskId) {
        const column = columnRefs.current.get(date)
        if (!column) return
        // 見積時間の列があればその長さ、無ければ1時間
        const estimate = Number(taskMap.get(data.taskId)?.values[ESTIMATE_COLUMN_ID])
        const duration =
          estimate > 0 ? Math.min(Math.ceil(estimate / SNAP) * SNAP, DAY_MIN) : DEFAULT_DURATION
        const pointerY = (activatorEvent as PointerEvent).clientY + delta.y
        const start = Math.min(
          minuteAt(pointerY, column.getBoundingClientRect().top),
          DAY_MIN - duration,
        )
        void addTimeBlock({ taskId: data.taskId, date, start, duration })
      }
    },
  })

  const step = view === "week" ? 7 : 1
  const title =
    view === "day" || isSameMonth(days[0], days[days.length - 1])
      ? format(days[0], "yyyy年M月", { locale: ja })
      : `${format(days[0], "yyyy年M月")} – ${format(days[days.length - 1], "M月")}`

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>
          今日
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => setAnchor((d) => addDays(d, -step))}>
          <ChevronLeftIcon />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => setAnchor((d) => addDays(d, step))}>
          <ChevronRightIcon />
        </Button>
        <h2 className="text-lg font-medium">{title}</h2>
        <Tabs value={view} onValueChange={(v) => setView(v as View)} className="ml-auto">
          <TabsList>
            <TabsTrigger value="day">日</TabsTrigger>
            <TabsTrigger value="week">週</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* 曜日の見出し */}
      <div className="flex border-b">
        <div className="w-14 shrink-0" />
        {days.map((d) => (
          <div key={dateKey(d)} className="flex-1 border-l py-1.5 text-center">
            <div
              className={cn(
                "text-xs",
                isToday(d) ? "font-medium text-primary" : "text-muted-foreground",
              )}
            >
              {format(d, "E", { locale: ja })}
            </div>
            <div
              className={cn(
                "mx-auto mt-0.5 flex size-8 items-center justify-center rounded-full text-lg",
                isToday(d) && "bg-primary text-primary-foreground",
              )}
            >
              {format(d, "d")}
            </div>
          </div>
        ))}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-scroll">
        <div className="relative flex" style={{ height: DAY_MIN * PX_PER_MIN }}>
          <div className="w-14 shrink-0">
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="relative" style={{ height: HOUR_PX }}>
                {h > 0 && (
                  <span className="absolute -top-2 right-2 text-[10px] text-muted-foreground">
                    {h}:00
                  </span>
                )}
              </div>
            ))}
          </div>
          {days.map((d) => {
            const key = dateKey(d)
            return (
              <DayColumn
                key={key}
                date={key}
                today={isToday(d)}
                blocks={blocks.filter((b) => b.date === key)}
                taskMap={taskMap}
                columns={columns}
                draft={draft?.date === key ? draft : null}
                selected={selected}
                onSelect={setSelected}
                onDraft={setDraft}
                registerRef={(el) => {
                  if (el) columnRefs.current.set(key, el)
                  else columnRefs.current.delete(key)
                }}
                renderDraft={(dr) => (
                  <CreateEventPopover
                    draft={dr}
                    tasks={tasks}
                    columns={columns}
                    scheduledIds={scheduledIds}
                    // 別の枠で作り直したあとに古いポップオーバーが閉じても消さない
                    onClose={() => setDraft((cur) => (cur === dr ? null : cur))}
                  />
                )}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

function DayColumn({
  date,
  today,
  blocks,
  taskMap,
  columns,
  draft,
  selected,
  onSelect,
  onDraft,
  registerRef,
  renderDraft,
}: {
  date: string
  today: boolean
  blocks: TimeBlock[]
  taskMap: Map<string, Task>
  columns: Column[]
  draft: Draft | null
  selected: string | null
  onSelect: (id: string | null) => void
  onDraft: (draft: Draft | null) => void
  registerRef: (el: HTMLDivElement | null) => void
  renderDraft: (draft: Draft) => React.ReactNode
}) {
  const { setNodeRef } = useDroppable({ id: `day:${date}` })
  // 空き枠をドラッグして範囲を選んでいる途中
  const [range, setRange] = useState<{ from: number; to: number } | null>(null)
  const laid = useMemo(() => layoutLanes(blocks), [blocks])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("[data-event]")) return
    const el = e.currentTarget
    const top = el.getBoundingClientRect().top
    const from = minuteAt(e.clientY, top)
    el.setPointerCapture(e.pointerId)
    setRange({ from, to: from })
    onSelect(null)

    const onMove = (ev: PointerEvent) => setRange({ from, to: minuteAt(ev.clientY, top) })
    const onUp = (ev: PointerEvent) => {
      el.removeEventListener("pointermove", onMove)
      el.removeEventListener("pointerup", onUp)
      const to = minuteAt(ev.clientY, top)
      const start = Math.min(from, to)
      // ただのクリックなら1時間、ドラッグなら選んだ範囲
      const duration =
        from === to ? Math.min(DEFAULT_DURATION, DAY_MIN - start) : Math.abs(to - from) + SNAP
      setRange(null)
      onDraft({ date, start, duration })
    }
    el.addEventListener("pointermove", onMove)
    el.addEventListener("pointerup", onUp)
  }

  const ghost = range
    ? { start: Math.min(range.from, range.to), duration: Math.abs(range.to - range.from) + SNAP }
    : draft

  return (
    <div
      ref={(el) => {
        setNodeRef(el)
        registerRef(el)
      }}
      className={cn("relative flex-1 border-l", today && "bg-primary/[0.02]")}
      onPointerDown={onPointerDown}
    >
      {Array.from({ length: 24 }, (_, h) => (
        <div key={h} className="border-b border-border/70" style={{ height: HOUR_PX }}>
          <div className="border-b border-dashed border-border/30" style={{ height: HOUR_PX / 2 }} />
        </div>
      ))}
      {today && <NowLine />}
      {ghost && (
        <div
          className="pointer-events-none absolute inset-x-0.5 z-20 rounded-md bg-primary/80 px-1.5 py-0.5 text-xs text-primary-foreground shadow-md"
          style={{ top: ghost.start * PX_PER_MIN, height: ghost.duration * PX_PER_MIN }}
        >
          (タスクを選択)
        </div>
      )}
      {laid.map(({ block, lane, lanes }) => {
        const task = taskMap.get(block.taskId)
        if (!task) return null
        return (
          <CalendarEvent
            key={block.id}
            block={block}
            task={task}
            columns={columns}
            lane={lane}
            lanes={lanes}
            selected={selected === block.id}
            onSelect={(open) => onSelect(open ? block.id : null)}
          />
        )
      })}
      {draft && renderDraft(draft)}
    </div>
  )
}

function NowLine() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  const min = now.getHours() * 60 + now.getMinutes()
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-red-500"
      style={{ top: min * PX_PER_MIN }}
    >
      <span className="absolute -top-[5px] -left-1.5 size-3 rounded-full bg-red-500" />
    </div>
  )
}
