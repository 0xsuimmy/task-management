import type { TimeBlock } from "@/lib/db"

export const HOUR_PX = 48
export const PX_PER_MIN = HOUR_PX / 60
export const SNAP = 15
export const DAY_MIN = 24 * 60
/** 空き枠をクリックしたときの予定の長さ（Google カレンダーと同じ1時間） */
export const DEFAULT_DURATION = 60

export const snap = (min: number) => Math.round(min / SNAP) * SNAP
export const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

/** 列の上端からの y 座標を、15分単位に切り捨てた分に変換する */
export const minuteAt = (y: number, top: number) =>
  clamp(Math.floor((y - top) / PX_PER_MIN / SNAP) * SNAP, 0, DAY_MIN - SNAP)

export function formatMinutes(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}:${String(m).padStart(2, "0")}`
}

/** 重なっている予定を横に並べるためのレーン割り当て */
export function layoutLanes(blocks: TimeBlock[]) {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || b.duration - a.duration)
  const result: { block: TimeBlock; lane: number; lanes: number }[] = []
  let cluster: typeof result = []
  let laneEnds: number[] = []
  let clusterEnd = -1

  const flush = () => {
    cluster.forEach((item) => (item.lanes = laneEnds.length))
    result.push(...cluster)
    cluster = []
    laneEnds = []
  }

  for (const block of sorted) {
    if (block.start >= clusterEnd) flush()
    let lane = laneEnds.findIndex((end) => end <= block.start)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = block.start + block.duration
    cluster.push({ block, lane, lanes: 1 })
    clusterEnd = Math.max(clusterEnd, block.start + block.duration)
  }
  flush()
  return result
}
