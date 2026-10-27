/**
 * 時間の入力を分に変換する。解釈できなければ null。
 * 90 / 90m / 90分 → 90、1h / 1時間 → 60、1.5h → 90、1h30m / 1時間30分 / 1:30 → 90
 */
export function parseDuration(raw: string): number | null {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[０-９．：]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, "")
  if (!s) return null

  const clock = s.match(/^(\d+):(\d{1,2})$/)
  if (clock) return Number(clock[1]) * 60 + Number(clock[2])

  const parts = s.match(/^(?:(\d+(?:\.\d+)?)(?:h|hr|hours?|時間))?(?:(\d+(?:\.\d+)?)(?:m|min|分)?)?$/)
  if (!parts || (!parts[1] && !parts[2])) return null
  const minutes = Number(parts[1] ?? 0) * 60 + Number(parts[2] ?? 0)
  return Math.round(minutes)
}

/** 分を「1h30m」形式で表示する */
export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h && m) return `${h}h${m}m`
  if (h) return `${h}h`
  return `${m}m`
}
