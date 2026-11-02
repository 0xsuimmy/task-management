import { useMemo, useState } from "react"
import { useDraggable } from "@dnd-kit/core"
import { format, parseISO } from "date-fns"
import { CircleIcon, GripVerticalIcon } from "lucide-react"
import { OptionBadge } from "@/components/task-table/option-badge"
import { findOption, isTaskDone, useAllBlocks, useColumns, useTasks } from "@/hooks/use-data"
import { addTask, setTaskDone, STATUS_COLUMN_ID, type Column, type Task, type TimeBlock } from "@/lib/db"
import { isImeKey } from "@/lib/ime"
import { formatMinutes } from "./layout"

/** カレンダー横のタスク一覧。ここからカレンダーへドラッグして予定にする */
export function TaskTray() {
  const tasks = useTasks()
  const columns = useColumns()
  const blocks = useAllBlocks()
  const [title, setTitle] = useState("")

  // タスクごとの一番早い予定
  const firstBlock = useMemo(() => {
    const map = new Map<string, TimeBlock>()
    for (const b of blocks) {
      const cur = map.get(b.taskId)
      if (!cur || b.date < cur.date || (b.date === cur.date && b.start < cur.start)) {
        map.set(b.taskId, b)
      }
    }
    return map
  }, [blocks])

  const open = tasks.filter((t) => !isTaskDone(t, columns))
  const unscheduled = open.filter((t) => !firstBlock.has(t.id))
  const scheduled = open.filter((t) => firstBlock.has(t.id))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <form
        className="border-b p-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!title.trim()) return
          void addTask({ title: title.trim() })
          setTitle("")
        }}
      >
        <input
          className="h-8 w-full rounded-md border bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
          placeholder="＋ タスクを追加"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && isImeKey(e)) e.preventDefault()
          }}
        />
      </form>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <Section title="未割り当て" count={unscheduled.length}>
          {unscheduled.map((t) => (
            <TrayItem key={t.id} task={t} columns={columns} />
          ))}
          {unscheduled.length === 0 && (
            <p className="px-2 py-1 text-xs text-muted-foreground">すべて予定に入っています</p>
          )}
        </Section>
        <Section title="予定済み" count={scheduled.length}>
          {scheduled.map((t) => (
            <TrayItem key={t.id} task={t} columns={columns} block={firstBlock.get(t.id)} />
          ))}
        </Section>
      </div>
    </div>
  )
}

function Section({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: React.ReactNode
}) {
  return (
    <div className="mb-3">
      <div className="px-2 pb-1 text-xs font-medium text-muted-foreground">
        {title} <span className="tabular-nums">{count}</span>
      </div>
      <div className="grid gap-0.5">{children}</div>
    </div>
  )
}

function TrayItem({ task, columns, block }: { task: Task; columns: Column[]; block?: TimeBlock }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `task:${task.id}`,
    data: { type: "task", taskId: task.id },
  })
  const project = columns.find((c) => c.type === "select" && c.id !== STATUS_COLUMN_ID)
  const option = project && findOption(project, task.values[project.id])

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`group flex cursor-grab items-center gap-1.5 rounded-md px-1.5 py-1 text-sm hover:bg-muted active:cursor-grabbing ${isDragging ? "opacity-40" : ""}`}
    >
      <button
        title="完了にする"
        className="shrink-0 text-muted-foreground hover:text-primary"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => void setTaskDone(task.id, true)}
      >
        <CircleIcon className="size-4" />
      </button>
      <span className="min-w-0 flex-1 truncate">{task.title || "無題"}</span>
      {block && (
        <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
          {format(parseISO(block.date), "M/d")} {formatMinutes(block.start)}
        </span>
      )}
      {option && <OptionBadge option={option} className="max-w-20 shrink-0" />}
      <GripVerticalIcon className="size-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
    </div>
  )
}
