import { useState } from "react"
import { useDraggable } from "@dnd-kit/core"
import { format, parseISO } from "date-fns"
import { ja } from "date-fns/locale"
import { ClockIcon, PlayIcon, Trash2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { OptionBadge } from "@/components/task-table/option-badge"
import { findOption, isTaskDone, taskColor } from "@/hooks/use-data"
import { blockColorClass } from "@/lib/colors"
import {
  deleteTimeBlock,
  setTaskDone,
  STATUS_COLUMN_ID,
  updateTaskTitle,
  updateTimeBlock,
  type Column,
  type Task,
  type TimeBlock,
} from "@/lib/db"
import { isImeKey } from "@/lib/ime"
import { pomodoro, usePomodoro } from "@/lib/pomodoro"
import { cn } from "@/lib/utils"
import { clamp, DAY_MIN, formatMinutes, PX_PER_MIN, snap, SNAP } from "./layout"

export function CalendarEvent({
  block,
  task,
  columns,
  lane,
  lanes,
  selected,
  onSelect,
}: {
  block: TimeBlock
  task: Task
  columns: Column[]
  lane: number
  lanes: number
  selected: boolean
  onSelect: (open: boolean) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `block:${block.id}`,
    data: { type: "block", block },
  })
  const [resizeDuration, setResizeDuration] = useState<number | null>(null)
  const isCurrent = usePomodoro((s) => s.taskId === task.id)
  const isRunning = usePomodoro((s) => s.running && s.mode === "work" && s.taskId === task.id)

  const duration = resizeDuration ?? block.duration
  // ドラッグ中も15分単位で吸着して見せる
  const dy = transform ? snap(transform.y / PX_PER_MIN) * PX_PER_MIN : 0
  const start = clamp(block.start + dy / PX_PER_MIN, 0, DAY_MIN - duration)
  const done = isTaskDone(task, columns)
  const compact = duration <= 30

  const onResizeStart = (e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const startY = e.clientY
    let next = block.duration
    const onMove = (ev: PointerEvent) => {
      next = clamp(
        snap(block.duration + (ev.clientY - startY) / PX_PER_MIN),
        SNAP,
        DAY_MIN - block.start,
      )
      setResizeDuration(next)
    }
    const onUp = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      void updateTimeBlock(block.id, { duration: next }).then(() => setResizeDuration(null))
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-event
      onClick={() => onSelect(true)}
      className={cn(
        "absolute z-10 cursor-pointer overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 text-xs leading-tight shadow-xs select-none",
        blockColorClass[taskColor(task, columns)],
        isDragging && "z-30 cursor-grabbing opacity-80 shadow-lg",
        (isCurrent || selected) && "ring-2 ring-primary",
        done && "opacity-50",
      )}
      style={{
        top: start * PX_PER_MIN + 1,
        height: Math.max(duration * PX_PER_MIN - 2, 14),
        left: `calc(${(lane / lanes) * 100}% + 1px)`,
        width: `calc(${100 / lanes}% - 3px)`,
        transform: transform ? `translateX(${transform.x}px)` : undefined,
      }}
    >
      <div className={cn("flex gap-1", compact ? "items-baseline" : "flex-col")}>
        <span className={cn("truncate font-medium", done && "line-through")}>
          {isRunning && "🍅 "}
          {task.title || "無題"}
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
          {formatMinutes(start)}
          {!compact && `–${formatMinutes(start + duration)}`}
        </span>
      </div>
      <div
        className="absolute right-0 bottom-0 left-0 h-1.5 cursor-ns-resize"
        onPointerDown={onResizeStart}
        onClick={(e) => e.stopPropagation()}
      />
      <Popover open={selected && !isDragging} onOpenChange={onSelect}>
        <PopoverAnchor className="pointer-events-none absolute inset-0" />
        <PopoverContent
          side="right"
          align="start"
          className="w-72"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <EventDetail block={block} task={task} columns={columns} onClose={() => onSelect(false)} />
        </PopoverContent>
      </Popover>
    </div>
  )
}

function EventDetail({
  block,
  task,
  columns,
  onClose,
}: {
  block: TimeBlock
  task: Task
  columns: Column[]
  onClose: () => void
}) {
  const [title, setTitle] = useState(task.title)
  const status = columns.find((c) => c.id === STATUS_COLUMN_ID)
  const canMarkDone = !!status?.options?.some((o) => o.done)
  const badges = columns
    .filter((c) => c.type === "select")
    .map((c) => findOption(c, task.values[c.id]))
    .filter((o) => o != null)

  const saveTitle = () => {
    if (title !== task.title) void updateTaskTitle(task.id, title)
  }

  return (
    <div className="grid gap-3">
      <input
        className="w-full rounded-md bg-transparent text-base font-medium outline-none placeholder:text-muted-foreground focus:bg-muted/50"
        value={title}
        placeholder="無題"
        onChange={(e) => setTitle(e.target.value)}
        onBlur={saveTitle}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !isImeKey(e)) {
            saveTitle()
            onClose()
          }
        }}
      />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ClockIcon className="size-4" />
        {format(parseISO(block.date), "M月d日 (E)", { locale: ja })}{" "}
        {formatMinutes(block.start)} – {formatMinutes(block.start + block.duration)}
      </div>
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {badges.map((o) => (
            <OptionBadge key={o.id} option={o} />
          ))}
        </div>
      )}
      {canMarkDone && (
        <div className="flex items-center gap-2">
          <Checkbox
            id={`done-${block.id}`}
            checked={isTaskDone(task, columns)}
            onCheckedChange={(checked) => void setTaskDone(task.id, checked === true)}
          />
          <Label htmlFor={`done-${block.id}`} className="font-normal">
            完了にする
          </Label>
        </div>
      )}
      <div className="flex justify-between gap-2">
        <Button
          size="sm"
          onClick={() => {
            pomodoro.start(task.id)
            onClose()
          }}
        >
          <PlayIcon />
          ポモドーロ開始
        </Button>
        <Button
          variant="ghost"
          size="sm"
          title="カレンダーから外す（タスクは一覧に残ります）"
          onClick={() => void deleteTimeBlock(block.id)}
        >
          <Trash2Icon />
          予定を削除
        </Button>
      </div>
    </div>
  )
}
