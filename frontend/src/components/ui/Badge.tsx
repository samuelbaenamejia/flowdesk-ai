import { type HTMLAttributes, type ReactNode } from "react";

const variants = {
  default: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300",
  success: "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  warning: "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400",
  info: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  error: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variants;
  children: ReactNode;
}

export function Badge({ variant = "default", children, ...rest }: BadgeProps) {
  return (
    <span
      {...rest}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[variant]}`}
    >
      {children}
    </span>
  );
}
