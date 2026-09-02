import { cn } from "@/lib/utils";

export function Alert({ className, variant = "default", ...props }) {
  return (
    <div
      role="alert"
      className={cn(
        "relative w-full rounded-lg border px-4 py-3 text-sm",
        variant === "default" && "bg-background text-foreground",
        variant === "destructive" &&
          "border-destructive/40 bg-destructive/10 text-destructive dark:border-destructive/50",
        variant === "success" && "border-success/30 bg-success/10 text-success",
        variant === "warning" && "border-warning/30 bg-warning/10 text-foreground",
        className
      )}
      {...props}
    />
  );
}
