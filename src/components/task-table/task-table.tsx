import { useEffect, useMemo, useState } from "react"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  EllipsisIcon,
  ListIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { findOption, isTaskDone, useColumns, useTasks } from "@/hooks/use-data"
import {
  addTask,
  deleteColumn,
  deleteTask,
  ensureOption,
  newId,
  updateTaskTitle,
  updateTaskValue,
  type Column,
  type Task,
} from "@/lib/db"
import { formatDuration, parseDuration } from "@/lib/duration"
import { pomodoro, usePomodoro } from "@/lib/pomodoro"
import { cn } from "@/lib/utils"
import { CellInput, SelectCellEditor, type Move } from "./cell-editor"
import { ColumnDialog, OptionsDialog } from "./column-dialogs"
import { OptionBadge } from "./option-badge"
import { FilterChips, FilterMenu, SortMenu } from "./table-toolbar"
import {
  activeFilters,
  compareTasks,
  EMPTY,
  loadView,
  matchesFilters,
  saveView,
  TITLE,
  type Sort,
} from "./view"

type Active = { row: string; col: string }
type Editing = { search: string }

function displayValue(task: Task, key: string, columns: Column[]) {
  if (key === TITLE) return task.title
  const column = columns.find((c) => c.id === key)
  const v = task.values[key]
  if (!column || v == null) return ""
  if (column.type === "select") return findOption(column, v)?.label ?? ""
  if (column.type === "duration") return formatDuration(Number(v))
  return String(v)
}

async function commitValue(taskId: string, key: string, raw: string, columns: Column[]) {
  if (key === TITLE) return updateTaskTitle(taskId, raw)
  const column = columns.find((c) => c.id === key)
  if (!column) return
  const trimmed = raw.trim()
  if (column.type === "number") {
    const n = Number(trimmed)
    if (trimmed === "") return updateTaskValue(taskId, key, null)
    if (!Number.isNaN(n)) return updateTaskValue(taskId, key, n)
    return
  }
  if (column.type === "duration") {
    if (trimmed === "") return updateTaskValue(taskId, key, null)
    const minutes = parseDuration(trimmed)
    // 解釈できない入力は無視して元の値のままにする
    if (minutes != null) return updateTaskValue(taskId, key, minutes)
    return
  }
  if (column.type === "select") {
    return updateTaskValue(taskId, key, trimmed ? await ensureOption(key, trimmed) : null)
  }
  return updateTaskValue(taskId, key, raw)
}

export function TaskTable() {
  const columns = useColumns()
  const tasks = useTasks()

  const [search, setSearch] = useState("")
  // 完了を隠す・並び替え・フィルタは次に開いたときも残す
  const [view, setView] = useState(loadView)
  const { hideDone, sort, filters } = view
  useEffect(() => saveView(view), [view])
  const setSort = (sort: Sort | null) => setView((v) => ({ ...v, sort }))
  const filterList = useMemo(() => activeFilters(filters, columns), [filters, columns])
  const [active, setActive] = useState<Active | null>(null)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [columnDialog, setColumnDialog] = useState<{ column?: Column } | null>(null)
  const [optionsColumn, setOptionsColumn] = useState<Column | null>(null)
  // 保存が終わる前から表示しておく新規行
  const [pending, setPending] = useState<Task | null>(null)

  const colKeys = useMemo(() => [TITLE, ...columns.map((c) => c.id)], [columns])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = pending && !tasks.some((t) => t.id === pending.id) ? [...tasks, pending] : tasks
    if (q) {
      list = list.filter((t) =>
        colKeys.some((k) => displayValue(t, k, columns).toLowerCase().includes(q)),
      )
    }
    if (hideDone) list = list.filter((t) => !isTaskDone(t, columns))
    if (filterList.length) list = list.filter((t) => matchesFilters(t, filterList))
    if (sort) list = [...list].sort((a, b) => compareTasks(a, b, sort, columns))
    return list
  }, [tasks, pending, columns, colKeys, search, hideDone, sort, filterList])

  const navigate = (from: Active, move: Move) => {
    const r = visible.findIndex((t) => t.id === from.row)
    const c = colKeys.indexOf(from.col)
    const dr = move === "down" ? 1 : move === "up" ? -1 : 0
    const dc = move === "right" ? 1 : move === "left" ? -1 : 0
    const nr = Math.min(Math.max(r + dr, 0), visible.length - 1)
    const nc = Math.min(Math.max(c + dc, 0), colKeys.length - 1)
    setActive({ row: visible[nr].id, col: colKeys[nc] })
  }

  // 続けて入力できるよう、保存を待たずに行を表示して編集を始める
  const createAndEdit = () => {
    // フィルタ中に追加した行が消えないよう、フィルタの値をあらかじめ入れておく
    const values: Task["values"] = {}
    for (const { column, values: selected } of filterList) {
      const value = selected.find((v) => v !== EMPTY)
      if (value) values[column.id] = value
    }
    const task: Task = {
      id: newId(),
      title: "",
      values,
      order: Math.max(0, pending?.order ?? 0, ...tasks.map((t) => t.order)) + 1,
      createdAt: Date.now(),
    }
    setPending(task)
    setSearch("")
    setActive({ row: task.id, col: TITLE })
    setEditing({ search: "" })
    void addTask(task)
  }

  const finishEdit = (cell: Active, raw: string, move?: Move) => {
    setEditing(null)
    void commitValue(cell.row, cell.col, raw, columns)
    if (!move) return
    const isLast = visible[visible.length - 1]?.id === cell.row
    // タイトル列で最終行の Enter は新しい行を追加して続けて入力できるようにする
    if (move === "down" && isLast && cell.col === TITLE && raw.trim()) {
      createAndEdit()
      return
    }
    navigate(cell, move)
  }

  const pasteGrid = async (cell: Active, text: string) => {
    const rows = text
      .replace(/\r/g, "")
      .replace(/\n$/, "")
      .split("\n")
      .map((r) => r.split("\t"))
    const startRow = visible.findIndex((t) => t.id === cell.row)
    const startCol = colKeys.indexOf(cell.col)
    for (let i = 0; i < rows.length; i++) {
      const task = visible[startRow + i] ?? (await addTask())
      for (let j = 0; j < rows[i].length; j++) {
        const key = colKeys[startCol + j]
        if (!key) break
        await commitValue(task.id, key, rows[i][j], columns)
      }
    }
  }

  const sortedBy = (col: string) => (sort?.col === col ? sort.dir : null)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-2">
        <div className="relative w-64">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 pl-8"
            placeholder="検索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <FilterMenu
          columns={columns}
          filters={filters}
          onChange={(filters) => setView((v) => ({ ...v, filters }))}
        />
        <SortMenu columns={columns} sort={sort} onChange={setSort} />
        <div className="flex items-center gap-2">
          <Switch
            id="hide-done"
            checked={hideDone}
            onCheckedChange={(hideDone) => setView((v) => ({ ...v, hideDone }))}
          />
          <Label htmlFor="hide-done" className="text-sm font-normal">
            完了を隠す
          </Label>
        </div>
        <span className="ml-auto text-xs text-muted-foreground">
          {visible.length} 件 ・ Sheets からの貼り付け可
        </span>
      </div>

      <FilterChips
        columns={columns}
        filters={filters}
        onChange={(filters) => setView((v) => ({ ...v, filters }))}
      />

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-max min-w-full table-fixed border-separate border-spacing-0 text-sm">
          <colgroup>
            <col className="w-9" />
            <col className="w-[320px]" />
            {columns.map((c) => (
              <col key={c.id} style={{ width: c.width }} />
            ))}
            <col className="w-10" />
          </colgroup>
          <thead className="sticky top-0 z-20 bg-muted/80 backdrop-blur">
            <tr className="text-left text-xs text-muted-foreground">
              <th className="border-b" />
              <HeaderCell
                label="タスク名"
                sortDir={sortedBy(TITLE)}
                onSort={(dir) => setSort({ col: TITLE, dir })}
              />
              {columns.map((c) => (
                <HeaderCell
                  key={c.id}
                  label={c.name}
                  sortDir={sortedBy(c.id)}
                  onSort={(dir) => setSort({ col: c.id, dir })}
                  onRename={() => setColumnDialog({ column: c })}
                  onEditOptions={c.type === "select" ? () => setOptionsColumn(c) : undefined}
                  onDelete={c.system ? undefined : () => void deleteColumn(c.id)}
                />
              ))}
              <th className="border-b px-1">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title="列を追加"
                  onClick={() => setColumnDialog({})}
                >
                  <PlusIcon />
                </Button>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((task) => {
              const done = isTaskDone(task, columns)
              return (
                <tr key={task.id} className="group">
                  <RowGutter task={task} />
                  {colKeys.map((key) => {
                    const column = columns.find((c) => c.id === key)
                    const isActive = active?.row === task.id && active.col === key
                    const cell = { row: task.id, col: key }
                    return (
                      <td
                        key={key}
                        className={cn(
                          "relative h-9 border-b border-l px-2",
                          isActive && "outline-2 -outline-offset-2 outline-primary",
                        )}
                        onMouseDown={() => {
                          if (!isActive) setActive(cell)
                        }}
                      >
                        <CellDisplay task={task} column={column} done={done} />
                        {isActive && (
                          <CellInput
                            value={displayValue(task, key, columns)}
                            kind={column?.type ?? "text"}
                            editing={!!editing}
                            onStartEdit={(s) => setEditing({ search: s ?? "" })}
                            onCommit={(raw, move) => finishEdit(cell, raw, move)}
                            onCancel={() => setEditing(null)}
                            onNavigate={(move) => navigate(cell, move)}
                            onClear={() => void commitValue(task.id, key, "", columns)}
                            onPasteGrid={(text) => void pasteGrid(cell, text)}
                          />
                        )}
                        {isActive && editing && column?.type === "select" && (
                          <SelectCellEditor
                            column={column}
                            value={task.values[key] ?? null}
                            initialSearch={editing.search}
                            onSelect={(id) => {
                              setEditing(null)
                              void updateTaskValue(task.id, key, id)
                            }}
                            onCreate={async (label) => {
                              setEditing(null)
                              await updateTaskValue(task.id, key, await ensureOption(key, label))
                            }}
                            onEditOptions={() => {
                              setEditing(null)
                              setOptionsColumn(column)
                            }}
                            onClose={() => setEditing(null)}
                          />
                        )}
                      </td>
                    )
                  })}
                  <td className="border-b border-l" />
                </tr>
              )
            })}
            <tr>
              <td />
              <td colSpan={colKeys.length + 1} className="px-1 py-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={createAndEdit}
                >
                  <PlusIcon />
                  新しいタスク
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {columnDialog && (
        <ColumnDialog
          column={columnDialog.column}
          open
          onOpenChange={(open) => !open && setColumnDialog(null)}
        />
      )}
      {optionsColumn && (
        <OptionsDialog
          column={optionsColumn}
          open
          onOpenChange={(open) => !open && setOptionsColumn(null)}
        />
      )}
    </div>
  )
}

function CellDisplay({ task, column, done }: { task: Task; column?: Column; done: boolean }) {
  if (!column) {
    return (
      <span
        className={cn(
          "block truncate",
          done && "text-muted-foreground line-through",
          !task.title && "text-muted-foreground/60",
        )}
      >
        {task.title || "無題"}
      </span>
    )
  }
  const v = task.values[column.id]
  if (v == null || v === "") return null
  if (column.type === "select") {
    const option = findOption(column, v)
    return option ? <OptionBadge option={option} /> : null
  }
  if (column.type === "number") {
    return <span className="block text-right tabular-nums">{v}</span>
  }
  if (column.type === "duration") {
    return <span className="block text-right tabular-nums">{formatDuration(Number(v))}</span>
  }
  return <span className="block truncate">{v}</span>
}

function HeaderCell({
  label,
  sortDir,
  onSort,
  onRename,
  onEditOptions,
  onDelete,
}: {
  label: string
  sortDir: 1 | -1 | null
  onSort: (dir: 1 | -1) => void
  onRename?: () => void
  onEditOptions?: () => void
  onDelete?: () => void
}) {
  return (
    <th className="border-b border-l p-0 font-medium">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-8 w-full items-center gap-1 px-2 text-left hover:bg-muted">
          <span className="truncate">{label}</span>
          {sortDir === 1 && <ArrowUpIcon className="size-3" />}
          {sortDir === -1 && <ArrowDownIcon className="size-3" />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => onSort(1)}>
            <ArrowUpIcon />
            昇順で並べ替え
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onSort(-1)}>
            <ArrowDownIcon />
            降順で並べ替え
          </DropdownMenuItem>
          {(onRename || onEditOptions) && <DropdownMenuSeparator />}
          {onRename && (
            <DropdownMenuItem onSelect={onRename}>
              <PencilIcon />
              名前を変更
            </DropdownMenuItem>
          )}
          {onEditOptions && (
            <DropdownMenuItem onSelect={onEditOptions}>
              <ListIcon />
              選択肢を編集
            </DropdownMenuItem>
          )}
          {onDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                <Trash2Icon />
                列を削除
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </th>
  )
}

function RowGutter({ task }: { task: Task }) {
  const isCurrent = usePomodoro((s) => s.taskId === task.id)

  return (
    <td className="border-b">
      <div className="flex items-center justify-end gap-0.5 pr-1">
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "rounded p-0.5 text-muted-foreground hover:bg-muted",
              isCurrent ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            )}
          >
            {isCurrent ? <span className="text-xs">🍅</span> : <EllipsisIcon className="size-4" />}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => pomodoro.start(task.id)}>
              <PlayIcon />
              ポモドーロを開始
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => void deleteTask(task.id)}>
              <Trash2Icon />
              タスクを削除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </td>
  )
}
