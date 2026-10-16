"use client";

import { motion } from "framer-motion";

const skills = [
  "Python",
  "JavaScript",
  "TypeScript",
  "Next.js",
  "FastAPI",
  "Docker",
  "Git",
  "LangChain",
  "ChromaDB",
  "PostgreSQL",
  "Kubernetes",
  "Linux",
  "MLflow",
  "LangGraph",
  "CI/CD",
];

const ease = [0.22, 1, 0.36, 1] as const;

export default function ArchiveClient() {
  return (
    <div className="mx-auto max-w-5xl px-6 pb-40 pt-32 md:px-10 md:pt-36">
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease }}
        className="font-mono text-[10px] uppercase tracking-[0.35em] text-white/35"
      >
        Archive
      </motion.p>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.1, ease }}
        className="mt-5 text-[clamp(2.4rem,5vw,4.5rem)] leading-[0.95] tracking-[-0.03em] text-white/90"
      >
        Tools I build with
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.2, ease }}
        className="mt-4 max-w-md text-[14px] leading-[1.75] text-white/45"
      >
        Take a peek behind the scenes — the stack that powers everything on
        this site.
      </motion.p>

      <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {skills.map((skill, index) => (
          <motion.div
            key={skill}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, delay: (index % 4) * 0.07, ease }}
            className="group flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5 py-4 transition-colors duration-300 hover:border-white/25 hover:bg-white/[0.05]"
          >
            <span className="text-[14px] text-white/70 transition-colors group-hover:text-white">
              {skill}
            </span>
            <span className="font-mono text-[9px] tracking-[0.2em] text-white/25">
              {String(index + 1).padStart(2, "0")}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
