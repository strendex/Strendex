"use client";

// The performance signature radar.
//
// Hand-drawn SVG on a FIXED viewBox rather than a pixel-laid-out chart
// library. A library lays the chart out in device pixels and draws the axis
// labels at a fixed font size, so on a narrow phone the polygon shrinks while
// the words do not — which is exactly how "Endurance" (left) and "Squat"
// (right) ended up outside the box. Here every coordinate, including the type,
// lives in viewBox units, so the whole drawing scales as one. Containment is
// structural: there is no width, and no browser zoom level, at which a label
// can outgrow the space reserved for it.
//
// The margins are deliberately asymmetric. "Endurance" is the widest label and
// sits on the left, "Squat" the narrowest on the right, so the polygon is
// pushed right of the geometric centre and the labels balance it optically.

import { useId } from "react";

interface ChartProps {
  data: { subject: string; value: number }[];
}

// All in viewBox units. The left margin (CX - R - LABEL_GAP = 69) reserves
// about 25% more room than "Endurance" needs at FONT_SIZE, which is the slack
// that covers the fallback font stack if Inter has not loaded yet.
const VIEW_W = 254;
const VIEW_H = 176;
const CX = 140;
const CY = 87;
const R = 62;
const LABEL_GAP = 9;
const FONT_SIZE = 11;
const RINGS = [0.25, 0.5, 0.75, 1];

// Brand palette only: hairline grid, secondary text, primary ink for the plot.
// The accent lime is reserved for the primary CTA and the score number.
const GRID = "rgba(255,255,255,0.09)";
const GRID_OUTER = "rgba(255,255,255,0.16)";
const SPOKE = "rgba(255,255,255,0.07)";
const LABEL = "#A0A6B0";
const PLOT = "#F5F7FA";

/** Two decimals is plenty for path data and keeps the markup readable. */
function n(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Where axis `index` sits at `radius`, plus its outward unit vector. */
function pointAt(index: number, count: number, radius: number) {
  const angle = ((-90 + (360 / count) * index) * Math.PI) / 180;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  return { x: CX + radius * dx, y: CY + radius * dy, dx, dy };
}

function polygonFor(count: number, radiusOf: (index: number) => number): string {
  return Array.from({ length: count }, (_, i) => {
    const p = pointAt(i, count, radiusOf(i));
    return `${n(p.x)},${n(p.y)}`;
  }).join(" ");
}

export default function StrendexChart({ data }: ChartProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;

  if (data.length === 0) return null;

  const count = data.length;
  // Display clamp for the drawing only — the values themselves are the
  // server's, and nothing here recomputes them.
  const valueOf = (index: number) =>
    Math.max(0, Math.min(100, data[index].value));

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="mx-auto block h-auto w-full max-w-[360px]"
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
    >
      <title id={titleId}>Performance signature</title>
      <desc id={descId}>
        {`Each axis is scored out of 100. ${data
          .map((d) => `${d.subject} ${d.value.toFixed(1)}`)
          .join(", ")}.`}
      </desc>

      {/* Grid rings, outermost drawn a touch brighter as the boundary. */}
      {RINGS.map((ring) => (
        <polygon
          key={ring}
          points={polygonFor(count, () => ring * R)}
          fill="none"
          stroke={ring === 1 ? GRID_OUTER : GRID}
          strokeWidth={0.8}
        />
      ))}

      {/* Spokes */}
      {Array.from({ length: count }, (_, i) => {
        const p = pointAt(i, count, R);
        return (
          <line
            key={`spoke-${i}`}
            x1={CX}
            y1={CY}
            x2={n(p.x)}
            y2={n(p.y)}
            stroke={SPOKE}
            strokeWidth={0.8}
          />
        );
      })}

      {/* The athlete's shape */}
      <polygon
        points={polygonFor(count, valueOf)}
        fill={PLOT}
        fillOpacity={0.1}
        stroke={PLOT}
        strokeOpacity={0.55}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />

      {Array.from({ length: count }, (_, i) => {
        const p = pointAt(i, count, (valueOf(i) / 100) * R);
        return (
          <circle
            key={`dot-${i}`}
            cx={n(p.x)}
            cy={n(p.y)}
            r={2.4}
            fill={PLOT}
            fillOpacity={0.85}
          />
        );
      })}

      {/* Axis labels. Every axis keeps its full name — the reserved margins
          are what make that safe, not shortening the words. */}
      {data.map((entry, i) => {
        const p = pointAt(i, count, R);
        const anchor = p.dx > 0.3 ? "start" : p.dx < -0.3 ? "end" : "middle";

        // Above the top vertex, below the bottom one, optically centred on the
        // side ones — measured from the vertex so the gap reads even.
        const y =
          p.dy < -0.3
            ? p.y - 8
            : p.dy > 0.3
              ? p.y + 8 + FONT_SIZE * 0.72
              : p.y + FONT_SIZE * 0.36;

        return (
          <text
            key={entry.subject}
            x={n(CX + (R + LABEL_GAP) * p.dx)}
            y={n(y)}
            textAnchor={anchor}
            fill={LABEL}
            fontSize={FONT_SIZE}
            fontWeight={600}
          >
            {entry.subject}
          </text>
        );
      })}
    </svg>
  );
}
