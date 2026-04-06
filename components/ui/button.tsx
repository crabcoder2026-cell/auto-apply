import * as React from "react"
import { Slot, Slottable } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold tracking-tight transition-all duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:w-4 [&_svg]:h-4 [&_svg]:shrink-0 hover:-translate-y-px",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-brutal hover:bg-primary/92 hover:shadow-brutal-lg hover:rotate-[-0.35deg]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:shadow-md",
        outline:
          "border-2 border-border bg-card/80 shadow-sm hover:border-primary/40 hover:bg-muted/50 hover:text-foreground hover:shadow-brutal",
        secondary:
          "bg-secondary text-secondary-foreground shadow-brutal hover:bg-secondary/88 hover:shadow-md",
        ghost:
          "hover:bg-accent hover:text-accent-foreground",
        "glass-dark":
          "bg-white/10 backdrop-blur-md border border-white/20 [box-shadow:inset_0_0_0_1px_rgba(255,255,255,0.1)] text-foreground shadow-sm hover:bg-white/25 hover:border-white/40 hover:shadow-lg focus-visible:ring-white/50 focus-visible:ring-ring/0",
        "glass-light":
          "bg-black/[0.06] backdrop-blur-md border border-black/10 [box-shadow:inset_0_0_0_1px_rgba(255,255,255,0.5)] text-foreground shadow-sm hover:bg-black/[0.12] hover:border-black/20 hover:shadow-lg focus-visible:ring-black/30 focus-visible:ring-ring/0",
        link:
          "text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:ring-0 focus-visible:ring-offset-0",
      },
      size: {
        default: "h-10 px-4 py-2",
        xs: "h-7 rounded-md px-2 text-xs",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-lg px-6 text-base",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        <Slottable>{loading && asChild ? null : children}</Slottable>
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }