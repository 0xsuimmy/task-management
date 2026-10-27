import type { OptionColor } from "@/lib/db"

// Tailwind がクラス名を検出できるよう、すべてリテラルで書く
export const optionColorClass: Record<OptionColor, string> = {
  gray: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  red: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  green: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  pink: "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
}

export const optionDotClass: Record<OptionColor, string> = {
  gray: "bg-zinc-400",
  red: "bg-red-500",
  orange: "bg-orange-500",
  yellow: "bg-yellow-500",
  green: "bg-green-500",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
}

export const blockColorClass: Record<OptionColor, string> = {
  gray: "border-zinc-400 bg-zinc-50 dark:bg-zinc-900",
  red: "border-red-500 bg-red-50 dark:bg-red-950/60",
  orange: "border-orange-500 bg-orange-50 dark:bg-orange-950/60",
  yellow: "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/60",
  green: "border-green-500 bg-green-50 dark:bg-green-950/60",
  blue: "border-blue-500 bg-blue-50 dark:bg-blue-950/60",
  purple: "border-purple-500 bg-purple-50 dark:bg-purple-950/60",
  pink: "border-pink-500 bg-pink-50 dark:bg-pink-950/60",
}
