import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border text-sm font-semibold cursor-pointer shadow-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-px [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-primary bg-primary text-primary-foreground shadow-primary/20 hover:-translate-y-px hover:bg-primary/90 hover:shadow-md",
        destructive: "border-destructive bg-destructive text-destructive-foreground shadow-destructive/20 hover:-translate-y-px hover:bg-destructive/90 hover:shadow-md",
        outline:
          "border-input bg-background text-foreground hover:-translate-y-px hover:border-primary/40 hover:bg-primary-soft hover:text-primary hover:shadow-md",
        secondary: "border-border bg-secondary text-secondary-foreground hover:-translate-y-px hover:border-primary/20 hover:bg-secondary/80 hover:shadow-md",
        ghost: "border-transparent bg-transparent text-muted-foreground shadow-none hover:border-border hover:bg-muted hover:text-foreground",
        link: "border-transparent bg-transparent text-primary shadow-none hover:text-primary/80 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-xl px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
