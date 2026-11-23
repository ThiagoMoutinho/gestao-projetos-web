"use client";

import { BookOpen, Briefcase, Building2, CircleAlert, Compass, FileText, Info, Layers, Target, Users, type LucideIcon } from "lucide-react";
import { useRef, useState } from "react";

import { RichText } from "@/components/ui/rich-text";

import { meaningfulText } from "./field-display";
import { CONTEXT_KEYS, fieldOf, LABELS } from "./institutional-about";
import { parseSectors } from "./institutional-sectors";
import type { Overview } from "./institutional-shared";
import { DrawerCard as ContentCard, DrawerCount as Count, DrawerEmpty, DrawerNav } from "./overview-detail-drawer";

type TabId = "ficha" | "sistema" | "contexto" | "resultados";

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "ficha", label: "Ficha", icon: Building2 },
  { id: "sistema", label: "Sistema", icon: Info },
  { id: "contexto", label: "Contexto", icon: BookOpen },
  { id: "resultados", label: "Resultados", icon: Target },
];

const CONTEXT_ICON: Record<string, LucideIcon> = { PROBLEM: CircleAlert, PURPOSE: Compass, SCOPE: Layers };

const NOT_INFORMED = <DrawerEmpty />;

/** Texto longo em markdown, com leitura confortável; campo vazio vira um aviso discreto. */
function Prose({ text }: { text: string | null }) {
  if (!text) return NOT_INFORMED;
  return (
    <div className="text-[13.5px] leading-[1.75] text-foreground/90">
      <RichText markdown={text} />
    </div>
  );
}

/**
 * Painel de detalhes do card "Sobre o projeto". Mostra uma parte por vez, a escolhida na barra fixa do topo (Ficha, Sistema,
 * Contexto ou Resultados), com os textos completos e cartões com ícone. Os textos vêm prontos do card (mesmos dados e regras),
 * sem nova consulta.
 */
export function AboutDrawerContent({ data, description, summary, expected }: { data: Overview; description: string | null; summary: string | null; expected: string[] }) {
  const nav = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<TabId>("ficha");

  function choose(id: string) {
    setTab(id as TabId);
    // Cada parte começa no topo da área rolável.
    nav.current?.closest<HTMLElement>("[role=region]")?.scrollTo({ top: 0 });
  }

  const sectors = parseSectors(fieldOf(data, "BENEFITED_SECTORS").published?.value ?? "");
  const area = meaningfulText(fieldOf(data, "REQUESTING_AREA").published?.value);
  const company = meaningfulText(fieldOf(data, "RESPONSIBLE_COMPANY").published?.value);

  return (
    <div className="flex flex-col gap-4">
      <DrawerNav wrapperRef={nav} label="Partes do painel" active={tab} onSelect={choose} items={TABS.map(({ id, label, icon }) => ({ id, label, icon }))} />

      <div key={tab} role="group" aria-label={TABS.find((item) => item.id === tab)?.label} className="motion-fade flex flex-col gap-4">
        {tab === "ficha" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <ContentCard icon={Building2} title={LABELS.REQUESTING_AREA}>
              {area ? <p className="text-base font-semibold break-words text-foreground">{area}</p> : NOT_INFORMED}
            </ContentCard>
            <ContentCard icon={Briefcase} title={LABELS.RESPONSIBLE_COMPANY}>
              {company ? <p className="text-base font-semibold break-words text-foreground">{company}</p> : NOT_INFORMED}
            </ContentCard>
            <ContentCard icon={Users} title={LABELS.BENEFITED_SECTORS} className="sm:col-span-2" aside={sectors.length > 0 ? <Count value={sectors.length} /> : null}>
              {sectors.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {sectors.map((sector) => (
                    <li key={sector} className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-foreground">
                      {sector}
                    </li>
                  ))}
                </ul>
              ) : (
                NOT_INFORMED
              )}
            </ContentCard>
          </div>
        ) : null}

        {tab === "sistema" ? (
          <ContentCard icon={Info} title={LABELS.SYSTEM_DESCRIPTION}>
            <Prose text={description} />
          </ContentCard>
        ) : null}

        {tab === "contexto"
          ? CONTEXT_KEYS.map((key) => (
              <ContentCard key={key} icon={CONTEXT_ICON[key] ?? FileText} title={LABELS[key]}>
                <Prose text={meaningfulText(fieldOf(data, key).published?.value)} />
              </ContentCard>
            ))
          : null}

        {tab === "resultados" ? (
          <>
            {summary ? (
              <ContentCard icon={FileText} title={LABELS.RESULTS_SUMMARY}>
                <Prose text={summary} />
              </ContentCard>
            ) : null}
            <ContentCard icon={Target} title="Principais resultados esperados" aside={expected.length > 0 ? <Count value={expected.length} /> : null}>
              {expected.length > 0 ? (
                <ol className="flex flex-col gap-2">
                  {expected.map((text, index) => (
                    <li key={`${index}-${text}`} className="flex items-start gap-3 rounded-xl bg-muted/50 px-3.5 py-3 dark:bg-muted/30">
                      <span className="mt-px flex size-6 shrink-0 items-center justify-center rounded-full bg-status-done-soft text-label font-semibold text-status-done-ink" aria-hidden="true">
                        {index + 1}
                      </span>
                      <p className="min-w-0 text-[13px] leading-relaxed break-words text-foreground/90">{text}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                NOT_INFORMED
              )}
            </ContentCard>
          </>
        ) : null}
      </div>
    </div>
  );
}
