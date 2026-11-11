import Dexie, { type EntityTable } from "dexie"

/** duration は分を数値で持つ */
export type ColumnType = "text" | "select" | "number" | "duration"

export interface SelectOption {
  id: string
  label: string
  color: OptionColor
  /** この選択肢のタスクを「完了」として扱う */
  done?: boolean
}

export interface Column {
  id: string
  name: string
  type: ColumnType
  options?: SelectOption[]
  order: number
  width: number
  /** 削除できない列 */
  system?: boolean
}

export type CellValue = string | number | null

export interface Task {
  id: string
  title: string
  values: Record<string, CellValue>
  order: number
  createdAt: number
}

export interface TimeBlock {
  id: string
  taskId: string
  /** yyyy-MM-dd */
  date: string
  /** 0:00 からの分 */
  start: number
  /** 分 */
  duration: number
}

export interface PomodoroSession {
  id: string
  taskId: string | null
  /** 記録した時点のタスク名。タスクを消しても履歴に名前を残す */
  taskTitle?: string
  startedAt: number
  endedAt: number
  /** 作業時間（分）。一時停止していた時間は含まない */
  minutes?: number
}

export interface DiaryEntry {
  /** yyyy-MM-dd。1日1件 */
  date: string
  body: string
  updatedAt: number
}

/** 作業時間（分）。minutes が無い古い記録は開始〜終了から求める */
export const sessionMinutes = (p: PomodoroSession) =>
  p.minutes ?? Math.max(1, Math.round((p.endedAt - p.startedAt) / 60_000))

export const OPTION_COLORS = [
  "gray",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
] as const
export type OptionColor = (typeof OPTION_COLORS)[number]

/** 新しい選択肢の色。グレーは「未設定」っぽく見えるので避ける */
export const nextOptionColor = (count: number): OptionColor =>
  OPTION_COLORS[1 + (count % (OPTION_COLORS.length - 1))]

export const STATUS_COLUMN_ID = "status"
export const ESTIMATE_COLUMN_ID = "estimate"

class TaskDB extends Dexie {
  tasks!: EntityTable<Task, "id">
  columns!: EntityTable<Column, "id">
  timeBlocks!: EntityTable<TimeBlock, "id">
  pomodoros!: EntityTable<PomodoroSession, "id">
  diaries!: EntityTable<DiaryEntry, "date">

  constructor() {
    super("task-management")
    this.version(1).stores({
      tasks: "id, order",
      columns: "id, order",
      timeBlocks: "id, taskId, date",
      pomodoros: "id, taskId, startedAt",
    })
    // 見積をポモドーロ数から時間（分）に変更。1ポモドーロ＝30分として換算する
    this.version(2).stores({}).upgrade(async (tx) => {
      const estimate = await tx.table<Column>("columns").get(ESTIMATE_COLUMN_ID)
      if (estimate?.type !== "number") return
      await tx.table("columns").update(ESTIMATE_COLUMN_ID, {
        type: "duration",
        name: estimate.name === "見積🍅" ? "見積時間" : estimate.name,
        width: 90,
      })
      await tx
        .table<Task>("tasks")
        .toCollection()
        .modify((t) => {
          const v = t.values[ESTIMATE_COLUMN_ID]
          if (typeof v === "number") t.values[ESTIMATE_COLUMN_ID] = v * 30
        })
    })
    this.version(3).stores({ diaries: "date" })
    this.on("populate", (tx) => {
      tx.table("columns").bulkAdd(defaultColumns())
    })
  }
}

export const db = new TaskDB()

export const newId = () => crypto.randomUUID()

function defaultColumns(): Column[] {
  return [
    { id: "project", name: "Project", type: "select", options: [], order: 0, width: 160 },
    {
      id: STATUS_COLUMN_ID,
      name: "Status",
      type: "select",
      order: 1,
      width: 120,
      system: true,
      options: [
        { id: newId(), label: "未着手", color: "gray" },
        { id: newId(), label: "進行中", color: "blue" },
        { id: newId(), label: "完了", color: "green", done: true },
      ],
    },
    { id: ESTIMATE_COLUMN_ID, name: "見積時間", type: "duration", order: 2, width: 90 },
  ]
}

// ---- tasks ----

export async function addTask(partial: Partial<Task> = {}) {
  // order が渡されたときは await せずに add し、直後の update より先に書き込まれるようにする
  const order = partial.order ?? ((await db.tasks.orderBy("order").last())?.order ?? 0) + 1
  const task: Task = {
    id: newId(),
    title: "",
    values: {},
    createdAt: Date.now(),
    ...partial,
    order,
  }
  await db.tasks.add(task)
  return task
}

export async function updateTaskTitle(id: string, title: string) {
  await db.tasks.update(id, { title })
}

export async function updateTaskValue(id: string, columnId: string, value: CellValue) {
  await db.tasks.update(id, { [`values.${columnId}`]: value })
}

/** Status 列の「完了扱い」の選択肢を付けたり外したりする */
export async function setTaskDone(id: string, done: boolean) {
  const status = await db.columns.get(STATUS_COLUMN_ID)
  const option = done ? status?.options?.find((o) => o.done) : null
  if (done && !option) return
  await updateTaskValue(id, STATUS_COLUMN_ID, option?.id ?? null)
}

export async function deleteTask(id: string) {
  await db.transaction("rw", db.tasks, db.timeBlocks, async () => {
    await db.tasks.delete(id)
    await db.timeBlocks.where("taskId").equals(id).delete()
  })
}

// ---- columns ----

export const defaultColumnWidth = (type: ColumnType) =>
  type === "number" || type === "duration" ? 90 : 160

export async function addColumn(name: string, type: ColumnType) {
  const last = await db.columns.orderBy("order").last()
  const column: Column = {
    id: newId(),
    name,
    type,
    options: type === "select" ? [] : undefined,
    order: (last?.order ?? 0) + 1,
    width: defaultColumnWidth(type),
  }
  await db.columns.add(column)
  return column
}

export async function updateColumn(id: string, changes: Partial<Column>) {
  await db.columns.update(id, changes)
}

export async function deleteColumn(id: string) {
  await db.transaction("rw", db.columns, db.tasks, async () => {
    await db.columns.delete(id)
    await db.tasks.toCollection().modify((t) => {
      delete t.values[id]
    })
  })
}

/**
 * 選択肢を保存する。
 * 同じ名前の選択肢は上にあるものへまとめ、消した選択肢（名前を空にしたものも）はタスクから外す。
 */
export async function saveOptions(columnId: string, options: SelectOption[]) {
  const kept: SelectOption[] = []
  const mergedInto = new Map<string, string>()
  for (const o of options) {
    const label = o.label.trim()
    if (!label) continue
    const same = kept.find((k) => k.label === label)
    if (same) mergedInto.set(o.id, same.id)
    else kept.push({ ...o, label })
  }
  const keptIds = new Set(kept.map((o) => o.id))
  await db.transaction("rw", db.columns, db.tasks, async () => {
    await db.columns.update(columnId, { options: kept })
    await db.tasks.toCollection().modify((t) => {
      const v = t.values[columnId]
      if (v == null || keptIds.has(String(v))) return
      t.values[columnId] = mergedInto.get(String(v)) ?? null
    })
  })
}

/** 選択肢をラベルで探し、無ければ作って id を返す */
export async function ensureOption(columnId: string, label: string) {
  const column = await db.columns.get(columnId)
  if (!column) throw new Error(`column not found: ${columnId}`)
  const existing = column.options?.find((o) => o.label === label)
  if (existing) return existing.id
  const options = column.options ?? []
  const option: SelectOption = {
    id: newId(),
    label,
    color: nextOptionColor(options.length),
  }
  await db.columns.update(columnId, { options: [...options, option] })
  return option.id
}

// ---- time blocks ----

export async function addTimeBlock(block: Omit<TimeBlock, "id">) {
  await db.timeBlocks.add({ id: newId(), ...block })
}

export async function updateTimeBlock(id: string, changes: Partial<TimeBlock>) {
  await db.timeBlocks.update(id, changes)
}

export async function deleteTimeBlock(id: string) {
  await db.timeBlocks.delete(id)
}

// ---- pomodoros ----

export async function recordPomodoro(session: Omit<PomodoroSession, "id" | "taskTitle">) {
  const task = session.taskId ? await db.tasks.get(session.taskId) : undefined
  await db.pomodoros.add({ id: newId(), ...session, taskTitle: task?.title || undefined })
}

export async function deletePomodoro(id: string) {
  await db.pomodoros.delete(id)
}

// ---- diaries ----

/** その日の日記を保存する。空にしたら消す */
export async function saveDiary(date: string, body: string) {
  const trimmed = body.trimEnd()
  if (!trimmed.trim()) await db.diaries.delete(date)
  else await db.diaries.put({ date, body: trimmed, updatedAt: Date.now() })
}
