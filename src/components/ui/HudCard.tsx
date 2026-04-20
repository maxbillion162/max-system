import { cn } from "@/lib/utils";

interface HudCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
  noAnim?: boolean;
}

export function HudCard({ children, className, style, delay = 0, noAnim = false }: HudCardProps) {
  return (
    <div
      className={cn(!noAnim && "afu", className)}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        animationDelay: `${delay}s`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
