import { useState } from "react"
import { formatDuration } from "@/lib/duration"
import { cn } from "@/lib/utils"

export interface Bucket {
  /** 軸に出す短いラベル（空文字なら出さない） */
  label: string
  /** ツールチップに出す見出し */
  title: string
  minutes: number
  count: number
  highlight?: boolean
}

const HEIGHT = 160

/** 目盛りが 15分・30分・1時間・2時間… のきりのよい間隔になるよう、間隔と上限を決める */
function niceScale(max: number) {
  const step = [15, 30, 60, 120, 180, 240, 360].find((s) => s * 4 >= max) ?? 480
  const top = Math.max(step, Math.ceil(max / step) * step)
  return { max: top, ticks: Array.from({ length: top / step + 1 }, (_, i) => i * step) }
}

/** 期間内の集中時間を縦棒で出す。1系列なので凡例は出さず、見出しで何の数値かを示す */
export function BarChart({ buckets }: { buckets: Bucket[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const { max, ticks } = niceScale(Math.max(...buckets.map((b) => b.minutes)))

  return (
    <div className="flex gap-2">
      {/* 縦軸 */}
      <div className="relative w-10 shrink-0 text-right text-[10px] text-muted-foreground tabular-nums" style={{ height: HEIGHT }}>
        {ticks.map((t) => (
          <span key={t} className="absolute right-0 -translate-y-1/2" style={{ bottom: (t / max) * HEIGHT - 6 }}>
            {t === 0 ? "0" : formatDuration(t)}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative" style={{ height: HEIGHT }}>
          {/* 目盛り線は控えめに */}
          {ticks.map((t) => (
            <div
              key={t}
              className={cn("absolute inset-x-0 border-t", t === 0 ? "border-border" : "border-border/40 border-dashed")}
              style={{ bottom: (t / max) * HEIGHT }}
            />
          ))}
          <div className="absolute inset-0 flex items-end gap-0.5">
            {buckets.map((b, i) => (
              <div
                key={i}
                className="relative flex h-full flex-1 items-end justify-center"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover((h) => (h === i ? null : h))}
              >
                {b.minutes > 0 && (
                  <div
                    className={cn(
                      "w-full max-w-10 rounded-t-[4px] bg-red-500 transition-opacity dark:bg-red-400",
                      hover != null && hover !== i && "opacity-50",
                    )}
                    style={{ height: Math.max(2, (b.minutes / max) * HEIGHT) }}
                  />
                )}
                {hover === i && (
                  <div className="pointer-events-none absolute bottom-full z-10 mb-1 rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-md">
                    <div className="font-medium">{b.title}</div>
                    <div className="text-muted-foreground tabular-nums">
                      {b.count} 🍅 ・ {b.minutes ? formatDuration(b.minutes) : "0m"}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        {/* 横軸 */}
        <div className="mt-1 flex gap-0.5">
          {buckets.map((b, i) => (
            <div
              key={i}
              className={cn(
                "flex-1 text-center text-[10px] whitespace-nowrap tabular-nums",
                b.highlight ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              {b.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
