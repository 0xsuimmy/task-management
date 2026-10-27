import { findOption } from "@/hooks/use-data"
import type { Column, Task } from "@/lib/db"

export const TITLE = "title"
export const CREATED = "createdAt"
/** フィルタで「未設定」を表す値 */
export const EMPTY = "__empty__"

export type Sort = { col: string; dir: 1 | -1 }
/** 列 id → 表示する選択肢 id（EMPTY を含む）。空配列・未指定はフィルタなし */
export type Filters = Record<string, string[]>

export interface TableView {
  hideDone: boolean
  sort: Sort | null
  filters: Filters
}

const STORAGE_KEY = "task-table-view"

export function loadView(): TableView {
  const fallback: TableView = { hideDone: false, sort: null, filters: {} }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<TableView>) } : fallback
  } catch {
    return fallback
  }
}

export function saveView(view: TableView) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(view))
  } catch {
    // 保存できなくても表示はそのまま使える
  }
}

/** 存在しない列や選択肢を除いた、実際に効いているフィルタ */
export function activeFilters(filters: Filters, columns: Column[]) {
  return columns.flatMap((c) => {
    if (c.type !== "select") return []
    const values = (filters[c.id] ?? []).filter((v) => v === EMPTY || findOption(c, v))
    return values.length ? [{ column: c, values }] : []
  })
}

export function matchesFilters(task: Task, active: ReturnType<typeof activeFilters>) {
  return active.every(({ column, values }) => {
    const v = task.values[column.id]
    return values.includes(v == null || v === "" ? EMPTY : String(v))
  })
}

export function sortValue(task: Task, key: string, columns: Column[]): string | number | null {
  if (key === TITLE) return task.title || null
  if (key === CREATED) return task.createdAt
  const column = columns.find((c) => c.id === key)
  const v = task.values[key]
  if (!column || v == null || v === "") return null
  // 選択肢は定義順で並べる（未着手→進行中→完了 など）
  if (column.type === "select") return column.options?.findIndex((o) => o.id === v) ?? null
  return v
}

export function compareTasks(a: Task, b: Task, sort: Sort, columns: Column[]) {
  const va = sortValue(a, sort.col, columns)
  const vb = sortValue(b, sort.col, columns)
  // 空の値は並び順に関係なく最後
  if (va == null) return vb == null ? 0 : 1
  if (vb == null) return -1
  return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir
}
