import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronUpIcon,
  FilterIcon,
  PlusIcon,
  XIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { findOption } from "@/hooks/use-data"
import type { Column } from "@/lib/db"
import { OptionBadge } from "./option-badge"
import { activeFilters, CREATED, EMPTY, TITLE, type Filters, type Sort } from "./view"

export function FilterMenu({
  columns,
  filters,
  onChange,
}: {
  columns: Column[]
  filters: Filters
  onChange: (filters: Filters) => void
}) {
  const selectColumns = columns.filter((c) => c.type === "select")
  const count = activeFilters(filters, columns).length

  const toggle = (columnId: string, value: string, checked: boolean) => {
    const current = filters[columnId] ?? []
    onChange({
      ...filters,
      [columnId]: checked ? [...current, value] : current.filter((v) => v !== value),
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={count ? "secondary" : "ghost"} size="sm">
          <FilterIcon />
          フィルタ{count > 0 && ` ${count}`}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {selectColumns.length === 0 && (
          <DropdownMenuLabel className="font-normal text-muted-foreground">
            選択肢の列がありません
          </DropdownMenuLabel>
        )}
        {selectColumns.map((c) => (
          <DropdownMenuSub key={c.id}>
            <DropdownMenuSubTrigger>
              {c.name}
              {(filters[c.id]?.length ?? 0) > 0 && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {filters[c.id].length}
                </span>
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
              {[...(c.options ?? []), null].map((o) => {
                const value = o?.id ?? EMPTY
                return (
                  <DropdownMenuCheckboxItem
                    key={value}
                    checked={filters[c.id]?.includes(value) ?? false}
                    // 続けて複数選べるようにメニューを閉じない
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={(checked) => toggle(c.id, value, checked)}
                  >
                    {o ? <OptionBadge option={o} /> : <span className="text-muted-foreground">未設定</span>}
                  </DropdownMenuCheckboxItem>
                )
              })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}
        {count > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onChange({})}>フィルタをすべて解除</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function SortMenu({
  columns,
  sorts,
  onChange,
}: {
  columns: Column[]
  sorts: Sort[]
  onChange: (sorts: Sort[]) => void
}) {
  const fields = [
    { id: TITLE, name: "タスク名" },
    ...columns.map((c) => ({ id: c.id, name: c.name })),
    { id: CREATED, name: "作成日" },
  ]
  const nameOf = (id: string) => fields.find((f) => f.id === id)?.name
  // 削除済みの列の条件は表示しない
  const rules = sorts.filter((s) => nameOf(s.col))
  const unused = fields.filter((f) => !rules.some((s) => s.col === f.id))

  const update = (index: number, changes: Partial<Sort>) =>
    onChange(rules.map((s, i) => (i === index ? { ...s, ...changes } : s)))
  const moveUp = (index: number) => {
    const next = [...rules]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    onChange(next)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant={rules.length ? "secondary" : "ghost"} size="sm">
          {rules.length === 1 ? (
            rules[0].dir === 1 ? (
              <ArrowUpIcon />
            ) : (
              <ArrowDownIcon />
            )
          ) : (
            <ArrowUpDownIcon />
          )}
          {rules.length === 0
            ? "並び替え"
            : rules.length === 1
              ? nameOf(rules[0].col)
              : `並び替え ${rules.length}`}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[22rem] gap-2">
        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">並び替えの条件はありません（作成順）</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            上の条件が同じタスクは、下の条件で並び替えます
          </p>
        )}
        {rules.map((rule, i) => (
          // 項目を変えても行を作り直さないよう、位置をキーにする
          <div key={i} className="flex items-center gap-1.5">
            <span className="w-4 text-center text-xs text-muted-foreground tabular-nums">{i + 1}</span>
            <Select value={rule.col} onValueChange={(col) => update(i, { col })}>
              <SelectTrigger size="sm" className="min-w-0 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {fields
                  .filter((f) => f.id === rule.col || unused.includes(f))
                  .map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Select
              value={String(rule.dir)}
              onValueChange={(dir) => update(i, { dir: dir === "1" ? 1 : -1 })}
            >
              <SelectTrigger size="sm" className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="1">昇順</SelectItem>
                <SelectItem value="-1">降順</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon-sm"
              title="優先順位を上げる"
              disabled={i === 0}
              onClick={() => moveUp(i)}
            >
              <ChevronUpIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              title="この条件を外す"
              onClick={() => onChange(rules.filter((_, j) => j !== i))}
            >
              <XIcon />
            </Button>
          </div>
        ))}
        <div className="flex items-center justify-between pt-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={unused.length === 0}
            onClick={() => onChange([...rules, { col: unused[0].id, dir: 1 }])}
          >
            <PlusIcon />
            並び替えを追加
          </Button>
          {rules.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => onChange([])}>
              すべて解除
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** 効いているフィルタをツールバーの下にチップで出す */
export function FilterChips({
  columns,
  filters,
  onChange,
}: {
  columns: Column[]
  filters: Filters
  onChange: (filters: Filters) => void
}) {
  const active = activeFilters(filters, columns)
  if (active.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-4 py-1.5">
      {active.map(({ column, values }) => (
        <span
          key={column.id}
          className="inline-flex items-center gap-1 rounded-full border bg-muted/50 py-0.5 pr-1 pl-2.5 text-xs"
        >
          <span className="text-muted-foreground">{column.name}:</span>
          {values.map((v) => {
            const option = findOption(column, v)
            return option ? (
              <OptionBadge key={v} option={option} />
            ) : (
              <span key={v} className="text-muted-foreground">
                未設定
              </span>
            )
          })}
          <button
            title="このフィルタを外す"
            className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => onChange({ ...filters, [column.id]: [] })}
          >
            <XIcon className="size-3" />
          </button>
        </span>
      ))}
    </div>
  )
}
