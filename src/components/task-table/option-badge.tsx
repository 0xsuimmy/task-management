import { optionColorClass } from "@/lib/colors"
import type { SelectOption } from "@/lib/db"
import { cn } from "@/lib/utils"

export function OptionBadge({ option, className }: { option: SelectOption; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center truncate rounded-md px-1.5 py-0.5 text-xs font-medium",
        optionColorClass[option.color],
        className,
      )}
    >
      {option.label}
    </span>
  )
}
