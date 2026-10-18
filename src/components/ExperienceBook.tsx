"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Download } from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;
/* A cover is heavy: it resists, then falls open and eases out. */
const coverEase = [0.55, 0.02, 0.18, 1] as const;
const turnEase = [0.42, 0.02, 0.2, 1] as const;

type Entry = {
  company: string;
  role: string;
  place: string;
  period: string;
  points: string[];
};

/* Straight off public/resume.pdf so the book and the PDF never disagree. */
const entries: Entry[] = [
  {
    company: "Edufyi Tech Solutions",
    role: "DevOps Intern",
    place: "Remote",
    period: "In progress",
    points: [
      "Git and GitHub workflows for version control, branching and team collaboration.",
      "CI/CD pipelines, plus Docker to containerise and deploy applications.",
      "Cloud fundamentals on AWS — provisioning, configuring and managing environments.",
    ],
  },
  {
    company: "Teachnook",
    role: "Data Science Intern Training",
    place: "Remote",
    period: "2024",
    points: [
      "Statistics, Python and data visualisation for analysis.",
      "Analytical methods applied to real-world datasets.",
      "A foundation in data-driven problem solving and exploratory data analysis.",
    ],
  },
  {
    company: "Vishwakarma University, Pune",
    role: "B.Tech / Computer Science",
    place: "Pune, India",
    period: "2023—27",
    points: ["CGPA 7.78."],
  },
];

/* Each spread is one entry: the name on the left, the detail on the right. */
function CompanyPage({ item }: Readonly<{ item: Entry }>) {
  return (
    <div className="book-page-inner">
      <p className="book-eyebrow">{item.period}</p>
      <h3 className="book-heading book-heading-lg">{item.company}</h3>
      <p className="book-sub">{item.place}</p>
    </div>
  );
}

function DetailPage({ item, isLast }: Readonly<{ item: Entry; isLast?: boolean }>) {
  return (
    <div className="book-page-inner">
      <p className="book-eyebrow">{item.role}</p>
      <ul className="book-list">
        {item.points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      {isLast ? (
        <a
          className="book-resume"
          href="/resume.pdf"
          download="Sheshanth-Shetty-Resume.pdf"
          onClick={(e) => e.stopPropagation()}
        >
          <Download className="h-3.5 w-3.5" strokeWidth={1.7} aria-hidden="true" />
          Download resume
        </a>
      ) : null}
    </div>
  );
}

export default function ExperienceBook() {
  const [mounted, setMounted] = useState(false);
  const [overlay, setOverlay] = useState(false);
  const [open, setOpen] = useState(false);
  /* The settled spread. It only advances once the sheet has landed, so the
     static pages never swap content in view. */
  const [spread, setSpread] = useState(0);
  /* The direction of the sheet currently in flight, or null when settled. */
  const [turnDir, setTurnDir] = useState<"next" | "prev" | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [scale, setScale] = useState(1);
  const dialogRef = useRef<HTMLDivElement>(null);
  const reduceRef = useRef(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    setMounted(true);
    reduceRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return () => timers.current.forEach(window.clearTimeout);
  }, []);

  const total = entries.length;

  /* The book lands closed and waits: the first click opens the cover. */
  const openBook = useCallback(() => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    setSpread(0);
    setTurnDir(null);
    setLeaving(false);
    setOpen(false);
    setOverlay(true);
  }, []);

  /* Reverse: the cover closes, then the whole book sinks away. */
  const closeBook = useCallback(() => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    setOpen(false);
    if (reduceRef.current) {
      setOverlay(false);
      setSpread(0);
      setTurnDir(null);
      return;
    }
    timers.current.push(window.setTimeout(() => setLeaving(true), 950));
    timers.current.push(
      window.setTimeout(() => {
        setOverlay(false);
        setSpread(0);
        setTurnDir(null);
        setLeaving(false);
      }, 950 + 420),
    );
  }, []);

  /* The right half of the screen advances; the left half goes back. Turning
     forward past the last spread closes the book. */
  const navigate = useCallback(
    (dir: "next" | "prev") => {
      if (turnDir) return;
      if (!open) {
        setOpen(true);
        return;
      }
      if (dir === "next") {
        if (spread >= total - 1) {
          closeBook();
          return;
        }
        setTurnDir("next");
      } else {
        if (spread <= 0) return;
        setTurnDir("prev");
      }
    },
    [turnDir, open, spread, total, closeBook],
  );

  useEffect(() => {
    if (!overlay) return;
    const root = document.documentElement;
    root.classList.add("book-lock");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeBook();
        return;
      }
      const onControl = !!(e.target as HTMLElement | null)?.closest("a, button");
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        navigate("next");
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        navigate("prev");
      } else if ((e.key === "Enter" || e.key === " ") && !onControl) {
        /* Don't hijack Enter/Space from the download link. */
        e.preventDefault();
        navigate("next");
      }
    };
    window.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => {
      root.classList.remove("book-lock");
      window.removeEventListener("keydown", onKey);
    };
  }, [overlay, closeBook, navigate]);

  useEffect(() => {
    if (!overlay) return;
    const fit = () =>
      setScale(
        Math.min(
          1,
          (window.innerWidth - 32) / 620,
          (window.innerHeight - 140) / 460,
        ),
      );
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [overlay]);

  const d = (ms: number) => (reduceRef.current ? 0 : ms);

  /* While a sheet is in flight the pages either side of it show the spread it
     belongs to: forward it lifts off the right and lands on the left, backward
     it lifts off the left and lands on the right. */
  const k = turnDir === "prev" ? spread - 1 : spread;
  const leftIndex = turnDir ? k : spread;
  const rightIndex = turnDir ? k + 1 : spread;
  const leftItem = entries[leftIndex];
  const rightItem = entries[rightIndex];
  const liftedItem = entries[k];
  const landingItem = entries[k + 1];

  return (
    <>
      <button
        type="button"
        onClick={openBook}
        aria-label="Open resume"
        aria-haspopup="dialog"
        aria-expanded={overlay}
        title="Resume"
        data-push
        className="book-trigger subtle-pill qd-nav-pill cursor-pointer rounded-full px-5 py-2 text-[#F2EDE4] transition-all hover:text-white"
      >
        Resume
      </button>

      {mounted && overlay
        ? createPortal(
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-label="Resume"
              tabIndex={-1}
              className="book-overlay"
              style={{ "--book-scale": scale } as React.CSSProperties}
              onClick={(e) =>
                navigate(e.clientX < window.innerWidth / 2 ? "prev" : "next")
              }
            >
              <motion.div
                className="book-veil"
                initial={{ opacity: 0 }}
                animate={{ opacity: leaving ? 0 : 1 }}
                transition={{ duration: d(0.5), ease }}
              />

              <div className="book-scale">
                {/* Entrance layer sits above the perspective element, so its
                    opacity/transform can't flatten the cover's 3D context. */}
                <motion.div
                  className="book-entrance"
                  initial={{ opacity: 0, y: 140, scale: 0.9 }}
                  animate={{
                    opacity: leaving ? 0 : 1,
                    y: leaving ? 120 : 0,
                    scale: leaving ? 0.92 : 1,
                  }}
                  transition={{ duration: d(0.62), ease }}
                >
                  <div className="book-stage">
                    <div className="book-floor" aria-hidden="true" />

                    <motion.div
                      className="book-deck"
                      initial={false}
                      animate={{ x: open ? 0 : -150 }}
                      transition={{ duration: d(0.95), ease: coverEase }}
                    >
                      <motion.div
                        className="book-page book-page-left"
                        style={{ z: 5 }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: open ? 1 : 0 }}
                        /* The block is only uncovered once the cover has swept
                           past it, so the page stays hidden while the board is
                           in flight — otherwise it fades in semi-transparent
                           and whatever sits behind bleeds through it. */
                        transition={{
                          duration: d(open ? 0.17 : 0.18),
                          ease,
                          delay: d(open ? 0.78 : 0),
                        }}
                      >
                        {leftItem ? <CompanyPage item={leftItem} /> : null}
                      </motion.div>

                      <div className="book-page book-page-right">
                        {rightItem ? (
                          <DetailPage item={rightItem} isLast={rightIndex === total - 1} />
                        ) : null}
                      </div>

                      <motion.div
                        className="book-stack"
                        aria-hidden="true"
                        initial={false}
                        animate={{ opacity: open ? 1 : 0 }}
                        transition={{ duration: d(0.5), ease, delay: d(open ? 0.34 : 0) }}
                      />

                      {turnDir ? (
                        <motion.div
                          key={`leaf-${turnDir}-${k}`}
                          className="book-leaf"
                          style={{ z: 6 }}
                          initial={{ rotateY: turnDir === "next" ? 0 : -180 }}
                          animate={{ rotateY: turnDir === "next" ? -180 : 0 }}
                          transition={{ duration: d(0.78), ease: turnEase }}
                          onAnimationComplete={() => {
                            setSpread(turnDir === "next" ? k + 1 : k);
                            setTurnDir(null);
                          }}
                        >
                          {/* Front lands on the right, back lands on the left:
                              forward the front lifts the detail page away, back
                              the back lifts the company page away. */}
                          <div className="book-face book-leaf-front">
                            {liftedItem ? <DetailPage item={liftedItem} /> : null}
                          </div>
                          <div className="book-face book-leaf-back">
                            {landingItem ? <CompanyPage item={landingItem} /> : null}
                          </div>
                        </motion.div>
                      ) : null}

                      <motion.div
                        className="book-cover"
                        style={{ z: 4 }}
                        initial={false}
                        animate={{ rotateY: open ? -180 : 0 }}
                        transition={{ duration: d(0.95), ease: coverEase }}
                      >
                        <div className="book-face book-cover-front">
                          <span className="book-spine" aria-hidden="true" />
                          <span className="book-emboss" aria-hidden="true" />
                          <span className="book-cover-rule" aria-hidden="true" />
                          <span className="book-cover-band" aria-hidden="true" />
                          <span className="book-cover-kicker">Sheshanth Shetty</span>
                          <span className="book-cover-foot">2024—2026</span>
                          <span className="book-cover-copy">
                            <span className="book-cover-title">Experience</span>
                            <span className="book-cover-sub">DevOps · Data · Systems</span>
                          </span>
                        </div>
                        <div className="book-face book-cover-back">
                          <span className="book-endpaper" aria-hidden="true" />
                        </div>
                      </motion.div>
                    </motion.div>
                  </div>
                </motion.div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
