import { format, parseISO } from "date-fns"
import { ja } from "date-fns/locale"
import { ClockIcon } from "lucide-react"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { OptionBadge } from "@/components/task-table/option-badge"
import { findOption, isTaskDone } from "@/hooks/use-data"
import { addTimeBlock, STATUS_COLUMN_ID, type Column, type Task, type TimeBlock } from "@/lib/db"
import { formatMinutes, PX_PER_MIN } from "./layout"

export type Draft = Omit<TimeBlock, "id" | "taskId">

/** 空き枠をクリック／ドラッグしたときに出る、作成済みのタスクを選んで予定にするポップオーバー */
export function CreateEventPopover({
  draft,
  tasks,
  columns,
  scheduledIds,
  onClose,
}: {
  draft: Draft
  tasks: Task[]
  columns: Column[]
  scheduledIds: Set<string>
  onClose: () => void
}) {
  const open = tasks.filter((t) => !isTaskDone(t, columns))
  const unscheduled = open.filter((t) => !scheduledIds.has(t.id))
  const scheduled = open.filter((t) => scheduledIds.has(t.id))
  const project = columns.find((c) => c.type === "select" && c.id !== STATUS_COLUMN_ID)

  // 保存を待たずに閉じて、すぐ次の枠をクリックできるようにする
  const schedule = (taskId: string) => {
    onClose()
    void addTimeBlock({ taskId, ...draft })
  }

  const item = (t: Task) => {
    const option = project && findOption(project, t.values[project.id])
    return (
      <CommandItem
        key={t.id}
        // 同じタイトルのタスクがあっても区別できるよう id も含める
        value={`${t.title} ${t.id}`}
        keywords={option ? [option.label] : undefined}
        onSelect={() => schedule(t.id)}
      >
        <span className="min-w-0 flex-1 truncate">{t.title || "無題"}</span>
        {option && <OptionBadge option={option} className="max-w-24 shrink-0" />}
      </CommandItem>
    )
  }

  return (
    <Popover open onOpenChange={(o) => !o && onClose()}>
      <PopoverAnchor
        className="pointer-events-none absolute inset-x-0"
        style={{ top: draft.start * PX_PER_MIN, height: draft.duration * PX_PER_MIN }}
      />
      <PopoverContent
        side="right"
        align="start"
        className="w-80 p-0"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b px-3 py-2 text-sm text-muted-foreground">
          <ClockIcon className="size-4" />
          {format(parseISO(draft.date), "M月d日 (E)", { locale: ja })}{" "}
          {formatMinutes(draft.start)} – {formatMinutes(draft.start + draft.duration)}
        </div>
        <Command>
          <CommandInput autoFocus placeholder="タスクを検索…" />
          <CommandList className="max-h-72">
            <CommandEmpty>
              {open.length === 0 ? "タスクがありません。先に一覧で作成してください" : "一致するタスクがありません"}
            </CommandEmpty>
            {unscheduled.length > 0 && (
              <CommandGroup heading="未割り当て">{unscheduled.map(item)}</CommandGroup>
            )}
            {scheduled.length > 0 && (
              <CommandGroup heading="予定済み">{scheduled.map(item)}</CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
