import { format } from "date-fns"
import { db, type Column, type DiaryEntry, type PomodoroSession, type Task, type TimeBlock } from "@/lib/db"
import { getPomodoroState, pomodoro, type PomodoroSettings } from "@/lib/pomodoro"

const TABLE_VIEW_KEY = "task-table-view"

export interface Backup {
  app: "task-management"
  version: 1
  exportedAt: string
  tasks: Task[]
  columns: Column[]
  timeBlocks: TimeBlock[]
  pomodoros: PomodoroSession[]
  /** 日記を足す前に書き出したファイルには無い */
  diaries?: DiaryEntry[]
  /** 一覧の並び替え・フィルタ・列幅など（localStorage の内容） */
  tableView: unknown
  pomodoroSettings: PomodoroSettings
}

export async function createBackup(): Promise<Backup> {
  let tableView: unknown = null
  try {
    tableView = JSON.parse(localStorage.getItem(TABLE_VIEW_KEY) ?? "null")
  } catch {
    // 一覧の表示設定は無くても復元できる
  }
  return {
    app: "task-management",
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks: await db.tasks.toArray(),
    columns: await db.columns.toArray(),
    timeBlocks: await db.timeBlocks.toArray(),
    pomodoros: await db.pomodoros.toArray(),
    diaries: await db.diaries.toArray(),
    tableView,
    pomodoroSettings: getPomodoroState().settings,
  }
}

export async function downloadBackup() {
  const backup = await createBackup()
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `task-management-${format(new Date(), "yyyyMMdd-HHmm")}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 書き出したファイルを読んで中身を確かめる。形式が違えばエラーを投げる */
export function parseBackup(text: string): Backup {
  const data = JSON.parse(text) as Partial<Backup>
  if (data.app !== "task-management" || data.version !== 1) {
    throw new Error("このアプリから書き出したファイルではありません")
  }
  for (const key of ["tasks", "columns", "timeBlocks", "pomodoros"] as const) {
    if (!Array.isArray(data[key])) throw new Error(`ファイルの「${key}」が壊れています`)
  }
  if (data.diaries !== undefined && !Array.isArray(data.diaries)) {
    throw new Error("ファイルの「diaries」が壊れています")
  }
  return data as Backup
}

/** 今のデータをすべて消して、バックアップの内容に置き換える */
export async function restoreBackup(backup: Backup) {
  const tables = [db.tasks, db.columns, db.timeBlocks, db.pomodoros, db.diaries]
  await db.transaction("rw", tables, async () => {
    await Promise.all(tables.map((t) => t.clear()))
    await db.tasks.bulkAdd(backup.tasks)
    await db.columns.bulkAdd(backup.columns)
    await db.timeBlocks.bulkAdd(backup.timeBlocks)
    await db.pomodoros.bulkAdd(backup.pomodoros)
    await db.diaries.bulkAdd(backup.diaries ?? [])
  })
  try {
    if (backup.tableView) localStorage.setItem(TABLE_VIEW_KEY, JSON.stringify(backup.tableView))
    else localStorage.removeItem(TABLE_VIEW_KEY)
  } catch {
    // 表示設定が保存できなくてもデータの復元はできている
  }
  if (backup.pomodoroSettings) pomodoro.updateSettings(backup.pomodoroSettings)
}
