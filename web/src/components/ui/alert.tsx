import * as React from "react"

import { cn } from "@/lib/utils"

function Alert({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="status"
      data-slot="alert"
      className={cn("rounded-xl border border-border bg-background/75 p-3 text-sm", className)}
      {...props}
    />
  )
}

export { Alert }
