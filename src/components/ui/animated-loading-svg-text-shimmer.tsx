import React from "react";
import { cn } from "../../lib/utils";
import { ShimmerText } from "./thinking-state";

export function Loader({ className, ...props }: React.HTMLAttributes<SVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-4 w-4 animate-spin", className)}
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

export function LoadingBreadcrumb({
  className,
  text = "Searching web & synthesizing...",
  isDark = true,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { text?: string; isDark?: boolean }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 border border-border/50 text-xs text-muted-foreground backdrop-blur-sm",
        className
      )}
      {...props}
    >
      <Loader className="h-3.5 w-3.5 text-primary animate-spin" />
      <ShimmerText text={text} isDark={isDark} className="font-medium text-xs" />
    </div>
  );
}
