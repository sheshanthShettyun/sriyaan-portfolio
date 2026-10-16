"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMode } from "@/lib/ModeContext";

const pills = [
  { label: "Football", className: "left-[12%] top-[30%]" },
  { label: "Playing game", className: "left-[30%] top-[22%]" },
  { label: "Technology", className: "left-[64%] top-[30%]" },
  { label: "Collection", className: "left-[28%] top-[72%]" },
  { label: "Music", className: "left-[58%] top-[74%]" },
];

const sriyaanLetters = ["s", "r", "ı", "y", "a", "a", "n"];
const projectsLetters = ["p", "r", "o", "j", "e", "c", "t", "s"];

export interface HeroProps {
  className?: string;
}

export default function Hero({ className = "" }: Readonly<HeroProps>) {
  const { setRevealed } = useMode();  const [offsets, setOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const [dragLabel, setDragLabel] = useState<string | null>(null);
  const dragRef = useRef<{
    label: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const onPillPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, label: string) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      const orig = offsets[label] ?? { x: 0, y: 0 };
      dragRef.current = {
        label,
        startX: e.clientX,
        startY: e.clientY,
        origX: orig.x,
        origY: orig.y,
      };
      setDragLabel(label);
    },
    [offsets],
  );

  const onPillPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const x = drag.origX + e.clientX - drag.startX;
    const y = drag.origY + e.clientY - drag.startY;
    setOffsets((prev) => ({ ...prev, [drag.label]: { x, y } }));
    // Repel field: the open About bio flees the dragged pill, per character.
    window.dispatchEvent(
      new CustomEvent("about:repel", {
        detail: { x: e.clientX, y: e.clientY, active: true },
      }),
    );
  }, []);

  const onPillPointerUp = useCallback(() => {
    dragRef.current = null;
    setDragLabel(null);
    window.dispatchEvent(
      new CustomEvent("about:repel", {
        detail: { x: 0, y: 0, active: false },
      }),
    );
  }, []);

  /* Seesaw "Orchestrator" badge: drag either end to tilt it around its base
     (rotation only — it never leaves its spot above the N). Springs back. */
  const badgeRef = useRef<HTMLDivElement>(null);
  const badgeAngle = useRef(0);
  const seesawRef = useRef<{ startX: number; startAngle: number } | null>(null);
  const onBadgeDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const el = badgeRef.current;
    if (el) el.style.transition = "none";
    seesawRef.current = { startX: e.clientX, startAngle: badgeAngle.current };
  }, []);
  const onBadgeMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = seesawRef.current;
    const el = badgeRef.current;
    if (!drag || !el) return;
    const angle = Math.max(
      -28,
      Math.min(28, drag.startAngle + (e.clientX - drag.startX) * 0.3),
    );
    badgeAngle.current = angle;
    el.style.transform = `rotate(${angle}deg)`;
  }, []);
  const onBadgeUp = useCallback(() => {
    seesawRef.current = null;
    const el = badgeRef.current;
    if (!el) return;
    el.style.transition =
      "transform 0.65s cubic-bezier(0.34, 1.56, 0.64, 1)";
    el.style.transform = "rotate(0deg)";
    badgeAngle.current = 0;
  }, []);

  /* Bouncy pink dot: drag it upward and let go — gravity drops it back
     onto its perch (the eye) and it bounces, higher when thrown harder.
     Physics drives the independent `translate`/`scale` properties on the
     outer dot, so it never fights the hero-accent show/hide transitions. */
  const dotRef = useRef<HTMLSpanElement>(null);
  const bounceRef = useRef({
    raf: 0,
    dragging: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    px: 0,
    py: 0,
    bx: 0,
    by: 0,
    lx: 0,
    ly: 0,
    lastT: 0,
    sq: 0,
  });
  useEffect(() => {
    const s = bounceRef.current;
    return () => {
      if (s.raf) cancelAnimationFrame(s.raf);
    };
  }, []);
  const renderDot = useCallback(() => {
    const el = dotRef.current;
    const s = bounceRef.current;
    if (!el) return;
    el.style.translate = `calc(-50% + ${s.x}px) ${s.y}px`;
    el.style.scale = `${1 + 0.3 * s.sq} ${1 - 0.35 * s.sq}`;
  }, []);
  const onDotDown = useCallback(
    (e: React.PointerEvent<HTMLSpanElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      const s = bounceRef.current;
      const el = dotRef.current;
      if (s.raf) cancelAnimationFrame(s.raf);
      s.raf = 0;
      if (el) el.style.transition = "none";
      s.dragging = true;
      s.px = e.clientX;
      s.py = e.clientY;
      s.lx = e.clientX;
      s.ly = e.clientY;
      s.bx = s.x;
      s.by = s.y;
      s.vx = 0;
      s.vy = 0;
      s.sq = 0;
      s.lastT = performance.now();
      renderDot();
    },
    [renderDot],
  );
  const onDotMove = useCallback(
    (e: React.PointerEvent<HTMLSpanElement>) => {
      const s = bounceRef.current;
      if (!s.dragging) return;
      const now = performance.now();
      const dt = Math.max(1, now - s.lastT) / 1000;
      // Pointer velocity (px/s), smoothed — upward flicks bounce higher.
      s.vx = s.vx * 0.7 + ((e.clientX - s.lx) / dt) * 0.3;
      s.vy = s.vy * 0.7 + ((e.clientY - s.ly) / dt) * 0.3;
      s.lx = e.clientX;
      s.ly = e.clientY;
      s.lastT = now;
      s.x = Math.max(-160, Math.min(160, s.bx + e.clientX - s.px));
      s.y = Math.min(40, s.by + e.clientY - s.py);
      renderDot();
    },
    [renderDot],
  );
  const onDotUp = useCallback(() => {
    const s = bounceRef.current;
    const el = dotRef.current;
    s.dragging = false;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      s.x = 0;
      s.y = 0;
      s.vx = 0;
      s.vy = 0;
      s.sq = 0;
      renderDot();
      el.style.transition = "";
      return;
    }
    let last = performance.now();
    const step = (t: number) => {
      const dt = Math.min(0.033, (t - last) / 1000);
      last = t;
      s.vy += 2800 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= Math.pow(0.15, dt);
      s.x += (0 - s.x) * Math.min(1, dt * 4);
      s.sq *= Math.pow(0.002, dt);
      if (s.y >= 0) {
        s.y = 0;
        const impact = Math.abs(s.vy);
        if (impact > 110) {
          s.vy = -s.vy * 0.62;
          s.sq = Math.min(1, impact / 2600);
        } else {
          s.x = 0;
          s.y = 0;
          s.vx = 0;
          s.vy = 0;
          s.sq = 0;
          renderDot();
          el.style.transition = "";
          s.raf = 0;
          return;
        }
      }
      renderDot();
      s.raf = requestAnimationFrame(step);
    };
    s.raf = requestAnimationFrame(step);
  }, [renderDot]);

  const revealList = useCallback(() => {
    setRevealed(true);
    window.setTimeout(() => {
      document
        .getElementById("editorial-projects-section")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }, [setRevealed]);

  return (
    <section
      className={`relative flex w-full flex-1 select-none flex-col items-center justify-center overflow-visible px-4 py-6 ${className}`}
      data-purpose="portfolio-hero"
    >
      {/* Center Wordmark Stage */}
      <div
        className="relative my-auto flex w-full max-w-7xl origin-center scale-[0.85] items-center justify-center"
        id="wordmark-stage"
      >
        {/* Playful Asterisk Star (Green Accent) */}
        <div
          className="home-vanish pointer-events-none absolute -top-10 left-[5%] z-20 -rotate-12 duration-500 hover:rotate-45 md:-top-16 md:left-[10%] lg:left-[14%]"
          id="accent-star"
        >
          <svg
            className="h-14 w-14 text-[#C6F68D] drop-shadow-md md:h-24 md:w-24"
            fill="currentColor"
            viewBox="0 0 100 100"
          >
            <path d="M50 0 C54 0 57 20 57 32 C66 23 83 9 86 13 C90 18 78 37 70 45 C82 46 100 50 100 55 C100 60 82 62 70 63 C78 72 90 90 85 94 C81 97 65 83 57 74 C57 86 54 100 49 100 C45 100 42 86 42 74 C34 83 18 97 14 94 C9 90 22 72 30 63 C18 62 0 60 0 55 C0 50 18 46 30 45 C22 37 9 18 14 13 C18 9 34 23 42 32 C42 20 46 0 50 0 Z" />
          </svg>
        </div>
        {/* Floating "Orchestrator" Pill Badge — seesaw: drag ends to tilt */}
        <div
          className="home-vanish absolute right-[4%] top-8 z-20 rotate-[11deg] md:right-[7%] md:top-10 lg:right-[9%]"
          id="accent-badge"
        >
          <div
            ref={badgeRef}
            onPointerDown={onBadgeDown}
            onPointerMove={onBadgeMove}
            onPointerUp={onBadgeUp}
            onPointerCancel={onBadgeUp}
            className="origin-bottom cursor-grab touch-none select-none rounded-full border border-black/10 bg-[#C6F68D] px-8 py-2.5 text-sm font-semibold tracking-tight text-[#0B0B0B] shadow-lg active:cursor-grabbing md:px-12 md:py-3.5 md:text-xl"
          >
            Orchestrator
          </div>
        </div>
        {/* Sriyaan wordmark — letters scatter out in projects mode */}
        <h1
          aria-label="sriyaan"
          className="hero-wordmark relative z-10 whitespace-nowrap text-center font-extrabold tracking-tighter transition-all duration-300 hover:tracking-normal"
          id="hero-wordmark"
        >
          {sriyaanLetters.map((ch, i) => (
            <span key={`s-${i}`} className={`letter-span letter-sriyaan-${i + 1}`}>
              {ch}
              {i === 3 && (
                <div
                  className="home-vanish pointer-events-none absolute -z-10"
                  id="accent-music"
                  style={{ left: "-8%", bottom: "6%" }}
                >
                  <span
                    aria-hidden="true"
                    className="block rotate-[14deg] scale-y-[1.35] select-none text-[8rem] leading-none md:text-[13rem]"
                    style={{
                      color: "#C6F68D",
                      textShadow:
                        "5px 5px 0 #5C7A3C, 8px 12px 24px rgba(0, 0, 0, 0.45)",
                    }}
                  >
                    ♪
                  </span>
                </div>
              )}
              {i === 2 && (
                <span
                  id="accent-dot"
                  ref={dotRef}
                  onPointerDown={onDotDown}
                  onPointerMove={onDotMove}
                  onPointerUp={onDotUp}
                  onPointerCancel={onDotUp}
                  role="img"
                  aria-label="Bouncy pink ball — drag upward and let go"
                  className="hero-accent absolute bottom-[76%] left-1/2 z-20 h-10 w-10 -translate-x-1/2 cursor-grab touch-none select-none rounded-full bg-[#FFAAA6] shadow-md active:cursor-grabbing md:h-16 md:w-16"
                />
              )}
            </span>
          ))}
        </h1>
        {/* Projects wordmark overlay — slams in during projects mode */}
        <div
          className="absolute inset-0 z-10 flex items-center justify-center"
          id="projects-wordmark-container"
        >
          <h2 className="hero-wordmark m-0 whitespace-nowrap text-center font-extrabold leading-none tracking-tighter">
            {projectsLetters.map((ch, i) => (
              <span key={`p-${i}`} className={`letter-proj letter-proj-${i + 1}`}>
                {ch}
              </span>
            ))}
          </h2>
        </div>
      </div>

      {/* Static interest pills — breathing in place, draggable anywhere by mouse */}
      {pills.map((pill, index) => {
        const offset = offsets[pill.label] ?? { x: 0, y: 0 };
        return (
          <div
            key={pill.label}
            className={`home-vanish absolute z-20 touch-none select-none ${pill.className} ${
              dragLabel === pill.label ? "cursor-grabbing" : "cursor-grab"
            }`}
            data-purpose="interest-tags"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px)`,
            }}
            onPointerDown={(e) => onPillPointerDown(e, pill.label)}
            onPointerMove={onPillPointerMove}
            onPointerUp={onPillPointerUp}
            onPointerCancel={onPillPointerUp}
          >
            <div
              className="flex h-9 items-center rounded-[8px] border border-dashed border-[#6E6B67] bg-[#D4D1CB] px-4 text-[17px] font-normal leading-none tracking-[-0.02em] text-[#302C27] transition-colors duration-300 hover:bg-[#E2DFDA]"
              style={{ fontFamily: '"PangeaAfrikan", system-ui, sans-serif' }}
            >
              {pill.label}
            </div>
          </div>
        );
      })}
    </section>
  );
}
