import type { KeyboardEvent } from "react"

/**
 * 日本語入力の変換中・変換確定のキーか。
 * Mac アプリ（WebKit）では確定の Enter の時点で isComposing が false になっているので、
 * 変換中のキーに付く keyCode 229 も見る
 */
export function isImeKey(e: KeyboardEvent) {
  return e.nativeEvent.isComposing || e.keyCode === 229
}
