import { invoke, isTauri } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { liveQuery } from "dexie"
import { db } from "@/lib/db"
import { getPomodoroState, pomodoro, subscribe } from "@/lib/pomodoro"

/**
 * デスクトップアプリ（Tauri）のときだけ、メニューバーとポモドーロをつなぐ。
 * 状態は画面側が持ち、変わったときに Rust 側へ送る。残り時間の表示は Rust 側が1秒ごとに更新する。
 */
export function connectMenuBar() {
  if (!isTauri()) return

  let taskTitle: string | null = null
  let lastSent = ""

  const sync = () => {
    const s = getPomodoroState()
    const status = {
      mode: s.mode,
      running: s.running,
      idle: !s.running && s.segmentStartedAt == null,
      endsAt: s.running ? s.endsAt : null,
      remainingMs: s.remainingMs,
      taskTitle,
    }
    // 毎ティックの更新（now だけが変わる）では送らない
    const key = JSON.stringify(status)
    if (key === lastSent) return
    lastSent = key
    void invoke("pomodoro_sync", { status })
  }

  // 選んでいるタスクの名前が変わったらメニューにも反映する
  let unwatchTask: (() => void) | null = null
  let watchedId: string | null | undefined
  const watchTask = () => {
    const id = getPomodoroState().taskId
    if (id === watchedId) return
    watchedId = id
    unwatchTask?.()
    taskTitle = null
    if (!id) return
    const sub = liveQuery(() => db.tasks.get(id)).subscribe((task) => {
      taskTitle = task ? task.title || "無題" : null
      sync()
    })
    unwatchTask = () => sub.unsubscribe()
  }

  subscribe(() => {
    watchTask()
    sync()
  })
  watchTask()
  sync()

  void listen<string>("tray-action", ({ payload }) => {
    const s = getPomodoroState()
    if (payload === "toggle") {
      if (s.running) pomodoro.pause()
      else pomodoro.start()
    } else if (payload === "skip") pomodoro.skip()
    else if (payload === "reset") pomodoro.reset()
  })
}
