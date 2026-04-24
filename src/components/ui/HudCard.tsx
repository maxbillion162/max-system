import { cn } from "@/lib/utils";

interface HudCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
  noAnim?: boolean;
  accent?: boolean;
}

export function HudCard({ children, className, style, delay = 0, noAnim = false, accent = false }: HudCardProps) {
  return (
    <div
      className={cn(!noAnim && "afu", className)}
      style={{
        background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
        border: "1px solid rgba(125,184,232,0.10)",
        borderRadius: 3,
        boxShadow: accent
          ? "0 0 0 1px rgba(125,184,232,0.06), 0 8px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(125,184,232,0.06)"
          : "0 6px 24px rgba(0,0,0,0.45), inset 0 1px 0 rgba(125,184,232,0.035)",
        animationDelay: `${delay}s`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
