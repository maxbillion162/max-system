"use client";

interface SparklineProps {
  data: number[];
  color: string;
  height?: number;
  showArea?: boolean;
  id: string;
}

function buildPaths(pts: { x: number; y: number }[], H: number) {
  if (pts.length < 2) return { line: "", area: "" };
  const segs: string[] = [];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], c = pts[i];
    const cpx = (p.x + c.x) / 2;
    segs.push(`C${cpx.toFixed(2)},${p.y.toFixed(2)} ${cpx.toFixed(2)},${c.y.toFixed(2)} ${c.x.toFixed(2)},${c.y.toFixed(2)}`);
  }
  const line = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)} ${segs.join(" ")}`;
  const area = `M${pts[0].x.toFixed(2)},${H} L${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)} ${segs.join(" ")} L${pts[pts.length - 1].x.toFixed(2)},${H} Z`;
  return { line, area };
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
    y: H - ((v - min) / range) * H * 0.78 - H * 0.11,
  }));

  const { line, area } = buildPaths(pts, H);
  const last = pts[pts.length - 1];
  const gradId = `sg-${id}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height, display: "block" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.20" />
          <stop offset="100%" stopColor={color} stopOpacity="0"    />
        </linearGradient>
      </defs>
      {showArea && <path d={area} fill={`url(#${gradId})`} />}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ opacity: 0.92 }}
      />
      {/* Endpoint glow dot */}
      <circle cx={last.x} cy={last.y} r="3.5" fill={color} opacity="0.15" />
      <circle cx={last.x} cy={last.y} r="2"   fill={color} />
    </svg>
  );
}
