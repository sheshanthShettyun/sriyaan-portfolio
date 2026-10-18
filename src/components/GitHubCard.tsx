"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const GITHUB_USER = "sheshanthShettyun";
const GITHUB_URL = `https://github.com/${GITHUB_USER}`;
const AVATAR_URL = `https://github.com/${GITHUB_USER}.png`;

// Warm the avatar at bundle load. The card mounts on first open, so without
// this the first click fetches the PNG and it paints in late, after the pop.
if (typeof window !== "undefined") {
  const warm = new Image();
  warm.src = AVATAR_URL;
  // Decode too, so the bitmap is ready to paint and the first open shows the
  // avatar in the same frame as the card rather than a beat later.
  void warm.decode?.().catch(() => {});
}
const COLS = 21;
const ROWS = 5;

interface ContributionDay {
  count: number;
  level: number;
  date: string;
}

// Live data, fetched once per session. Falls back to the deterministic
// grid below when offline or the API is unreachable.
let liveCache: ContributionDay[] | null | undefined;
async function fetchLive(): Promise<ContributionDay[] | null> {
  if (liveCache !== undefined) return liveCache;
  try {
    const res = await fetch(
      `https://github-contributions-api.jogruber.de/v4/${GITHUB_USER}?y=last`,
    );
    if (!res.ok) {
      liveCache = null;
      return null;
    }
    const json = await res.json();
    const arr = json?.contributions;
    if (!Array.isArray(arr) || arr.length === 0) {
      liveCache = null;
      return null;
    }
    liveCache = arr.slice(-COLS * ROWS).map((d) => ({
      count: d.count ?? 0,
      level: Math.max(0, Math.min(4, d.level ?? 0)),
      date: d.date ?? "",
    }));
    return liveCache;
  } catch {
    liveCache = null;
    return null;
  }
}

export interface GitHubCardProps {
  open: boolean;
  onClose: () => void;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic grid (col-major, like GitHub weeks), trailing run forced
// active so the streak line always has something to say.
function buildGrid(): number[] {
  const rnd = mulberry32(20261016);
  const cells: number[] = [];
  for (let i = 0; i < COLS * ROWS; i++) {
    const r = rnd();
    cells.push(r < 0.42 ? 0 : r < 0.62 ? 1 : r < 0.78 ? 2 : r < 0.92 ? 3 : 4);
  }
  for (let i = 1; i <= 12; i++) cells[cells.length - i] = Math.max(1, cells[cells.length - i]);
  return cells;
}

export interface GitHubCardProps {
  open: boolean;
  onClose: () => void;
}

export default function GitHubCard({ open, onClose }: Readonly<GitHubCardProps>) {
  const ref = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tailRef = useRef<SVGSVGElement>(null);
  const [imgOk, setImgOk] = useState(true);
  const [avatarReady, setAvatarReady] = useState(false);
  const avatarRef = useRef<HTMLImageElement>(null);
  // Hold the card back until the avatar can paint, so the photo never lands a
  // beat after the bubble. The module-level preload makes this instant in
  // practice; the timer is only a net for a stalled request.
  const reveal = !imgOk || avatarReady;
  const [live, setLive] = useState<ContributionDay[] | null>(null);
  const fallback = useMemo(buildGrid, []);
  const cells = live ? live.map((d) => d.level) : fallback;

  useEffect(() => {
    fetchLive().then((days) => {
      if (days) setLive(days);
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setAvatarReady(false);
      return;
    }
    if (avatarRef.current?.complete) {
      setAvatarReady(true);
      return;
    }
    const t = window.setTimeout(() => setAvatarReady(true), 900);
    return () => window.clearTimeout(t);
  }, [open]);

  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);
  const leaveTimer = useRef(0);

  const beginClose = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => onClose(), 300);
  }, [onClose ]);

  useEffect(() => {
    if (open) {
      leavingRef.current = false;
      setLeaving(false);
    }
  }, [open ]);

  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Element;
      // The GH toggle owns its own open/close — don't race it.
      if (t.closest?.('[aria-label="Show GitHub contributions"]')) return;
      if (ref.current && !ref.current.contains(t)) beginClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") beginClose();
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, beginClose]);

  // Anchor: center the bubble on the GH button, clamp into the viewport,
  // and aim the tail back at the button. Runs in useLayoutEffect — before
  // first paint — so the card renders once, already placed: it simply
  // appears, never visibly adjusts. Re-runs only on resize.
  useLayoutEffect(() => {
    if (!open) return;
    const anchor = () => {
      const card = ref.current;
      const wrap = wrapRef.current;
      const tail = tailRef.current;
      if (!card || !wrap || !tail) return;
      const btn = [
        ...document.querySelectorAll('nav[aria-label="Social Links"] button'),
      ].find((b) => b.getAttribute("aria-label")?.includes("GitHub"));
      const r = card.getBoundingClientRect();
      const vw = window.innerWidth;
      let shift = 0;
      if (r.left < 16) shift = 16 - r.left;
      else if (r.right > vw - 64) shift = vw - 64 - r.right;
      wrap.style.marginLeft = `${Math.round(shift)}px`;
      if (btn) {
        const b = btn.getBoundingClientRect();
        const cardLeft = r.left + shift;
        const at = b.x + b.width / 2 - cardLeft - 32;
        const span = r.width - 92;
        tail.style.left = `${Math.round(Math.max(28, Math.min(span, at)))}px`;
      }
    };
    anchor();
    window.addEventListener("resize", anchor);
    return () => {
      window.removeEventListener("resize", anchor);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={wrapRef}
      className="pointer-events-none absolute bottom-[calc(100%+20px)] left-1/2 z-50 w-[440px] max-w-[calc(100vw-2rem)] -translate-x-1/2"
    >
      <div
        ref={ref}
        role="dialog"
        aria-label="GitHub contributions"
        className={`${reveal ? (leaving ? "gh-leave" : "gh-pop") : "opacity-0"} gh-bubble pointer-events-auto relative w-full rounded-[28px] bg-[#141414] p-6 shadow-[0_35px_80px_-15px_rgba(0,0,0,0.9)]`}
      >
      <div className="flex items-start justify-between gap-4">
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4"
        >
          {imgOk ? (
            <img
              ref={avatarRef}
              src={AVATAR_URL}
              alt="sheshanthShettyun GitHub avatar"
              width={72}
              height={72}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              onLoad={() => setAvatarReady(true)}
              onError={() => {
                setImgOk(false);
                setAvatarReady(true);
              }}
              className="h-[72px] w-[72px] shrink-0 rounded-full bg-[#1b211d] object-cover"
            />
          ) : (
            <span className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-full bg-[#1b211d] text-3xl font-extrabold text-[#F2EDE4]">
              S
            </span>
          )}
          <span>
            <span
              className="block text-[32px] font-extrabold leading-none tracking-tight text-[#F2EDE4]"
              style={{ fontFamily: '"PangeaAfrikan", system-ui, sans-serif' }}
            >
              sriyaan
            </span>
            <span
              className="mt-1 block font-mono text-[15px] text-[#85817B]"
              style={{ fontFamily: '"PangeaAfrikan", system-ui, sans-serif' }}
            >
              @{GITHUB_USER}
            </span>
          </span>
        </a>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open GitHub profile"
          className="group mt-1 shrink-0 p-1 text-[#F2EDE4] transition-all hover:text-[#C6F68D]"
        >
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          >
            <path d="M7 17L17 7M17 7H7M17 7V17" />
          </svg>
        </a>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <span className="font-mono text-[13px] uppercase tracking-[0.15em] text-[#85817B]">
          Contributions
        </span>
      </div>

      <div
        className="mt-3 grid w-full grid-flow-col grid-rows-5 justify-between gap-[4px]"
        aria-hidden="true"
      >
        {cells.map((level, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: static generated grid
            key={i}
            className="h-[14px] w-[14px] rounded-[4px]"
            style={{ backgroundColor: `var(--gh-cell-${level})` }}
          />
        ))}
      </div>

      {/* Tail — same fill as the body, overlapping it by 22px, no stroke
          anywhere, so body + tail read as one shape. Straight tapering sides
          (a triangle) meeting in a filleted 5px-radius apex, so the tip reads
          soft rather than needle-sharp. Sides are angled, not concave, so the
          junction with the body's bottom edge is a clean shoulder, not a notch. */}
      <svg
        ref={tailRef}
        aria-hidden="true"
        className="gh-tail absolute h-[40px] w-[64px]"
        viewBox="0 0 64 40"
        style={{ bottom: "-18px" }}
      >
        <path d="M3.8 0 L27.9 34.2 Q32 40 36.1 34.2 L60.2 0 Z" />
      </svg>
      </div>
    </div>
  );
}
