"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMode } from "@/lib/ModeContext";

const pills = [
  { label: "Football", className: "left-[12%] top-[30%]" },
  { label: "Playing game", className: "left-[30%] top-[22%]" },
  { label: "Building with AI", className: "left-[64%] top-[30%]" },
  { label: "Playing flute", className: "left-[28%] top-[72%]" },
  { label: "Music", className: "left-[58%] top-[74%]" },
];

const sriyaanLetters = ["s", "r", "ı", "y", "a", "a", "n"];
const projectsLetters = ["p", "r", "o", "j", "e", "c", "t", "s"];

/* Ball physics. The pill is a circle in its own layout frame (px inside the
   0.85-scaled stage); the interest pills are solid rounded rects in that same
   frame. Same rule for every brick, so any pile of pills — one in the path,
   two, a whole staircase — resolves without special cases. */
const BALL = {
  gravity: 2800,
  bounce: 0.62, // restitution, on the perch and on the pills alike
  hardHit: 110, // gentler than this and it doesn't rebound, it rests/rolls
  squashRef: 2600,
  airX: 0.35, // horizontal damping, per second
  roll: 0.45, // tangential speed kept per second while touching a brick
  restSpeed: 70, // slow + touching = settling
  restHold: 0.22, // seconds of stillness before it heads home
  restBeat: 320, // pause on the landing spot, so the eye can read it
  maxFall: 2000, // terminal fall speed, so a long drop stays legible
  homeKx: 96, // spring home: x is a touch lazier than y, so the path curves
  homeKy: 132,
  homeSettle: 0.6, // px from the i, and speed, at which the trip is done
  homeStop: 8,
  pillRadius: 8, // the pills' corner radius, in their own px
};

interface Collider {
  l: number;
  t: number;
  r: number;
  b: number;
  rad: number;
}

/* Circle vs rounded rect: lift the ball out along the contact normal, then
   reflect the normal part of its velocity and scrub a little off the
   tangential part. Hard hits rebound (with squash); soft ones just roll. */
function collideDot(
  s: { x: number; y: number; vx: number; vy: number; sq: number },
  radius: number,
  colliders: Collider[],
  dt: number,
): boolean {
  const nxs: number[] = [];
  const nys: number[] = [];
  const pushes: number[] = [];
  for (const c of colliders) {
    // Closest point on the pill's *inner* rect (the rect a rounded corner of
    // radius rad is swept around). Contact is at rad + radius from it.
    const px = Math.min(Math.max(s.x, c.l + c.rad), c.r - c.rad);
    const py = Math.min(Math.max(s.y, c.t + c.rad), c.b - c.rad);
    const dx = s.x - px;
    const dy = s.y - py;
    const d = Math.hypot(dx, dy);
    const hit = radius + c.rad;
    if (d > 0.001) {
      if (d >= hit) continue;
      nxs.push(dx / d);
      nys.push(dy / d);
      pushes.push(hit - d);
    } else {
      // Dead centre — a fast pass-through, or a pill parked on the ball.
      // Leave through the nearest *straight* face (the centre is inside the
      // inner rect, so that face is always straight) and land tangent to it.
      const exits = [
        { push: s.x - (c.l - radius), nx: -1, ny: 0 },
        { push: c.r + radius - s.x, nx: 1, ny: 0 },
        { push: s.y - (c.t - radius), nx: 0, ny: -1 },
        { push: c.b + radius - s.y, nx: 0, ny: 1 },
      ].sort((a, b) => a.push - b.push)[0];
      if (exits.push <= 0) continue;
      nxs.push(exits.nx);
      nys.push(exits.ny);
      pushes.push(exits.push);
    }
  }
  if (!nxs.length) return false;
  // Every contact pushes the ball out, but the bounce is resolved once, along
  // the summed normal — wedged between two pills the sideways parts cancel and
  // it squirts straight up instead of picking one pill and taking a free kick.
  let sx = 0;
  let sy = 0;
  let deep = 0;
  let deepX = 0;
  let deepY = 0;
  for (let i = 0; i < nxs.length; i++) {
    const off = pushes[i];
    s.x += nxs[i] * off;
    s.y += nys[i] * off;
    sx += nxs[i] * off;
    sy += nys[i] * off;
    if (off > deep) {
      deep = off;
      deepX = nxs[i];
      deepY = nys[i];
    }
  }
  const m = Math.hypot(sx, sy);
  const nx = m > 0.001 ? sx / m : deepX;
  const ny = m > 0.001 ? sy / m : deepY;
  const vn = s.vx * nx + s.vy * ny; // negative while driving into the brick
  if (vn >= 0) return true;
  const impact = -vn;
  const e = impact > BALL.hardHit ? BALL.bounce : 0;
  const keep = Math.pow(BALL.roll, dt);
  s.vx = (s.vx - vn * nx) * keep - e * vn * nx;
  s.vy = (s.vy - vn * ny) * keep - e * vn * ny;
  if (e) s.sq = Math.min(1, impact / BALL.squashRef);
  return true;
}

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
  const lastPointer = useRef({ x: 0, y: 0 });

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
      lastPointer.current = { x: e.clientX, y: e.clientY };
      setDragLabel(label);
    },
    [offsets],
  );

  const onPillPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const x = drag.origX + e.clientX - drag.startX;
    const y = drag.origY + e.clientY - drag.startY;
    lastPointer.current = { x: e.clientX, y: e.clientY };
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
        detail: { ...lastPointer.current, active: false },
      }),
    );
  }, []);

  /* opencode badge: fixed offset from the wordmark's right edge, in
     stage-relative layout px (the stage is scaled 0.85, so the rendered
     shift is 0.85x). Locked to the position picked during design review. */
  const BADGE_OFFSET = { x: -176, y: 11 };

  /* Seesaw badge: drag it sideways to tip around its base — rotation only, it
     never leaves its fixed spot above the N, and it springs back upright on
     release. Writes straight to the node so dragging stays frame-tight.
     The constant 11deg tilt lives on #accent-badge, so this reads 0 at rest. */
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
    el.style.transition = "transform 0.65s cubic-bezier(0.34, 1.56, 0.64, 1)";
    el.style.transform = "rotate(0deg)";
    badgeAngle.current = 0;
  }, []);

  /* Bouncy pink dot: drag it up and let go — it falls, caroms off any pill
     that's in the way, rolls off the edge and keeps going, then once it comes
     to rest it springs back onto the i. Physics drives the independent
     `translate`/`scale` properties on the outer dot, so it never fights the
     hero-accent show/hide transitions. */
  const dotRef = useRef<HTMLSpanElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const pillRefs = useRef<Record<string, HTMLDivElement | null>>({});
  /* The ball's frame of reference: its own resting spot on the i, in layout
     px (the stage is scaled, so 1 visual px is 1/k layout px). */
  const frameRef = useRef({ x: 0, y: 0, r: 32, k: 1, perchHalf: 33 });
  const colliderRef = useRef<Collider[]>([]);
  const homeTimer = useRef(0);
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
      window.clearTimeout(homeTimer.current);
    };
  }, []);
  const renderDot = useCallback(() => {
    const el = dotRef.current;
    const s = bounceRef.current;
    if (!el) return;
    el.style.translate = `calc(-50% + ${s.x}px) ${s.y}px`;
    el.style.scale = `${1 + 0.3 * s.sq} ${1 - 0.35 * s.sq}`;
  }, []);

  /* Read the ball's true perch: where it sits on the i, how big it is, how the
     stage is scaled. Everything the physics touches is expressed in the ball's
     own layout px, so there is only ever one unit in play. */
  const measureFrame = useCallback(() => {
    const el = dotRef.current;
    const span = el?.parentElement;
    const stage = document.getElementById("wordmark-stage");
    if (!el || !span || !stage) return;
    const translate = el.style.translate;
    const scale = el.style.scale;
    el.style.translate = "calc(-50% + 0px) 0px";
    el.style.scale = "1 1";
    const rect = el.getBoundingClientRect();
    const spanRect = span.getBoundingClientRect();
    const k = parseFloat(getComputedStyle(stage).scale) || 1;
    frameRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      r: rect.height / k / 2,
      k,
      perchHalf: spanRect.width / k / 2,
    };
    el.style.translate = translate;
    el.style.scale = scale;
  }, []);

  /* Each pill becomes a brick: its rect, converted into the ball's frame,
     relative to the perch. One rule for every pill, so any arrangement of
     them resolves without special cases. */
  const buildColliders = useCallback(() => {
    const f = frameRef.current;
    const out: Collider[] = [];
    for (const pill of pills) {
      const el = pillRefs.current[pill.label];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      out.push({
        l: (rect.left - f.x) / f.k,
        t: (rect.top - f.y) / f.k,
        r: (rect.right - f.x) / f.k,
        b: (rect.bottom - f.y) / f.k,
        rad: BALL.pillRadius / f.k,
      });
    }
    colliderRef.current = out;
  }, []);

  /* Sit where it landed for a beat, then glide back onto the i on a damped
     spring: both axes ease in and settle, never overshoot, and the lazier x
     gives the path its curve instead of a ruler line. Colliders are ignored
     on the way home, so the ball always makes it back. */
  const sendHome = useCallback(() => {
    const s = bounceRef.current;
    const el = dotRef.current;
    if (s.raf) cancelAnimationFrame(s.raf);
    s.raf = 0;
    s.dragging = false;
    window.clearTimeout(homeTimer.current);
    homeTimer.current = window.setTimeout(() => {
      if (!el) return;
      let last = performance.now();
      const stepHome = (t: number) => {
        const dt = Math.min(0.033, (t - last) / 1000);
        last = t;
        s.vx += (-BALL.homeKx * s.x - 2 * Math.sqrt(BALL.homeKx) * s.vx) * dt;
        s.vy += (-BALL.homeKy * s.y - 2 * Math.sqrt(BALL.homeKy) * s.vy) * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.sq *= Math.pow(0.002, dt);
        renderDot();
        if (Math.hypot(s.x, s.y) < BALL.homeSettle && Math.hypot(s.vx, s.vy) < BALL.homeStop) {
          s.x = 0;
          s.y = 0;
          s.vx = 0;
          s.vy = 0;
          s.sq = 0;
          renderDot();
          el.style.transition = "";
          return;
        }
        s.raf = requestAnimationFrame(stepHome);
      };
      s.raf = requestAnimationFrame(stepHome);
    }, BALL.restBeat);
  }, [renderDot]);

  const onDotDown = useCallback(
    (e: React.PointerEvent<HTMLSpanElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      const s = bounceRef.current;
      const el = dotRef.current;
      if (s.raf) cancelAnimationFrame(s.raf);
      s.raf = 0;
      window.clearTimeout(homeTimer.current);
      if (el) el.style.transition = "none";
      measureFrame();
      buildColliders();
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
    [renderDot, measureFrame, buildColliders],
  );
  const onDotMove = useCallback(
    (e: React.PointerEvent<HTMLSpanElement>) => {
      const s = bounceRef.current;
      if (!s.dragging) return;
      const k = frameRef.current.k;
      const now = performance.now();
      const dt = Math.max(1, now - s.lastT) / 1000;
      // Pointer velocity (ball px/s), smoothed — upward flicks bounce higher.
      s.vx = s.vx * 0.7 + ((e.clientX - s.lx) / dt / k) * 0.3;
      s.vy = s.vy * 0.7 + ((e.clientY - s.ly) / dt / k) * 0.3;
      s.lx = e.clientX;
      s.ly = e.clientY;
      s.lastT = now;
      s.x = Math.max(-160, Math.min(160, s.bx + (e.clientX - s.px) / k));
      s.y = Math.min(40, s.by + (e.clientY - s.py) / k);
      // Pills are solid while dragging too — the ball can't be parked inside.
      collideDot(s, frameRef.current.r, colliderRef.current, 1 / 60);
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
    measureFrame();
    buildColliders();
    const f = frameRef.current;
    const hero = sectionRef.current?.getBoundingClientRect();
    // Screen edges, one wrap apart: off the right comes back on the left, off
    // the bottom comes back in above the top. Both jumps sit beyond the hero's
    // own box, so the ball never visibly snaps across.
    const wallL = hero ? (hero.left - f.x) / f.k : -600;
    const wallR = hero ? (hero.right - f.x) / f.k : 600;
    const topLimit = hero ? (hero.top - f.y) / f.k - 200 : -900;
    const fallLimit = hero ? (hero.bottom - f.y) / f.k + 200 : 900;
    const spanX = wallR - wallL;
    let returningHome = false;
    let still = 0;
    let last = performance.now();
    const stepOnce = (dt: number) => {
      s.vy += BALL.gravity * dt;
      if (s.vy > BALL.maxFall) s.vy = BALL.maxFall;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= Math.pow(BALL.airX, dt);
      s.sq *= Math.pow(0.002, dt);
      let touching = returningHome ? false : collideDot(s, f.r, colliderRef.current, dt);
      // The i is still a shelf: land on it, or bounce off a hard hit.
      if (s.y >= 0 && Math.abs(s.x) <= f.perchHalf) {
        s.y = 0;
        const impact = Math.abs(s.vy);
        if (impact > BALL.hardHit) {
          s.vy = -s.vy * BALL.bounce;
          s.sq = Math.min(1, impact / BALL.squashRef);
        } else {
          s.vy = 0;
        }
        touching = true;
      }
      if (s.x > wallR) s.x -= spanX;
      else if (s.x < wallL) s.x += spanX;
      if (s.y > fallLimit) {
        if (!returningHome) {
          returningHome = true;
          s.x = 0;
          s.vx = 0;
          s.y = topLimit;
          s.vy = 0;
        } else {
          s.x = 0;
          s.y = 0;
          s.vx = 0;
          s.vy = 0;
          sendHome();
          return true;
        }
      }
      return touching;
    };
    const step = (t: number) => {
      const dt = Math.min(0.033, (t - last) / 1000);
      last = t;
      // Sub-step, so a fast fall can't step clean over a 38px-tall brick.
      const travel = Math.hypot(s.vx, s.vy) * dt;
      const subs = Math.min(12, Math.max(1, Math.ceil(travel / 6)));
      let touching = false;
      for (let i = 0; i < subs; i++) {
        if (stepOnce(dt / subs)) touching = true;
      }
      const speed = Math.hypot(s.vx, s.vy);
      still = touching && speed < BALL.restSpeed ? still + dt : 0;
      renderDot();
      // Only coming to rest sends it home now; off an edge it just wraps.
      if (still > BALL.restHold) {
        sendHome();
        return;
      }
      s.raf = requestAnimationFrame(step);
    };
    s.raf = requestAnimationFrame(step);
  }, [renderDot, measureFrame, buildColliders, sendHome]);

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
      ref={sectionRef}
      className={`relative flex w-full flex-1 select-none flex-col items-center justify-center overflow-visible px-4 py-6 ${className}`}
      data-purpose="portfolio-hero"
    >
      {/* Center Wordmark Stage */}
      <div
        className="relative my-auto flex w-full max-w-7xl origin-center scale-[0.85] items-center justify-center"
        id="wordmark-stage"
      >
        {/* Playful Asterisk Star -> Claude Mark */}
        <div
          className="home-vanish pointer-events-none absolute -top-10 left-[5%] z-20 -rotate-12 duration-500 hover:rotate-45 md:-top-16 md:left-[10%] lg:left-[14%]"
          id="accent-star"
        >
          <svg
            className="h-14 w-14 drop-shadow-md md:h-24 md:w-24"
            fill="#D97757"
            viewBox="0 0 100 100"
            aria-hidden="true"
          >
            <path d="m19.6 66.5 19.7-11 .3-1-.3-.5h-1l-3.3-.2-11.2-.3L14 53l-9.5-.5-2.4-.5L0 49l.2-1.5 2-1.3 2.9.2 6.3.5 9.5.6 6.9.4L38 49.1h1.6l.2-.7-.5-.4-.4-.4L29 41l-10.6-7-5.6-4.1-3-2-1.5-2-.6-4.2 2.7-3 3.7.3.9.2 3.7 2.9 8 6.1L37 36l1.5 1.2.6-.4.1-.3-.7-1.1L33 25l-6-10.4-2.7-4.3-.7-2.6c-.3-1-.4-2-.4-3l3-4.2L28 0l4.2.6L33.8 2l2.6 6 4.1 9.3L47 29.9l2 3.8 1 3.4.3 1h.7v-.5l.5-7.2 1-8.7 1-11.2.3-3.2 1.6-3.8 3-2L61 2.6l2 2.9-.3 1.8-1.1 7.7L59 27.1l-1.5 8.2h.9l1-1.1 4.1-5.4 6.9-8.6 3-3.5L77 13l2.3-1.8h4.3l3.1 4.7-1.4 4.9-4.4 5.6-3.7 4.7-5.3 7.1-3.2 5.7.3.4h.7l12-2.6 6.4-1.1 7.6-1.3 3.5 1.6.4 1.6-1.4 3.4-8.2 2-9.6 2-14.3 3.3-.2.1.2.3 6.4.6 2.8.2h6.8l12.6 1 3.3 2 1.9 2.7-.3 2-5.1 2.6-6.8-1.6-16-3.8-5.4-1.3h-.8v.4l4.6 4.5 8.3 7.5L89 80.1l.5 2.4-1.3 2-1.4-.2-9.2-7-3.6-3-8-6.8h-.5v.7l1.8 2.7 9.8 14.7.5 4.5-.7 1.4-2.6 1-2.7-.6-5.8-8-6-9-4.7-8.2-.5.4-2.9 30.2-1.3 1.5-3 1.2-2.5-2-1.4-3 1.4-6.2 1.6-8 1.3-6.4 1.2-7.9.7-2.6v-.2H49L43 72l-9 12.3-7.2 7.6-1.7.7-3-1.5.3-2.8L24 86l10-12.8 6-7.9 4-4.6-.1-.5h-.3L17.2 77.4l-4.7.6-2-2 .2-3 1-1 8-5.5Z" />
          </svg>
        </div>
        {/* Wordmark + neon status pill, anchored to the wordmark's right edge */}
        <div className="pointer-events-none relative">
        {/* Neon pill — fixed offset from the wordmark's right edge; holds an
            11deg tilt and rolls away on the design's spring curve */}
        <div
          className="absolute left-full top-8 z-20 md:top-10"
          style={{
            transform: `translate3d(${BADGE_OFFSET.x}px, ${BADGE_OFFSET.y}px, 0)`,
          }}
        >
          <div className="pointer-events-none" id="accent-badge">
            <div
              ref={badgeRef}
              onPointerDown={onBadgeDown}
              onPointerMove={onBadgeMove}
              onPointerUp={onBadgeUp}
              onPointerCancel={onBadgeUp}
              className="pointer-events-auto origin-bottom cursor-grab touch-none select-none whitespace-nowrap rounded-full border border-black/10 bg-[#C6F68D] px-8 py-2.5 text-sm font-semibold tracking-tight text-[#0B0B0B] shadow-lg active:cursor-grabbing md:px-12 md:py-3.5 md:text-xl"
            >
              Building with LLMs
            </div>
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
                  className="hero-accent absolute bottom-[76%] z-20 h-10 w-10 -translate-x-1/2 cursor-grab touch-none select-none rounded-full bg-[#FFAAA6] shadow-md active:cursor-grabbing md:h-16 md:w-16"
                />
              )}
            </span>
          ))}
        </h1>
        </div>
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
            ref={(el) => {
              pillRefs.current[pill.label] = el;
            }}
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
