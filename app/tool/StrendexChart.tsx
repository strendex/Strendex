"use client";

// The performance signature radar.
//
// Hand-drawn SVG on a FIXED viewBox rather than a pixel-laid-out chart
// library. A library lays the chart out in device pixels and draws the axis
// labels at a fixed font size, so on a narrow phone the polygon shrinks while
// the words do not. Here every coordinate, including the type, lives in
// viewBox units, so the whole drawing scales as one and containment is
// structural: there is no width, and no zoom level, at which a label can
// outgrow the space reserved for it.
//
// Geometry, in one place so it stays honest:
//   · The grid is a true diamond — one radius R shared by all four axes, so
//     the horizontal and vertical radii are equal by construction.
//   · The centre sits at exactly (VIEW_W / 2, VIEW_H / 2). The gutters are
//     symmetric and sized for the WIDEST label ("Endurance"), which means the
//     shorter labels simply get more air rather than pulling the diamond
//     off-centre.
//   · Labels live entirely outside R. The data polygon lives entirely inside
//     R. They cannot overlap.

import { useId } from "react";

interface ChartProps {
  data: { subject: string; value: number }[];
}

// ---- viewBox geometry -------------------------------------------------
const R = 62; // grid radius: the same for every axis, so the grid is a true diamond
const LABEL_GAP = 10; // clear space between the outer ring and a label
const FONT_SIZE = 12;
const EDGE = 6; // breathing room between the longest label and the viewBox edge

// "Endurance" is the widest label. 0.62em per character is a deliberate
// over-estimate — Inter SemiBold sits nearer 0.55em — so the reserved gutter
// still holds if the fallback font stack is what actually renders.
const WIDEST_LABEL_W = 9 * 0.62 * FONT_SIZE;

// Conservative text-box metrics, used both to place labels and to size the
// gutters that hold them.
const ASCENDER = FONT_SIZE;
const DESCENDER = FONT_SIZE * 0.26;

// Every gutter is LABEL_GAP clear of the outer ring plus room for the label
// box itself, so the spacing reads identical on all four axes.
const VIEW_W = Math.round(2 * (R + LABEL_GAP + WIDEST_LABEL_W + EDGE));
const VIEW_H = Math.round(2 * (R + LABEL_GAP + ASCENDER + DESCENDER + EDGE));
const CX = VIEW_W / 2;
const CY = VIEW_H / 2;

const RINGS = [0.25, 0.5, 0.75, 1];

// Brand palette only. The accent lime is reserved for the primary CTA and the
// score number, so the plot is drawn in primary ink over a hairline grid.
const GRID = "rgba(255,255,255,0.09)";
const GRID_OUTER = "rgba(255,255,255,0.18)";
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

/**
 * `radiusOf` returns a RADIUS in viewBox units, never a 0–100 score. Scores
 * have to be scaled by R / 100 before they get here, or the shape is drawn
 * outside its own grid.
 */
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
  const scoreOf = (index: number) =>
    Math.max(0, Math.min(100, data[index].value));

  /** A score of 100 reaches the outer ring; 0 sits at the centre. */
  const radiusOf = (index: number) => (scoreOf(index) / 100) * R;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid meet"
      className="mx-auto block h-auto w-full max-w-[340px]"
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

      {/* The athlete's shape: one closed polygon through all four values, in
          axis order. It is irregular whenever the four scores differ — that
          asymmetry IS the signature and is never evened out. */}
      <polygon
        points={polygonFor(count, radiusOf)}
        fill={PLOT}
        fillOpacity={0.13}
        stroke={PLOT}
        strokeOpacity={0.92}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />

      {/* Vertices sit ON the polygon to anchor each value to its axis. */}
      {Array.from({ length: count }, (_, i) => {
        const p = pointAt(i, count, radiusOf(i));
        return (
          <circle
            key={`dot-${i}`}
            cx={n(p.x)}
            cy={n(p.y)}
            r={2.6}
            fill={PLOT}
          />
        );
      })}

      {/* Axis labels, in their reserved gutters outside the outer ring. Every
          axis keeps its full name — the gutters are what make that safe. */}
      {data.map((entry, i) => {
        const p = pointAt(i, count, R);
        const anchor = p.dx > 0.3 ? "start" : p.dx < -0.3 ? "end" : "middle";

        // Measured from the label's own box, not its baseline, so the top and
        // bottom labels clear the ring by exactly the same LABEL_GAP as the
        // side ones instead of sitting visibly closer.
        const y =
          p.dy < -0.3
            ? p.y - LABEL_GAP - DESCENDER // label box bottom sits GAP above the ring
            : p.dy > 0.3
              ? p.y + LABEL_GAP + ASCENDER // label box top sits GAP below the ring
              : p.y + FONT_SIZE * 0.36; // optically centred on the axis

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
