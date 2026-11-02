import { useSyncExternalStore } from "react"
import { isTauri } from "@tauri-apps/api/core"
import { recordPomodoro } from "@/lib/db"

export type PomodoroMode = "work" | "short" | "long"

export interface PomodoroSettings {
  /** 分 */
  work: number
  short: number
  long: number
  /** 何回の作業ごとに長い休憩にするか */
  longEvery: number
  autoStartBreak: boolean
  autoStartWork: boolean
}

export interface PomodoroState {
  mode: PomodoroMode
  running: boolean
  /** running 中の終了予定時刻 */
  endsAt: number | null
  /** 停止中の残り時間 */
  remainingMs: number
  /** 現在の区間を最初に開始した時刻 */
  segmentStartedAt: number | null
  taskId: string | null
  completedWorks: number
  settings: PomodoroSettings
  now: number
}

export const MODE_LABEL: Record<PomodoroMode, string> = {
  work: "作業",
  short: "休憩",
  long: "長い休憩",
}

const STORAGE_KEY = "pomodoro"

const DEFAULT_SETTINGS: PomodoroSettings = {
  work: 25,
  short: 5,
  long: 15,
  longEvery: 4,
  autoStartBreak: true,
  autoStartWork: false,
}

const durationMs = (mode: PomodoroMode, s: PomodoroSettings) => s[mode] * 60_000

function load(): PomodoroState {
  const fallback: PomodoroState = {
    mode: "work",
    running: false,
    endsAt: null,
    remainingMs: durationMs("work", DEFAULT_SETTINGS),
    segmentStartedAt: null,
    taskId: null,
    completedWorks: 0,
    settings: DEFAULT_SETTINGS,
    now: Date.now(),
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const saved = JSON.parse(raw) as Partial<PomodoroState>
    return {
      ...fallback,
      ...saved,
      settings: { ...DEFAULT_SETTINGS, ...saved.settings },
      now: Date.now(),
    }
  } catch {
    return fallback
  }
}

let state = load()
const listeners = new Set<() => void>()

function set(patch: Partial<PomodoroState>, persist = true) {
  state = { ...state, ...patch }
  if (persist) {
    const { now: _now, ...rest } = state
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rest))
    } catch {
      // 保存できなくてもタイマー自体は動かす
    }
  }
  listeners.forEach((l) => l())
}

export function getPomodoroState() {
  return state
}

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function usePomodoro<T>(selector: (s: PomodoroState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state))
}

export function remainingMs(s: PomodoroState) {
  return s.running && s.endsAt ? Math.max(0, s.endsAt - s.now) : s.remainingMs
}

// ---- actions ----

export const pomodoro = {
  start(taskId?: string | null) {
    // デスクトップアプリではメニューバー側（Rust）が通知を出す
    if (!isTauri()) void Notification?.requestPermission?.()
    const now = Date.now()
    const changingTask = taskId !== undefined && taskId !== state.taskId
    // 別タスクで作業を始める場合は作業区間をやり直す
    if (changingTask && state.mode === "work") {
      set({
        taskId,
        running: true,
        endsAt: now + durationMs("work", state.settings),
        segmentStartedAt: now,
        now,
      })
      return
    }
    set({
      ...(taskId !== undefined ? { taskId } : {}),
      running: true,
      endsAt: now + state.remainingMs,
      segmentStartedAt: state.segmentStartedAt ?? now,
      now,
    })
  },
  pause() {
    if (!state.running) return
    set({ running: false, remainingMs: remainingMs(state), endsAt: null })
  },
  reset() {
    set({
      running: false,
      endsAt: null,
      segmentStartedAt: null,
      remainingMs: durationMs(state.mode, state.settings),
    })
  },
  skip() {
    goNext(false)
  },
  setMode(mode: PomodoroMode) {
    set({
      mode,
      running: false,
      endsAt: null,
      segmentStartedAt: null,
      remainingMs: durationMs(mode, state.settings),
    })
  },
  setTask(taskId: string | null) {
    set({ taskId })
  },
  updateSettings(settings: Partial<PomodoroSettings>) {
    const next = { ...state.settings, ...settings }
    set({
      settings: next,
      ...(state.running || state.segmentStartedAt
        ? {}
        : { remainingMs: durationMs(state.mode, next) }),
    })
  },
}

function goNext(completed: boolean) {
  const { mode, settings } = state
  let completedWorks = state.completedWorks
  let next: PomodoroMode
  if (mode === "work") {
    if (completed) completedWorks += 1
    next = completedWorks > 0 && completedWorks % settings.longEvery === 0 ? "long" : "short"
  } else {
    next = "work"
  }
  const autoStart = next === "work" ? settings.autoStartWork : settings.autoStartBreak
  const now = Date.now()
  set({
    mode: next,
    completedWorks,
    running: completed && autoStart,
    endsAt: completed && autoStart ? now + durationMs(next, settings) : null,
    remainingMs: durationMs(next, settings),
    segmentStartedAt: completed && autoStart ? now : null,
    now,
  })
}

function complete() {
  const finished = state.mode
  if (finished === "work") {
    void recordPomodoro({
      taskId: state.taskId,
      startedAt: state.segmentStartedAt ?? Date.now() - durationMs("work", state.settings),
      endedAt: Date.now(),
      minutes: state.settings.work,
    })
  }
  notify(finished)
  goNext(true)
}

function notify(finished: PomodoroMode) {
  beep()
  const body = finished === "work" ? "お疲れさまです。休憩しましょう。" : "休憩終了。次の作業を始めましょう。"
  if (isTauri()) return
  try {
    if (Notification.permission === "granted") {
      new Notification(`${MODE_LABEL[finished]}が終わりました`, { body })
    }
  } catch {
    // 通知が使えない環境では音だけ鳴らす
  }
}

function beep() {
  try {
    const ctx = new AudioContext()
    ;[0, 0.25, 0.5].forEach((t) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.2, ctx.currentTime + t)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2)
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + t)
      osc.stop(ctx.currentTime + t + 0.2)
    })
    setTimeout(() => ctx.close(), 1000)
  } catch {
    // 音が鳴らせなくても続行
  }
}

// 残り時間は終了予定時刻から計算するので、バックグラウンドで間引かれてもずれない
setInterval(() => {
  if (!state.running) return
  const now = Date.now()
  if (state.endsAt && now >= state.endsAt) {
    complete()
  } else {
    set({ now }, false)
  }
}, 250)

export function formatMs(ms: number) {
  const total = Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}
