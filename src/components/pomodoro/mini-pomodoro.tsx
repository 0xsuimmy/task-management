import { PauseIcon, PlayIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTasks } from "@/hooks/use-data"
import { formatMs, pomodoro, remainingMs, usePomodoro } from "@/lib/pomodoro"
import { cn } from "@/lib/utils"

/** ヘッダーに置く小さなタイマー（一覧画面用） */
export function MiniPomodoro() {
  const mode = usePomodoro((s) => s.mode)
  const running = usePomodoro((s) => s.running)
  const remaining = usePomodoro(remainingMs)
  const taskId = usePomodoro((s) => s.taskId)
  const task = useTasks().find((t) => t.id === taskId)

  return (
    <div className="flex items-center gap-2">
      {task && <span className="max-w-48 truncate text-xs text-muted-foreground">{task.title}</span>}
      <span
        className={cn(
          "font-mono text-sm font-semibold tabular-nums",
          mode !== "work" && "text-green-600 dark:text-green-400",
        )}
      >
        {mode === "work" ? "🍅" : "☕"} {formatMs(remaining)}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        title={running ? "一時停止" : "開始"}
        onClick={() => (running ? pomodoro.pause() : pomodoro.start())}
      >
        {running ? <PauseIcon /> : <PlayIcon />}
      </Button>
    </div>
  )
}
