import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, FilterIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  sort,
  onChange,
}: {
  columns: Column[]
  sort: Sort | null
  onChange: (sort: Sort | null) => void
}) {
  const fields = [
    { id: TITLE, name: "タスク名" },
    ...columns.map((c) => ({ id: c.id, name: c.name })),
    { id: CREATED, name: "作成日" },
  ]
  const current = fields.find((f) => f.id === sort?.col)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={sort ? "secondary" : "ghost"} size="sm">
          {sort ? sort.dir === 1 ? <ArrowUpIcon /> : <ArrowDownIcon /> : <ArrowUpDownIcon />}
          {current ? current.name : "並び替え"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel className="text-xs text-muted-foreground">並び替える項目</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={sort?.col ?? ""}
          onValueChange={(col) => onChange({ col, dir: sort?.dir ?? 1 })}
        >
          {fields.map((f) => (
            <DropdownMenuRadioItem key={f.id} value={f.id}>
              {f.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {sort && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={String(sort.dir)}
              onValueChange={(dir) => onChange({ ...sort, dir: dir === "1" ? 1 : -1 })}
            >
              <DropdownMenuRadioItem value="1">昇順</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="-1">降順</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onChange(null)}>並び替えを解除（作成順）</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
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
