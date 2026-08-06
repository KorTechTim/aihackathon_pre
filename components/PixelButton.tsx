"use client";

import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
};

export function PixelButton({ variant = "primary", className = "", children, ...props }: Props) {
  return <button className={`pixel-button ${variant} ${className}`} {...props}><span>{children}</span></button>;
}
