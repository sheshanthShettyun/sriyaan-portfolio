"use client";

import { useEffect, useState } from "react";
import ProjectIndex from "./ProjectIndex";

const word = "projects";

export interface ProjectsClientProps {
  title?: string;
}

export default function ProjectsClient({ title = word }: Readonly<ProjectsClientProps>) {
  const [stuck, setStuck] = useState(false);

  // Once the big wordmark scrolls off, register a compact bar at the top
  // while the rows travel below it
  useEffect(() => {
    const onScroll = () =>
      setStuck(window.scrollY > window.innerHeight * 0.55);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="w-full pb-32">
      {/* Compact directory bar — glides in when the hero scrolls off */}
      <div
        className={`fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-[#141414]/85 backdrop-blur-md transition-transform duration-500 ${
          stuck ? "translate-y-0" : "-translate-y-full"
        }`}
        aria-hidden={!stuck}
      >
        <div className="mx-auto flex max-w-6xl items-baseline justify-between px-4 py-4 sm:px-8">
          <span className="font-display text-2xl font-extrabold tracking-tight text-[#ECEBE4]">
            {title}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-widest text-[#85817B]">
            Selected works • 04
          </span>
        </div>
      </div>

      {/* Wordmark arrives already formed — the morph on Home was the transition */}
      <div
        className="flex min-h-[92vh] w-full items-center justify-center overflow-visible py-6 md:py-10"
        aria-label={title}
      >
        <h2
          className="hero-wordmark m-0 text-center font-extrabold leading-none tracking-tighter whitespace-nowrap"
          style={{ fontSize: "clamp(4.6rem, 13vw, 16rem)" }}
        >
          {title}
        </h2>
      </div>

      <ProjectIndex />
    </div>
  );
}
