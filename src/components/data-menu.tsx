import { useRef, useState } from "react"
import { DownloadIcon, EllipsisVerticalIcon, UploadIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { downloadBackup, parseBackup, restoreBackup, type Backup } from "@/lib/backup"

/** ヘッダー右端の「…」メニュー。データの書き出しと読み込み */
export function DataMenu() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ name: string; backup: Backup } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)

  const onFile = async (file: File) => {
    try {
      setPending({ name: file.name, backup: parseBackup(await file.text()) })
    } catch (e) {
      setError(e instanceof Error ? e.message : "ファイルを読み込めませんでした")
    }
  }

  const restore = async () => {
    if (!pending) return
    setRestoring(true)
    await restoreBackup(pending.backup)
    // 一覧の表示設定なども読み直すため、画面ごと読み込み直す
    location.reload()
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" title="データ">
            <EllipsisVerticalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => void downloadBackup()}>
            <DownloadIcon />
            データを書き出す
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => fileRef.current?.click()}>
            <UploadIcon />
            データを読み込む…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ""
          if (file) void onFile(file)
        }}
      />

      <Dialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>データを読み込む</DialogTitle>
            <DialogDescription>
              今のデータはすべて消え、ファイルの内容に置き換わります。
            </DialogDescription>
          </DialogHeader>
          {pending && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">ファイル</dt>
              <dd className="truncate">{pending.name}</dd>
              <dt className="text-muted-foreground">書き出した日時</dt>
              <dd>{new Date(pending.backup.exportedAt).toLocaleString("ja-JP")}</dd>
              <dt className="text-muted-foreground">タスク</dt>
              <dd>{pending.backup.tasks.length} 件</dd>
              <dt className="text-muted-foreground">カレンダーの予定</dt>
              <dd>{pending.backup.timeBlocks.length} 件</dd>
              <dt className="text-muted-foreground">列</dt>
              <dd>{pending.backup.columns.map((c) => c.name).join("、")}</dd>
            </dl>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPending(null)}>
              キャンセル
            </Button>
            <Button variant="destructive" disabled={restoring} onClick={() => void restore()}>
              置き換えて読み込む
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!error} onOpenChange={(open) => !open && setError(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>読み込めませんでした</DialogTitle>
            <DialogDescription>{error}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setError(null)}>閉じる</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
