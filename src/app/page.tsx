"use client";

import { useEffect } from "react";
import Hero from "@/components/Hero";
import ProjectIndex from "@/components/ProjectIndex";
import { useMode } from "@/lib/ModeContext";

export default function Home() {
  const { mode, revealed, setMode, setRevealed } = useMode();

  // Deep link: /#project-directory opens straight into the directory
  useEffect(() => {
    if (window.location.hash === "#project-directory") {
      setMode("projects");
    }
  }, [setMode]);

  // Scroll stays locked on home — only a click opens the directory,
  // and only then does scrolling unlock
  useEffect(() => {
    const locked = mode === "home";
    if (!locked) {
      document.documentElement.classList.remove("no-scroll");
    }
  }, [mode]);

  // Scrolling in projects mode pins the wordmark to the top
  useEffect(() => {
    if (mode !== "projects") return;
    const onScroll = () => setRevealed(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [mode, setRevealed]);

  return (
    <>
      <div className="hero-viewport flex flex-col justify-center">
        <Hero />
      </div>
      <div id="project-directory" className="scroll-mt-6">
        <ProjectIndex />
      </div>
    </>
  );
}
