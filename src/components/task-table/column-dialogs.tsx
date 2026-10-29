import { useState } from "react"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVerticalIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTasks } from "@/hooks/use-data"
import { optionDotClass } from "@/lib/colors"
import {
  addColumn,
  newId,
  saveOptions,
  nextOptionColor,
  OPTION_COLORS,
  updateColumn,
  type Column,
  type ColumnType,
  type OptionColor,
  type SelectOption,
} from "@/lib/db"
import { cn } from "@/lib/utils"

const TYPE_LABEL: Record<ColumnType, string> = {
  text: "テキスト",
  select: "選択肢",
  number: "数値",
  duration: "時間（1h30m・90分・1:30 など）",
}

export function ColumnDialog({
  column,
  open,
  onOpenChange,
}: {
  /** 未指定なら新規作成 */
  column?: Column
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [name, setName] = useState(column?.name ?? "")
  const [type, setType] = useState<ColumnType>(column?.type ?? "text")

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    if (column) await updateColumn(column.id, { name: trimmed })
    else await addColumn(trimmed, type)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{column ? "列の名前を変更" : "列を追加"}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="column-name">列名</Label>
            <Input
              id="column-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {!column && (
            <div className="grid gap-2">
              <Label>種類</Label>
              <Select value={type} onValueChange={(v) => setType(v as ColumnType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABEL) as ColumnType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={!name.trim()}>
              {column ? "保存" : "追加"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function OptionsDialog({
  column,
  open,
  onOpenChange,
}: {
  column: Column
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [options, setOptions] = useState<SelectOption[]>(column.options ?? [])
  const tasks = useTasks()
  const usage = (id: string) => tasks.filter((t) => t.values[column.id] === id).length

  const patch = (id: string, changes: Partial<SelectOption>) =>
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, ...changes } : o)))

  // 上にある同じ名前の選択肢（保存するとそこへまとめられる）
  const mergeTarget = (o: SelectOption, index: number) =>
    o.label.trim() &&
    options.slice(0, index).find((p) => p.label.trim() === o.label.trim())

  const save = async () => {
    await saveOptions(column.id, options)
    onOpenChange(false)
  }

  // アプリ全体の DndContext とは別に、この一覧だけの並べ替えを持つ
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    setOptions((prev) =>
      arrayMove(
        prev,
        prev.findIndex((o) => o.id === active.id),
        prev.findIndex((o) => o.id === over.id),
      ),
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>「{column.name}」の選択肢</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          <p className="text-xs text-muted-foreground">
            左のつまみをドラッグすると並び順を変えられます（Status で並び替えたときもこの順）。
            間違えて作った選択肢は、正しい選択肢と同じ名前にすると1つにまとめられます。
            削除した選択肢は、使っているタスクから外れます。
          </p>
          <div className={cn(OPTION_ROW, "text-xs text-muted-foreground")}>
            <span />
            <span>色</span>
            <span>ラベル</span>
            <span>使用</span>
            <span>完了扱い</span>
            <span />
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={options.map((o) => o.id)} strategy={verticalListSortingStrategy}>
              {options.map((o, i) => (
                <OptionRow
                  key={o.id}
                  option={o}
                  usage={usage(o.id)}
                  mergeInto={mergeTarget(o, i) ? o.label.trim() : null}
                  onChange={(changes) => patch(o.id, changes)}
                  onDelete={() => setOptions((prev) => prev.filter((p) => p.id !== o.id))}
                />
              ))}
            </SortableContext>
          </DndContext>
          <Button
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={() =>
              setOptions((prev) => [
                ...prev,
                {
                  id: newId(),
                  label: "",
                  color: nextOptionColor(prev.length),
                },
              ])
            }
          >
            <PlusIcon />
            選択肢を追加
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={() => void save()}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const OPTION_ROW = "grid grid-cols-[auto_auto_1fr_auto_auto_auto] items-center gap-2"

function OptionRow({
  option,
  usage,
  mergeInto,
  onChange,
  onDelete,
}: {
  option: SelectOption
  usage: number
  /** 保存するとまとめられる先のラベル */
  mergeInto: string | null
  onChange: (changes: Partial<SelectOption>) => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: option.id })

  return (
    <div
      ref={setNodeRef}
      className={cn(OPTION_ROW, "rounded-md bg-popover", isDragging && "relative z-10 shadow-md")}
      // 縦方向にだけ動かす
      style={{ transform: CSS.Translate.toString(transform && { ...transform, x: 0 }), transition }}
    >
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        title="ドラッグして並び順を変更"
        className="cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:bg-muted active:cursor-grabbing"
      >
        <GripVerticalIcon className="size-4" />
      </button>
      <ColorPicker value={option.color} onChange={(color) => onChange({ color })} />
      <div className="grid gap-0.5">
        <Input value={option.label} onChange={(e) => onChange({ label: e.target.value })} />
        {mergeInto && (
          <span className="text-xs text-blue-600 dark:text-blue-400">
            保存すると上の「{mergeInto}」にまとめます
          </span>
        )}
      </div>
      <span className="w-8 text-right text-xs text-muted-foreground tabular-nums">{usage}件</span>
      <div className="flex justify-center">
        <Checkbox
          checked={!!option.done}
          onCheckedChange={(checked) => onChange({ done: checked === true })}
        />
      </div>
      <Button variant="ghost" size="icon-sm" onClick={onDelete}>
        <Trash2Icon />
      </Button>
    </div>
  )
}

const COLOR_LABEL: Record<OptionColor, string> = {
  gray: "グレー",
  red: "赤",
  orange: "オレンジ",
  yellow: "黄",
  green: "緑",
  blue: "青",
  purple: "紫",
  pink: "ピンク",
}

function ColorPicker({
  value,
  onChange,
}: {
  value: OptionColor
  onChange: (color: OptionColor) => void
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as OptionColor)}>
      <SelectTrigger size="sm" className="w-14">
        <span className={cn("size-3 rounded-full", optionDotClass[value])} />
      </SelectTrigger>
      {/* トリガーに SelectValue を置いていないので、既定の item-aligned だと位置を計算できず画面外に出る */}
      <SelectContent position="popper" align="start">
        {OPTION_COLORS.map((c) => (
          <SelectItem key={c} value={c}>
            <span className={cn("size-3 rounded-full", optionDotClass[c])} />
            {COLOR_LABEL[c]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
