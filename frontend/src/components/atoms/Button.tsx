"use client";
import { forwardRef } from "react";

type Variant = "primary" | "outline" | "ghost" | "danger";

const variantClass: Record<Variant, string> = {
  primary: "btn-primary",
  outline: "btn-outline",
  ghost: "btn-ghost",
  danger: "btn-danger",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  pending?: boolean;
  size?: "sm" | "md";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", pending = false, size = "md", className = "", children, disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      className={`btn ${variantClass[variant]} ${size === "sm" ? "btn-sm" : ""} ${className}`}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...rest}
    >
      {pending && <SpinnerInline />}
      {children}
    </button>
  );
});

function SpinnerInline() {
  return (
    <span
      aria-hidden
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

export default Button;
