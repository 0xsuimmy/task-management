import { useLiveQuery } from "dexie-react-hooks"
import {
  db,
  STATUS_COLUMN_ID,
  type Column,
  type OptionColor,
  type Task,
  type TimeBlock,
} from "@/lib/db"

export function useColumns() {
  return useLiveQuery(() => db.columns.orderBy("order").toArray(), [], [] as Column[])
}

export function useTasks() {
  return useLiveQuery(() => db.tasks.orderBy("order").toArray(), [], [] as Task[])
}

export function useAllBlocks() {
  return useLiveQuery(() => db.timeBlocks.toArray(), [], [] as TimeBlock[])
}

export function findOption(column: Column, value: unknown) {
  return column.options?.find((o) => o.id === value)
}

export function isTaskDone(task: Task, columns: Column[]) {
  return columns.some((c) => c.type === "select" && findOption(c, task.values[c.id])?.done)
}

/** タイムラインのブロック色。Status 以外で最初の選択肢列（Project など）の色を使う */
export function taskColor(task: Task, columns: Column[]): OptionColor {
  const column = columns.find((c) => c.type === "select" && c.id !== STATUS_COLUMN_ID)
  return (column && findOption(column, task.values[column.id])?.color) || "blue"
}
