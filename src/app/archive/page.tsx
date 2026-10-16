import type { Metadata } from "next";
import ArchiveClient from "@/components/ArchiveClient";

export const metadata: Metadata = {
  title: "Sriyaan — Archive",
  description: "Skills and tools",
};

export default function ArchivePage() {
  return <ArchiveClient />;
}
