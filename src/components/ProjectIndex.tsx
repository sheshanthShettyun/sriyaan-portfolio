"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMode } from "@/lib/ModeContext";
import { projectIndexRows, type ProjectIndexRow } from "@/data/projectIndex";

export interface ProjectIndexProps {
  rows?: ProjectIndexRow[];
}

type PreviewState = {
  badge: string;
  color: string;
  image: string;
  meta: string;
  title: string;
};

export default function ProjectIndex({ rows = projectIndexRows }: Readonly<ProjectIndexProps>) {
  const { mode, revealed } = useMode();
  const [preview, setPreview] = useState<PreviewState>({
    badge: rows[0]?.badge ?? "",
    color: rows[0]?.color ?? "#C6F68D",
    image: rows[0]?.image ?? "",
    meta: rows[0]?.meta ?? "",
    title: rows[0]?.title ?? "",
  });
  const [previewActive, setPreviewActive] = useState(false);
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const portalRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const visible = useRef(false);
  // Which side of the cursor the preview sits on. Flipping has hysteresis:
  // the arrow sits almost exactly on the flip boundary, so without this the
  // preview teleports 475px back and forth as the mouse straddles it.
  const sideRef = useRef<1 | -1>(1);

  // Lerp physics loop for the floating preview (runs always, cheap)
  // NOTE: portal has NO CSS transition on transform — this loop owns it.
  // transform-origin is top-left so tilt pivots near the cursor.
  useEffect(() => {
    let raf = 0;
    const render = () => {
      if (visible.current && portalRef.current) {
        current.current.x += (target.current.x - current.current.x) * 0.2;
        current.current.y += (target.current.y - current.current.y) * 0.2;
        const tilt = Math.max(
          -8,
          Math.min(8, (target.current.x - current.current.x) * 0.04),
        );
        portalRef.current.style.transform = `translate3d(${current.current.x}px, ${current.current.y}px, 0px) scale(1) rotate(${tilt}deg)`;
      }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, []);

  // One smooth motion drives everything: as the wordmark travels from
  // center to top (progress 0→1), each row renders in its own quarter.
  // Driven by a persistent rAF loop writing directly to the row nodes —
  // no scroll-event → setState → re-render → CSS-transition pipeline, so
  // rows track the scroll 1:1 (~1 frame) instead of lagging ~240ms behind.
  useEffect(() => {
    let raf = 0;
    let lastY = -1;
    let lastHidden: boolean | null = null;
    const frame = () => {
      const hidden = mode !== "projects";
      if (hidden) {
        if (lastHidden !== true) {
          rowRefs.current.forEach((el) => {
            el.style.opacity = "0";
            el.style.transform = "translateY(22px)";
          });
          lastHidden = true;
        }
      } else {
        const y = window.scrollY;
        if (lastHidden !== false || y !== lastY) {
          const journey = Math.max(
            1,
            document.documentElement.scrollHeight - window.innerHeight,
          );
          const progress = Math.min(1, Math.max(0, y / journey));
          rows.forEach((_, i) => {
            const p = Math.min(
              1,
              Math.max(0, (progress - (i * 1) / rows.length) * rows.length),
            );
            const el = rowRefs.current.get(i);
            if (el) {
              el.style.opacity = String(p);
              el.style.transform = `translateY(${(1 - p) * 22}px)`;
            }
          });
          lastHidden = false;
          lastY = y;
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [mode, rows]);

  const onRowEnter = useCallback(
    (e: React.MouseEvent, row: ProjectIndexRow) => {
      if (mode !== "projects" || !revealed) return;
      visible.current = true;
      setPreview({
        badge: row.badge,
        color: row.color,
        image: row.image,
        meta: row.meta,
        title: row.title,
      });
      target.current = { x: e.clientX + 35, y: e.clientY - 140 };
      current.current = { ...target.current };
      sideRef.current = 1;
      setPreviewActive(true);
    },
    [mode, revealed],
  );

  const onRowMove = useCallback((e: React.MouseEvent) => {
    if (!visible.current) return;
    const PREVIEW_W = 420;
    const GAP = 35;
    const xRight = e.clientX + GAP;
    // Hysteresis band (~160px): flip left only when truly overflowing,
    // flip back right only once well clear of the edge.
    if (sideRef.current === 1 && xRight + PREVIEW_W > window.innerWidth) {
      sideRef.current = -1;
    } else if (
      sideRef.current === -1 &&
      xRight + PREVIEW_W < window.innerWidth - 160
    ) {
      sideRef.current = 1;
    }
    const x =
      sideRef.current === 1 ? xRight : e.clientX - (PREVIEW_W + 20);
    let y = e.clientY - 130;
    if (y < 20) y = 20;
    if (y + 270 > window.innerHeight) y = window.innerHeight - 280;
    target.current = { x, y };
  }, []);

  const onRowLeave = useCallback(() => {
    visible.current = false;
    setPreviewActive(false);
  }, []);

  return (
    <div>
      {/* Master Floating Interactive Preview Window */}
      <div
        id="floating-preview-portal"
        ref={portalRef}
        className={previewActive ? "active" : ""}
        aria-hidden
      >
        <div
          className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-cover bg-center p-6"
          id="preview-inner-canvas"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(11,11,11,0.2) 0%, rgba(11,11,11,0.85) 100%), url('${preview.image}')`,
          }}
        >
          <div className="z-10 flex items-center justify-between">
            <span
              className="rounded-full border border-white/10 bg-black/60 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest backdrop-blur-md"
              id="preview-badge"
              style={{ color: preview.color }}
            >
              {preview.badge}
            </span>
            <span className="relative flex h-2 w-2">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                style={{ backgroundColor: preview.color }}
              />
              <span
                className="relative inline-flex h-2 w-2 rounded-full"
                style={{ backgroundColor: preview.color }}
              />
            </span>
          </div>
          <div className="z-10 rounded-xl border border-white/10 bg-black/80 p-3 backdrop-blur-md">
            <div className="mb-1 font-display text-sm font-bold text-white" id="preview-headline">
              {preview.title}
            </div>
            <div className="font-mono text-[11px] text-[#85817B]" id="preview-meta">
              {preview.meta}
            </div>
          </div>
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-[#C6F68D]/15 via-transparent to-transparent"
            id="preview-glow"
          />
        </div>
      </div>

      {/* Editorial Project Index Directory */}
      <section
        aria-label="Selected Projects Directory"
        className="z-30 mx-auto mb-4 mt-0 w-full max-w-6xl border-t border-[rgba(242,237,228,0.08)] px-4 pt-4 sm:px-8"
        id="editorial-projects-section"
      >
        {/* Editorial Rows */}
        <div className="flex w-full flex-col divide-y divide-white/5">
          {rows.map((row, i) => (
            <div
              key={row.index}
              ref={(el) => {
                if (el) rowRefs.current.set(i, el);
              }}
              className="project-row group flex cursor-pointer flex-col justify-between gap-4 px-3 py-7 opacity-0 sm:px-6 sm:py-9 md:flex-row md:items-center"
              style={{
                "--row-color": row.color,
              } as React.CSSProperties}
              onMouseEnter={(e) => onRowEnter(e, row)}
              onMouseMove={onRowMove}
              onMouseLeave={onRowLeave}
            >
              <div className="flex items-baseline">
                <h3 className="row-title font-display text-2xl font-bold tracking-tight text-[#ECEBE4] sm:text-3xl md:text-4xl">
                  {row.title}
                </h3>
              </div>
              <div className="flex items-center justify-between gap-6 sm:gap-10 md:justify-end">
                <div className="flex items-center gap-2 font-mono text-xs text-[#85817B]">
                  {row.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-white/10 px-2.5 py-1 text-white/80"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <span className="font-mono text-xs text-[#85817B]">{row.year}</span>
                <div className="row-arrow" style={{ color: row.color }}>
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M7 17L17 7M17 7H7M17 7V17"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
