export interface ProjectIndexRow {
  index: string;
  title: string;
  tags: [string, string];
  badge: string;
  color: string;
  image: string;
  meta: string;
}

export const projectIndexRows: ProjectIndexRow[] = [
  {
    index: "01",
    title: "Autonomous Agent Engine",
    tags: ["LLMs", "Rust"],
    badge: "01 // SYS",
    color: "#C6F68D",
    image:
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
    meta: "Distributed State Graphs • 99.98% Realtime",
  },
  {
    index: "02",
    title: "Documatic Neural Search",
    tags: ["VectorDB", "Go"],
    badge: "02 // SEARCH",
    color: "#FFAAA6",
    image:
      "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=800&q=80",
    meta: "AST Semantic Embeddings • 12.4M Vectors",
  },
  {
    index: "03",
    title: "Vestlane Global Ledger",
    tags: ["Fintech", "Infra"],
    badge: "03 // FINTECH",
    color: "#C9BBA6",
    image:
      "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=800&q=80",
    meta: "Institutional Reconciliation • 45,000 TPS",
  },
  {
    index: "04",
    title: "Genetica ML Lab",
    tags: ["BioML", "WebGL"],
    badge: "04 // LAB",
    color: "#C6F68D",
    image:
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
    meta: "Genomic Sequences • 60 FPS WebGL Shaders",
  },
];
