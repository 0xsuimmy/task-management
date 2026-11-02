import { useState } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragStartEvent,
} from "@dnd-kit/core"
import { CalendarDaysIcon, ChartColumnIcon, GripVerticalIcon, TableIcon } from "lucide-react"
import { CalendarView } from "@/components/calendar/calendar-view"
import { TaskTray } from "@/components/calendar/task-tray"
import { DataMenu } from "@/components/data-menu"
import { MiniPomodoro } from "@/components/pomodoro/mini-pomodoro"
import { PomodoroCard } from "@/components/pomodoro/pomodoro-card"
import { StatsView } from "@/components/stats/stats-view"
import { TaskTable } from "@/components/task-table/task-table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTasks } from "@/hooks/use-data"

type Screen = "calendar" | "list" | "stats"

const SCREEN_KEY = "screen"

function loadScreen(): Screen {
  try {
    const saved = localStorage.getItem(SCREEN_KEY)
    return saved === "list" || saved === "stats" ? saved : "calendar"
  } catch {
    return "calendar"
  }
}

export default function App() {
  const tasks = useTasks()
  const [screen, setScreen] = useState<Screen>(loadScreen)
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)
  // 少し動かしてからドラッグ開始にして、予定のクリックを邪魔しない
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const changeScreen = (next: Screen) => {
    setScreen(next)
    try {
      localStorage.setItem(SCREEN_KEY, next)
    } catch {
      // 保存できなくても切り替えはできる
    }
  }

  const onDragStart = ({ active }: DragStartEvent) => {
    const data = active.data.current as { type: string; taskId?: string }
    if (data.type === "task") setDraggingTaskId(data.taskId ?? null)
  }
  const draggingTask = tasks.find((t) => t.id === draggingTaskId)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      // 横方向には自動スクロールさせない（サイドバーからカレンダーへ横に運ぶため）
      autoScroll={{ threshold: { x: 0, y: 0.2 } }}
      onDragStart={onDragStart}
      onDragEnd={() => setDraggingTaskId(null)}
      onDragCancel={() => setDraggingTaskId(null)}
    >
      <div className="flex h-screen flex-col bg-background text-foreground">
        <header className="flex h-12 shrink-0 items-center gap-4 border-b px-4">
          <h1 className="text-sm font-semibold">Task Management</h1>
          <Tabs value={screen} onValueChange={(v) => changeScreen(v as Screen)}>
            <TabsList>
              <TabsTrigger value="calendar">
                <CalendarDaysIcon />
                カレンダー
              </TabsTrigger>
              <TabsTrigger value="list">
                <TableIcon />
                一覧
              </TabsTrigger>
              <TabsTrigger value="stats">
                <ChartColumnIcon />
                記録
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="ml-auto flex items-center gap-2">
            {screen !== "calendar" && <MiniPomodoro />}
            <DataMenu />
          </div>
        </header>
        <main className="flex min-h-0 flex-1">
          {screen === "calendar" ? (
            <>
              <aside className="flex w-80 shrink-0 flex-col border-r">
                <PomodoroCard />
                <TaskTray />
              </aside>
              <section className="min-w-0 flex-1">
                <CalendarView />
              </section>
            </>
          ) : (
            <section className="min-w-0 flex-1">
              {screen === "list" ? <TaskTable /> : <StatsView />}
            </section>
          )}
        </main>
      </div>
      <DragOverlay dropAnimation={null}>
        {draggingTask && (
          <div className="flex w-56 cursor-grabbing items-center gap-1 rounded-md border bg-background px-2 py-1.5 text-sm shadow-lg">
            <GripVerticalIcon className="size-4 text-muted-foreground" />
            <span className="truncate">{draggingTask.title || "無題"}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
