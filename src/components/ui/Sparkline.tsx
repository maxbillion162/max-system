"use client";

interface SparklineProps {
  data: number[];
  color: string;
  height?: number;
  showArea?: boolean;
  id: string;
}

export function Sparkline({ data, color, height = 40, showArea = true, id }: SparklineProps) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const W = 100;
  const H = 100;

  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * W,
    y: H - ((v - min) / range) * (H * 0.85) - H * 0.075,
  }));

  const polyline = pts.map(p => `${p.x},${p.y}`).join(" ");
  const areaPath =
    `M${pts[0].x},${H} ` +
    pts.map(p => `L${p.x},${p.y}`).join(" ") +
    ` L${pts[pts.length - 1].x},${H} Z`;

  const gradId = `spark-grad-${id}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {showArea && <path d={areaPath} fill={`url(#${gradId})`} />}
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: 400,
          strokeDashoffset: 400,
          animation: "draw 1.2s ease forwards",
        }}
      />
      {/* Last point dot */}
      <circle
        cx={pts[pts.length - 1].x}
        cy={pts[pts.length - 1].y}
        r="3"
        fill={color}
        style={{ filter: `drop-shadow(0 0 4px ${color})` }}
      />
    </svg>
  );
}
