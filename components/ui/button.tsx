import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonStyles = cva("btn", {
  variants: {
    tone: {
      primary: "btn-primary",
      accent: "btn-accent",
      quiet: "",
      tonal: "btn-tonal",
      ghost: "btn-ghost",
      danger: "btn-danger",
    },
    size: {
      sm: "btn-sm",
      md: "",
      lg: "btn-lg",
    },
  },
  defaultVariants: { tone: "quiet", size: "md" },
});

export function Button({
  tone,
  size,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonStyles>) {
  return <button className={cn(buttonStyles({ tone, size }), className)} {...props} />;
}
