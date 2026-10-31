"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

/** O editor (Tiptap) só é baixado quando o usuário liga a edição, para não pesar a Visão Geral. */
const RichTextEditor = dynamic(() => import("./rich-text-editor"), {
  ssr: false,
  loading: () => <Skeleton className="h-44 rounded-lg" aria-busy="true" aria-label="Carregando editor" />,
});

export { RichTextEditor as RichTextField };
