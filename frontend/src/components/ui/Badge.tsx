import { type ReactNode } from "react";

const variants = {
  default: "bg-gray-100 text-gray-500",
  success: "bg-green-50 text-green-600",
  warning: "bg-yellow-50 text-yellow-600",
  info: "bg-blue-50 text-blue-600",
  error: "bg-red-50 text-red-600",
};

interface BadgeProps {
  variant?: keyof typeof variants;
  children: ReactNode;
}

export function Badge({ variant = "default", children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[variant]}`}
    >
      {children}
    </span>
  );
}
