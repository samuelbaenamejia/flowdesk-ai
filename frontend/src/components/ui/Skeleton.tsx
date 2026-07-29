const variants = {
  text: "h-4 w-full",
  title: "h-6 w-48",
  avatar: "h-10 w-10 rounded-full",
  row: "h-12 w-full",
};

interface SkeletonProps {
  variant?: keyof typeof variants;
  width?: string;
  height?: string;
  className?: string;
}

export function Skeleton({
  variant = "text",
  width,
  height,
  className = "",
}: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700 ${variants[variant]} ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}
