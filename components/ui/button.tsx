import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonStyles = cva("btn", {
  variants: {
    tone: {
      primary: "btn-primary",
      quiet: "",
      danger: "btn-danger",
    },
  },
  defaultVariants: { tone: "quiet" },
});

export function Button({
  tone,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonStyles>) {
  return <button className={cn(buttonStyles({ tone }), className)} {...props} />;
}
