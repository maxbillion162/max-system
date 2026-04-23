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
        background: "linear-gradient(145deg, #111826 0%, #0b0e1a 100%)",
        border: "1px solid rgba(77,144,255,0.13)",
        borderRadius: 10,
        boxShadow: accent
          ? "0 0 0 1px rgba(77,144,255,0.08), 0 4px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(77,144,255,0.14)"
          : "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(77,144,255,0.07)",
        animationDelay: `${delay}s`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
