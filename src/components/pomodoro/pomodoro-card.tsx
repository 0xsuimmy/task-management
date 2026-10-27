import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon, RotateCcwIcon, Settings2Icon, SkipForwardIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { isTaskDone, useColumns, useTasks } from "@/hooks/use-data"
import {
  formatMs,
  MODE_LABEL,
  pomodoro,
  remainingMs,
  usePomodoro,
  type PomodoroMode,
  type PomodoroSettings,
} from "@/lib/pomodoro"
import { cn } from "@/lib/utils"

const NO_TASK = "__none__"

export function PomodoroCard() {
  const mode = usePomodoro((s) => s.mode)
  const running = usePomodoro((s) => s.running)
  const remaining = usePomodoro(remainingMs)
  const total = usePomodoro((s) => s.settings[s.mode] * 60_000)
  const taskId = usePomodoro((s) => s.taskId)
  const completedWorks = usePomodoro((s) => s.completedWorks)
  const longEvery = usePomodoro((s) => s.settings.longEvery)
  const tasks = useTasks()
  const columns = useColumns()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const task = tasks.find((t) => t.id === taskId)
  const selectable = tasks.filter((t) => t.id === taskId || !isTaskDone(t, columns))
  const progress = 1 - remaining / total

  // タブのタイトルに残り時間を出して、別のアプリを見ていても分かるようにする
  useEffect(() => {
    document.title =
      running || remaining < total
        ? `${formatMs(remaining)} ${mode === "work" ? "🍅" : "☕"} ${task?.title ?? ""}`.trim()
        : "Task Management"
  }, [remaining, running, mode, task?.title, total])

  return (
    <div className="space-y-3 border-b p-4">
      <div className="flex items-center justify-between">
        <Tabs value={mode} onValueChange={(v) => pomodoro.setMode(v as PomodoroMode)}>
          <TabsList>
            {(Object.keys(MODE_LABEL) as PomodoroMode[]).map((m) => (
              <TabsTrigger key={m} value={m} className="text-xs">
                {MODE_LABEL[m]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button variant="ghost" size="icon-sm" title="設定" onClick={() => setSettingsOpen(true)}>
          <Settings2Icon />
        </Button>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div
          className={cn(
            "font-mono text-5xl font-semibold tracking-tight tabular-nums",
            mode !== "work" && "text-green-600 dark:text-green-400",
          )}
        >
          {formatMs(remaining)}
        </div>
        <div className="flex gap-1 pb-1">
          {running ? (
            <Button size="icon" onClick={() => pomodoro.pause()} title="一時停止">
              <PauseIcon />
            </Button>
          ) : (
            <Button size="icon" onClick={() => pomodoro.start()} title="開始">
              <PlayIcon />
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={() => pomodoro.reset()} title="リセット">
            <RotateCcwIcon />
          </Button>
          <Button variant="outline" size="icon" onClick={() => pomodoro.skip()} title="スキップ">
            <SkipForwardIcon />
          </Button>
        </div>
      </div>

      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full transition-[width] duration-300",
            mode === "work" ? "bg-primary" : "bg-green-500",
          )}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={taskId ?? NO_TASK}
          onValueChange={(v) => pomodoro.setTask(v === NO_TASK ? null : v)}
        >
          <SelectTrigger size="sm" className="min-w-0 flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_TASK}>タスクを選択しない</SelectItem>
            {selectable.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.title || "無題"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="shrink-0 text-xs text-muted-foreground" title="長い休憩までのサイクル">
          {"🍅".repeat(completedWorks % longEvery)}
          {"・".repeat(longEvery - (completedWorks % longEvery))}
        </span>
      </div>

      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}

function SettingsDialog({ onClose }: { onClose: () => void }) {
  const current = usePomodoro((s) => s.settings)
  const [draft, setDraft] = useState<PomodoroSettings>(current)

  const numberField = (key: "work" | "short" | "long" | "longEvery", label: string) => (
    <div className="grid gap-1.5">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type="number"
        min={1}
        value={draft[key]}
        onChange={(e) => setDraft({ ...draft, [key]: Math.max(1, Number(e.target.value) || 1) })}
      />
    </div>
  )

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>ポモドーロ設定</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {numberField("work", "作業（分）")}
          {numberField("short", "休憩（分）")}
          {numberField("long", "長い休憩（分）")}
          {numberField("longEvery", "長い休憩の間隔（回）")}
        </div>
        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-break">作業終了後に休憩を自動で開始</Label>
            <Switch
              id="auto-break"
              checked={draft.autoStartBreak}
              onCheckedChange={(v) => setDraft({ ...draft, autoStartBreak: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-work">休憩終了後に作業を自動で開始</Label>
            <Switch
              id="auto-work"
              checked={draft.autoStartWork}
              onCheckedChange={(v) => setDraft({ ...draft, autoStartWork: v })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              pomodoro.updateSettings(draft)
              onClose()
            }}
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
