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
      className={cn("relative rounded-xl hover-lift", !noAnim && "afu", className)}
      style={{
        background: "linear-gradient(145deg, #090e1c 0%, #070b18 100%)",
        border: "1px solid rgba(6,182,212,0.12)",
        animationDelay: `${delay}s`,
        ...style,
      }}
    >
      {/* HUD corner brackets — single consistent teal color */}
      <span className="absolute top-0 left-0 w-3.5 h-3.5 pointer-events-none"
        style={{ borderTop: "1.5px solid rgba(6,182,212,0.45)", borderLeft: "1.5px solid rgba(6,182,212,0.45)", borderRadius: "3px 0 0 0" }} />
      <span className="absolute top-0 right-0 w-3.5 h-3.5 pointer-events-none"
        style={{ borderTop: "1.5px solid rgba(6,182,212,0.45)", borderRight: "1.5px solid rgba(6,182,212,0.45)", borderRadius: "0 3px 0 0" }} />
      <span className="absolute bottom-0 left-0 w-3.5 h-3.5 pointer-events-none"
        style={{ borderBottom: "1.5px solid rgba(6,182,212,0.45)", borderLeft: "1.5px solid rgba(6,182,212,0.45)", borderRadius: "0 0 0 3px" }} />
      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 pointer-events-none"
        style={{ borderBottom: "1.5px solid rgba(6,182,212,0.45)", borderRight: "1.5px solid rgba(6,182,212,0.45)", borderRadius: "0 0 3px 0" }} />
      {children}
    </div>
  );
}
