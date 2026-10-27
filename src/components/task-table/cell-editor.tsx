import { useEffect, useRef, useState } from "react"
import { CheckIcon, PencilIcon, PlusIcon, XIcon } from "lucide-react"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import type { CellValue, Column, ColumnType } from "@/lib/db"
import { cn } from "@/lib/utils"
import { OptionBadge } from "./option-badge"

export type Move = "up" | "down" | "left" | "right"

/**
 * アクティブなセルに常に置いておく入力欄。
 * 選択中は透明で、文字を打ち始めるとそのまま編集モードになる（日本語入力にも対応）。
 * 選択肢の列ではキー操作を受けるだけで、編集はポップオーバーで行う。
 */
export function CellInput({
  value,
  kind,
  editing,
  onStartEdit,
  onCommit,
  onCancel,
  onNavigate,
  onClear,
  onPasteGrid,
}: {
  value: string
  kind: ColumnType
  editing: boolean
  onStartEdit: (search?: string) => void
  onCommit: (value: string, move?: Move) => void
  onCancel: () => void
  onNavigate: (move: Move) => void
  onClear: () => void
  onPasteGrid: (text: string) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(editing ? value : "")
  const textEditing = editing && kind !== "select"
  const committed = useRef(false)

  // 選択肢の編集中はポップオーバー側にフォーカスを渡す
  useEffect(() => {
    if (!editing || kind !== "select") ref.current?.focus()
  }, [editing, kind])

  const commit = (move?: Move) => {
    if (committed.current) return
    committed.current = true
    onCommit(draft, move)
  }

  return (
    <input
      ref={ref}
      className={cn(
        "absolute inset-0 z-10 w-full px-2 text-sm outline-none",
        textEditing
          ? "bg-background outline-2 -outline-offset-2 outline-primary"
          : "cursor-default caret-transparent opacity-0",
        (kind === "number" || kind === "duration") && "text-right tabular-nums",
      )}
      inputMode={kind === "number" ? "decimal" : undefined}
      value={textEditing ? draft : ""}
      onChange={(e) => {
        if (kind === "select") {
          if (!(e.nativeEvent as InputEvent).isComposing) onStartEdit(e.target.value)
          return
        }
        setDraft(e.target.value)
        if (!editing) {
          committed.current = false
          onStartEdit()
        }
      }}
      onCompositionStart={() => {
        if (kind !== "select" && !editing) {
          committed.current = false
          setDraft("")
          onStartEdit()
        }
      }}
      onCompositionEnd={(e) => {
        if (kind === "select") onStartEdit(e.data)
      }}
      onBlur={() => {
        if (textEditing) commit()
      }}
      onCopy={(e) => {
        if (textEditing) return
        e.preventDefault()
        e.clipboardData.setData("text/plain", value)
      }}
      onPaste={(e) => {
        if (textEditing) return
        e.preventDefault()
        onPasteGrid(e.clipboardData.getData("text/plain"))
      }}
      // 選択中の選択肢セルをもう一度クリックしたら開く
      onClick={() => {
        if (kind === "select" && !editing) onStartEdit("")
      }}
      onDoubleClick={() => {
        if (editing) return
        committed.current = false
        setDraft(value)
        onStartEdit()
      }}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return
        if (textEditing) {
          if (e.key === "Enter") {
            e.preventDefault()
            commit("down")
          } else if (e.key === "Tab") {
            e.preventDefault()
            commit(e.shiftKey ? "left" : "right")
          } else if (e.key === "Escape") {
            e.preventDefault()
            committed.current = true
            onCancel()
          }
          return
        }
        const arrows: Record<string, Move> = {
          ArrowUp: "up",
          ArrowDown: "down",
          ArrowLeft: "left",
          ArrowRight: "right",
        }
        if (arrows[e.key]) {
          e.preventDefault()
          onNavigate(arrows[e.key])
        } else if (e.key === "Tab") {
          e.preventDefault()
          onNavigate(e.shiftKey ? "left" : "right")
        } else if (e.key === "Enter") {
          e.preventDefault()
          committed.current = false
          setDraft(value)
          onStartEdit()
        } else if (e.key === "Backspace" || e.key === "Delete") {
          e.preventDefault()
          onClear()
        } else if (e.key === "Escape") {
          ref.current?.blur()
        }
      }}
    />
  )
}

export function SelectCellEditor({
  column,
  value,
  initialSearch,
  onSelect,
  onCreate,
  onEditOptions,
  onClose,
}: {
  column: Column
  value: CellValue
  initialSearch: string
  onSelect: (optionId: string | null) => void
  onCreate: (label: string) => void
  onEditOptions: () => void
  onClose: () => void
}) {
  const [search, setSearch] = useState(initialSearch)
  const options = column.options ?? []
  const trimmed = search.trim()
  const exact = options.some((o) => o.label === trimmed)

  return (
    <Popover open onOpenChange={(open) => !open && onClose()}>
      <PopoverAnchor className="absolute inset-0" />
      <PopoverContent
        className="w-56 p-0"
        align="start"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <Command>
          <CommandInput
            autoFocus
            placeholder="検索または新規作成…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>選択肢がありません</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem key={o.id} value={o.label} onSelect={() => onSelect(o.id)}>
                  <OptionBadge option={o} />
                  {o.id === value && <CheckIcon className="ml-auto" />}
                </CommandItem>
              ))}
              {trimmed && !exact && (
                <CommandItem value={`__create__${trimmed}`} onSelect={() => onCreate(trimmed)}>
                  <PlusIcon />
                  「{trimmed}」を作成
                </CommandItem>
              )}
              {value != null && (
                <CommandItem value="__clear__" onSelect={() => onSelect(null)}>
                  <XIcon />
                  クリア
                </CommandItem>
              )}
            </CommandGroup>
            <CommandSeparator alwaysRender />
            <CommandGroup forceMount>
              <CommandItem value="__edit__" forceMount onSelect={onEditOptions}>
                <PencilIcon />
                選択肢を編集…
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
