import * as React from "react"

import { cn } from "@/lib/utils"

/* Fields keep a visible 1px border (#8E8E8E, 3.3:1 on white): the reference
   leaves inputs nearly borderless, but a field you cannot find fails WCAG 1.4.11.
   Placeholder stays Pewter (≥4.5:1) rather than the lighter Silver Fog for the
   same reason. 16px on phones stops iOS from zooming the page on focus. */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input bg-background flex h-10 w-full min-w-0 rounded-md border px-3 py-1 text-base transition-[color,border-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring",
        "aria-invalid:ring-2 aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
