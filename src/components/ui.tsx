import type { ComponentProps } from "react";

// The two controls the interface needs. Dates, the employee filter and expandable report
// rows use native <input type="date">, <select> and <details>, accessible out of the box.

const BUTTON_VARIANTS = {
  primary: "bg-ink text-paper hover:bg-ink/85",
  secondary: "border border-rule bg-white hover:border-ink/40",
  stop: "border border-lamp bg-white text-lamp hover:bg-lamp hover:text-white",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof BUTTON_VARIANTS }) {
  return (
    <button
      className={`inline-flex h-10 shrink-0 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

export function TextInput({ className = "", ...props }: ComponentProps<"input">) {
  return (
    <input
      className={`h-10 w-full min-w-0 rounded-md border border-rule bg-white px-3 text-sm placeholder:text-muted ${className}`}
      {...props}
    />
  );
}
