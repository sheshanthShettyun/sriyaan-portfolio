"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";
import SpotifyPill from "./SpotifyPill";
import GitHubCard from "./GitHubCard";
import ExperienceBook from "./ExperienceBook";
import { ModeProvider, useMode } from "@/lib/ModeContext";

/* quangdinh.im char-dissolve: .js-anim-chars .char opacity 0,
   duration .4, ease power3.out, stagger { amount: .25, from: random } */
const QD_EASE = "cubic-bezier(0.215, 0.61, 0.355, 1)";
const QD_DURATION = 400;
const QD_STAGGER = 250;

function QdSplit({ text }: Readonly<{ text: string }>) {
  return (
    <span className="qd-split" aria-label={text}>
      {text.split("").map((ch, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: static header copy, order never changes
          key={i}
          className="qd-char"
          aria-hidden="true"
        >
          {ch === " " ? " " : ch}
        </span>
      ))}
    </span>
  );
}

function qdHeaderChars(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll(
      'header[data-purpose="site-header"] .qd-char',
    ),
  ) as HTMLElement[];
}

function qdFadeChars(direction: "out" | "in"): Promise<void> {
  if (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    typeof document === "undefined"
  ) {
    return Promise.resolve();
  }
  const chars = qdHeaderChars();
  if (chars.length === 0) return Promise.resolve();
  const animations = chars.map((el) =>
    el.animate(
      direction === "out"
        ? [{ opacity: "1" }, { opacity: "0" }]
        : [{ opacity: "0" }, { opacity: "1" }],
      {
        duration: QD_DURATION,
        delay: Math.random() * QD_STAGGER,
        easing: QD_EASE,
        fill: "forwards",
      },
    ).finished.catch(() => undefined),
  );
  return Promise.all(animations).then(() => undefined);
}

const companies = [
  "Agentic Workflows",
  "RAG Pipelines",
  "LLM Infrastructure",
  "ML Systems",
];

const navItems = [
  { label: "Home", href: "/", key: "home" },
  { label: "Projects", href: "/projects", key: "projects" },
];

const socials = [{ label: "LINKEDIN", href: "#linkedin", active: true }];

export interface FrameProps {
  children: React.ReactNode;
}

function FrameChrome({ children }: Readonly<FrameProps>) {
  const pathname = usePathname();
  const router = useRouter();
  const { mode, revealed, setMode, setRevealed } = useMode();
  const onHome = pathname === "/";

  // About Me floats in on click; a dragged pill repels the open bio text.
  const [aboutOpen, setAboutOpen] = useState(false);
  const aboutPanelRef = useRef<HTMLDivElement>(null);

  // Same dissolve the header chars use on Home → Projects: 0.4s, random
  // stagger (amount 0.25), power3.out — text materializes out of thin air.
  const bloomAboutChars = useCallback(() => {
    requestAnimationFrame(() => {
      const root = aboutPanelRef.current;
      if (
        !root ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        return;
      }
      const chars = Array.from(
        root.querySelectorAll(".qd-char"),
      ) as HTMLElement[];
      chars.forEach((el) => {
        el.animate([{ opacity: "0" }, { opacity: "1" }], {
          duration: 400,
          delay: Math.random() * 250,
          easing: "cubic-bezier(0.215, 0.61, 0.355, 1)",
          fill: "backwards",
        });
      });
    });
  }, []);

  const toggleAbout = useCallback(() => {
    if (!aboutOpen) bloomAboutChars();
    setAboutOpen(!aboutOpen);
  }, [aboutOpen, bloomAboutChars]);

  // Repel field: while a pill is dragged near the open bio, each character
  // flees the pointer (falloff radius 170px, max push 46px) and springs
  // home when the pill leaves. Transform-only — never fights the opacity
  // dissolves. Char centers are cached (refreshed on scroll), so no
  // layout reads happen mid-drag.
  const repelRef = useRef({ x: -9999, y: -9999, t: 0, active: false });
  const repelCenters = useRef(
    new Map<HTMLElement, { x: number; y: number; push: number }>(),
  );
  const repelOffset = useRef(new Map<HTMLElement, { x: number; y: number }>());

  useEffect(() => {
    const onRepel = (e: Event) => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
      }
      const { x, y, active } = (
        e as CustomEvent<{ x: number; y: number; active: boolean }>
      ).detail;
      repelRef.current = { x, y, t: performance.now(), active };
    };
    window.addEventListener("about:repel", onRepel);
    return () => window.removeEventListener("about:repel", onRepel);
  }, []);

  // Site-wide repel field: every split glyph outside the wordmark, the
  // pills, and the rows flees a dragged pill — and so do the button shells
  // themselves ([data-push], heavier so they shove less). Springs home.
  // Centers cached (scroll/resize refresh) — no layout reads mid-drag.
  // Transform-only, never fights opacity dissolves.
  useEffect(() => {
    const EXCLUDE =
      ".hero-wordmark, .project-row, [data-purpose=\"interest-tags\"]";
    const refresh = () => {
      repelCenters.current.clear();
      const add = (el: HTMLElement, push: number) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return;
        repelCenters.current.set(el, {
          x: r.x + r.width / 2,
          y: r.y + r.height / 2,
          push,
        });
      };
      document.querySelectorAll("[data-push]").forEach((node) => {
        add(node as HTMLElement, 30);
      });
      document.querySelectorAll(".qd-char").forEach((node) => {
        const el = node as HTMLElement;
        if (el.closest(EXCLUDE)) return;
        add(el, 46);
      });
    };
    refresh();
    window.addEventListener("scroll", refresh, { passive: true });
    window.addEventListener("resize", refresh);
    return () => {
      window.removeEventListener("scroll", refresh);
      window.removeEventListener("resize", refresh);
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    const RADIUS = 170;
    const frame = () => {
      if (repelCenters.current.size > 0) {
        const rp = repelRef.current;
        // Held drags keep pushing at the last position; released/stale
        // fields decay after 140ms of silence.
        const fresh = rp.active || performance.now() - rp.t < 140;
        repelCenters.current.forEach((c, el) => {
          let tx = 0;
          let ty = 0;
          if (fresh) {
            const dx = c.x - rp.x;
            const dy = c.y - rp.y;
            const d = Math.hypot(dx, dy);
            if (d < RADIUS) {
              const f = (1 - d / RADIUS) * c.push;
              if (d > 0.01) {
                tx = (dx / d) * f;
                ty = (dy / d) * f;
              } else {
                // Dead center: shove straight up instead of dividing by zero.
                tx = 0;
                ty = -f;
              }
            }
          }
          const cur = repelOffset.current.get(el) ?? { x: 0, y: 0 };
          const nx = cur.x + (tx - cur.x) * 0.2;
          const ny = cur.y + (ty - cur.y) * 0.2;
          if (tx === 0 && ty === 0 && Math.abs(nx) < 0.05 && Math.abs(ny) < 0.05) {
            if (cur.x !== 0 || cur.y !== 0) {
              repelOffset.current.set(el, { x: 0, y: 0 });
              el.style.transform = "";
            }
          } else {
            repelOffset.current.set(el, { x: nx, y: ny });
            el.style.transform = `translate3d(${nx.toFixed(1)}px, ${ny.toFixed(1)}px, 0)`;
          }
        });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!aboutOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAboutOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aboutOpen]);

  // GitHub bubble card in the dock (replaces the old BE link).
  const [ghOpen, setGhOpen] = useState(false);

  // Dual theme: dark (#141414) default, warm cream light mode. Persisted.
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    const stored = localStorage.getItem("site-theme");
    const initial = stored === "light" ? "light" : "dark";
    setTheme(initial);
    document.documentElement.classList.toggle("light", initial === "light");
  }, []);
  const toggleTheme = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const next = theme === "dark" ? "light" : "dark";
      const apply = () => {
        setTheme(next);
        localStorage.setItem("site-theme", next);
        document.documentElement.classList.toggle(
          "light",
          next === "light",
        );
      };
      const doc = document as Document & {
        startViewTransition?: (cb: () => void) => {
          ready: Promise<void>;
        };
      };
      // No animation path: reduced motion, unsupported browser, or mid-flight.
      if (
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        !doc.startViewTransition ||
        transitioningThemeRef.current
      ) {
        if (!transitioningThemeRef.current) apply();
        return;
      }
      transitioningThemeRef.current = true;
      // Origin: center of the toggle button. Vars + animation class are set
      // BEFORE startViewTransition, so the new snapshot is born already
      // clipped — no unclipped fullscreen flash (the old twitch).
      const rect = e.currentTarget.getBoundingClientRect();
      const root = document.documentElement;
      root.style.setProperty("--vt-x", `${rect.left + rect.width / 2}px`);
      root.style.setProperty("--vt-y", `${rect.top + rect.height / 2}px`);
      root.classList.add("theme-animating");
      doc.startViewTransition(() => {
        apply();
      });
      window.setTimeout(() => {
        root.classList.remove("theme-animating");
        transitioningThemeRef.current = false;
      }, 1450);
    },
    [theme],
  );

  const activeKey = onHome && mode === "projects" ? "projects" : "home";

  // Project directory: home chrome melts away, exactly like Stitch
  const chromeGone = onHome && mode === "projects";

  const hideProjectsList = useCallback(() => {
    setRevealed(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [setRevealed]);

  // Guards double-clicks while the char-dissolve is running.
  // Wordmark (Hero) transition is untouched — this only gates header fade.
  const transitioningRef = useRef(false);
  // Guards the theme reveal while a view transition is in flight.
  const transitioningThemeRef = useRef(false);

  // Fade header chars back in when returning to home (mirrors animateIn).
  const prevModeRef = useRef(mode);
  useEffect(() => {
    if (prevModeRef.current === "projects" && mode === "home") {
      requestAnimationFrame(() => {
        qdFadeChars("in").catch(() => undefined);
      });
    }
    prevModeRef.current = mode;
  }, [mode]);

  const handleNav = useCallback(
    (e: React.MouseEvent, item: (typeof navItems)[number]) => {
      e.preventDefault();
      if (item.key === "home") {
        if (!onHome) {
          setMode("home");
          router.push("/");
        } else if (mode !== "home" || revealed) {
          setRevealed(false);
          setMode("home");
        } else {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        return;
      }
      if (item.key === "projects") {
        // Stitch staged flow: centered first, revealed list after
        if (!onHome) {
          router.push("/#project-directory");
          return;
        }
        if (mode !== "projects") {
          // quangdinh.im Home → Projects: Companies / About / Contact
          // chars dissolve (random stagger) while the wordmark morphs.
          if (transitioningRef.current) return;
          transitioningRef.current = true;
          qdFadeChars("out").catch(() => undefined);
          window.setTimeout(() => {
            setMode("projects");
            transitioningRef.current = false;
          }, 180);
          return;
        }
        if (revealed) hideProjectsList();
        return;
      }
    },
    [
      hideProjectsList,
      mode,
      onHome,
      revealed,
      router,
      setMode,
      setRevealed,
    ],
  );

  useEffect(() => {
    document.documentElement.classList.remove("route-switching");
  }, [pathname]);

  return (
    <div
      className={`cinematic-viewport flex min-h-screen flex-col justify-between bg-[#141414] text-[#F2EDE4] ${
        chromeGone ? "mode-projects" : ""
      }${chromeGone && revealed ? " projects-scrolled" : ""}`}
    >
      {/* BEGIN: TopBar (vanishes in the project directory) — quangdinh.im header match */}
      <header
        className="qd-header-section home-vanish relative z-30 grid w-full grid-cols-1 gap-8 px-4 pb-4 md:grid-cols-12 md:gap-0 md:px-4"
        data-purpose="site-header"
      >
        {/* Left: Companies / Experience Block — col 1/span 2, heading-4 20px.
            pt nudges its first baseline down to optically match the
            InstrumentSerif italic titles (16px/150% lh carries extra
            half-leading, so Pangea 20px/100% otherwise sits ~3px high). */}
        <div
          className="flex items-start qd-companies-gap pt-[3px] md:col-span-2"
          data-purpose="company-credentials"
        >
          <span className="qd-heading-4 whitespace-nowrap text-[#F2EDE4]">
            <QdSplit text="Focus:" />
          </span>
          <ul className="qd-heading-4 flex flex-col space-y-0.5 text-white/85">
            {companies.map((company) => (
              <li key={company} className="w-max">
                <QdSplit text={company} />
              </li>
            ))}
          </ul>
        </div>
        {/* Middle: About Me sits right beside Contact (was cols 9–10).
            The bio panel anchors to the title's right edge and opens
            leftward over empty canvas — never over Contact. */}
        <div className="md:col-start-10 md:col-span-1" data-purpose="about-meta">
          <div className="qd-header-copy">
            <button
              onClick={toggleAbout}
              aria-expanded={aboutOpen}
              className="qd-title-italic qd-about-toggle cursor-pointer text-left text-[#F2EDE4]"
            >
              <QdSplit text="About me" />
              <span className="qd-about-marker" aria-hidden="true">
                {aboutOpen ? "−" : "+"}
              </span>
            </button>
            <div
              ref={aboutPanelRef}
              className={`qd-about-panel ${aboutOpen ? "open" : ""}`}
            >
              <p className="qd-body-copy text-white/80">
                <QdSplit text="I'm Sriyaan, a developer working across machine learning, LLMs, and backend infrastructure — building autonomous systems, RAG pipelines, and agentic workflows that reason through complexity. My roots are in MLOps and DevOps — shipping models from notebooks to production that stays up. These days I'm exploring the frontier of agentic development: systems that don't just process data, but navigate tasks with intent and reliability." />
              </p>
            </div>
          </div>
        </div>
        {/* Right: Contact / Location — col 11/span 2 */}
        <div className="md:col-start-11 md:col-span-2">
          <div className="qd-header-copy">
            <h2 className="qd-title-italic text-[#F2EDE4]">
              <QdSplit text="Contact" />
            </h2>
            <div className="qd-body-copy flex flex-col space-y-1 text-white/75">
              <div className="text-white/85">
                <QdSplit text="Based in pune, india" />
              </div>
              <div>
                <QdSplit text="available for work" />
              </div>
              <div className="pt-0.5">
                <span>
                  <u>
                    <QdSplit text="e: " />
                  </u>
                </span>
                <a
                  className="text-[#F2EDE4] underline decoration-white/40 underline-offset-4 transition-colors hover:decoration-white"
                  href="mailto:sheshanth12344@gmail.com"
                  aria-label="sheshanth12344@gmail.com"
                >
                  <QdSplit text="sheshanth12344@gmail.com" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </header>
      {/* END: TopBar */}

      <main className="frame-main relative flex w-full flex-1 flex-col">{children}</main>

      {/* BEGIN: BottomDock */}
      <footer
        className="relative z-30 flex w-full flex-col items-center justify-between gap-6 px-6 py-6 md:px-12 lg:flex-row"
        data-purpose="bottom-navigation-and-media"
      >
        {/* Left: Coordinates and Page Segment Control */}
        <div
          className="flex flex-col items-center gap-4 sm:items-start sm:gap-3"
          data-purpose="coordinates-and-views"
        >
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
            <div className="flex items-center gap-2.5 font-geist-mono text-[12px] tracking-[-0.01em] text-white/75">
              <svg
                viewBox="0 0 44 32"
                className="h-7 w-10 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                aria-hidden="true"
              >
                <ellipse cx="22" cy="16" rx="20" ry="14" />
                <ellipse cx="22" cy="16" rx="12.5" ry="14" />
                <ellipse cx="22" cy="16" rx="5" ry="14" />
                <line x1="2" y1="16" x2="42" y2="16" />
                <path d="M4.5 9.5 Q22 15.5 39.5 9.5" />
                <path d="M4.5 22.5 Q22 16.5 39.5 22.5" />
              </svg>
              <span className="flex flex-col leading-[1.5]">
                <span>
                  <QdSplit text="18.5204°N" />
                </span>
                <span>
                  <QdSplit text="73.8567°E" />
                </span>
              </span>
            </div>
            <nav aria-label="Quick Navigation" className="flex items-center gap-2">
              {navItems.map((item) => {
                const isActive = activeKey === item.key;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    data-nav={item.key}
                    data-push
                    onClick={(e) => handleNav(e, item)}
                    className={
                      isActive
                        ? "nav-pill-active qd-nav-pill rounded-full px-5 py-2 shadow-sm transition-all"
                        : "subtle-pill qd-nav-pill rounded-full px-5 py-2 text-[#F2EDE4] transition-all hover:text-white"
                    }
                  >
                    <QdSplit text={item.label} />
                  </Link>
                );
              })}
              {onHome && mode === "home" ? <ExperienceBook /> : null}
              <button
                onClick={toggleTheme}
                data-push
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                className="subtle-pill rounded-full p-2.5 transition-all"
              >
                {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
              </button>
            </nav>
          </div>
        </div>
        {/* Right: Spotify Widget & External Social Channels (vanishes in projects) */}
        <div
          className="footer-vanish flex flex-col items-center gap-6 sm:flex-row sm:gap-8 md:mr-8"
          data-purpose="media-and-socials"
        >
          <SpotifyPill />
          <nav
            aria-label="Social Links"
            className="relative flex items-center gap-3 text-xs font-semibold tracking-wider text-[#85817B]"
          >
            <span className="relative flex items-center gap-3">
              <button
                onClick={() => setGhOpen((v) => !v)}
                aria-expanded={ghOpen}
                aria-label="Show GitHub contributions"
                data-push
                className="grid place-items-center p-1 text-[#85817B] transition-colors hover:text-[#F2EDE4]"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                </svg>
              </button>
              <GitHubCard open={ghOpen} onClose={() => setGhOpen(false)} />
            </span>
            {socials.map((social) => (
              <span key={social.label} className="flex items-center gap-3">
                <a
                  href={social.href}
                  data-push
                  className={
                    social.active
                      ? "text-[#F2EDE4] underline decoration-white/40 underline-offset-4 transition-colors hover:decoration-white"
                      : "transition-colors hover:text-[#F2EDE4]"
                  }
                >
                  <QdSplit text={social.label} />
                </a>
              </span>
            ))}
          </nav>
        </div>
      </footer>
      {/* END: BottomDock */}
    </div>
  );
}

export default function Frame({ children }: Readonly<FrameProps>) {
  return (
    <ModeProvider initialMode="home">
      <FrameChrome>{children}</FrameChrome>
    </ModeProvider>
  );
}
