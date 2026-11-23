"use client";

import { BookOpen, Briefcase, Building2, CircleAlert, Compass, FileText, Info, Layers, Target, Users, type LucideIcon } from "lucide-react";
import { useRef, useState } from "react";

import { RichText } from "@/components/ui/rich-text";

import { meaningfulText } from "./field-display";
import { CONTEXT_KEYS, fieldOf, LABELS } from "./institutional-about";
import { parseSectors } from "./institutional-sectors";
import type { Overview } from "./institutional-shared";
import { DrawerCount as Count, DrawerEmpty, DrawerNav, DrawerSectionHead } from "./overview-detail-drawer";

type TabId = "ficha" | "sistema" | "contexto" | "resultados";

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "ficha", label: "Ficha", icon: Building2 },
  { id: "sistema", label: "Sistema", icon: Info },
  { id: "contexto", label: "Contexto", icon: BookOpen },
  { id: "resultados", label: "Resultados", icon: Target },
];

const CONTEXT_CAPTION: Record<string, string> = { PROBLEM: "A dor que o projeto resolve.", PURPOSE: "Para que o projeto existe.", SCOPE: "O que está dentro (e fora) da entrega." };
const CONTEXT_ICON: Record<string, LucideIcon> = { PROBLEM: CircleAlert, PURPOSE: Compass, SCOPE: Layers };

const NOT_INFORMED = <DrawerEmpty />;

/** Fato da ficha: ícone discreto, rótulo e valor em destaque. */
function Fact({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </dt>
      <dd className="text-base leading-snug font-semibold break-words text-foreground">{children}</dd>
    </div>
  );
}

/** Superfície única de cada parte do painel: as seções ficam dentro dela, separadas por divisórias sutis (sem vários cartões). */
function Surface({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 overflow-hidden rounded-2xl border border-border/70 bg-card py-1 shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-border">{children}</div>
  );
}

/** Seção da superfície: cabeçalho padrão (ícone, título, legenda, contador) com separador e o conteúdo abaixo. */
function Block({ icon, title, caption, aside, children }: { icon: LucideIcon; title: string; caption?: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="px-5 py-4">
      <DrawerSectionHead icon={icon} title={title} caption={caption} aside={aside} />
      {children}
    </section>
  );
}

/** Texto longo em markdown, com leitura confortável; campo vazio vira um aviso discreto. */
function Prose({ text }: { text: string | null }) {
  if (!text) return NOT_INFORMED;
  return (
    <div className="max-w-prose text-sm leading-[1.8] text-foreground/90 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_strong]:text-foreground">
      <RichText markdown={text} />
    </div>
  );
}

/**
 * Painel de detalhes do card "Sobre o projeto". Mostra uma parte por vez, a escolhida na barra fixa do topo (Ficha, Sistema,
 * Contexto ou Resultados). Cada parte é uma superfície única com seções e divisórias, no mesmo modelo do Resumo executivo. Os
 * textos vêm prontos do card (mesmos dados e regras), sem nova consulta.
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

      <div key={tab} role="group" aria-label={TABS.find((item) => item.id === tab)?.label} className="motion-fade">
        {tab === "ficha" ? (
          <Surface>
            <Block icon={Building2} title="Ficha institucional" caption="Quem solicitou e quem entrega.">
              <dl className="grid gap-x-6 gap-y-4 rounded-xl bg-muted/40 px-5 py-4 dark:bg-muted/25 sm:grid-cols-2">
                <Fact icon={Building2} label={LABELS.REQUESTING_AREA}>
                  {area ?? NOT_INFORMED}
                </Fact>
                <Fact icon={Briefcase} label={LABELS.RESPONSIBLE_COMPANY}>
                  {company ?? NOT_INFORMED}
                </Fact>
              </dl>
            </Block>
            <Block icon={Users} title={LABELS.BENEFITED_SECTORS} caption="Áreas que usam o sistema." aside={sectors.length > 0 ? <Count value={sectors.length} /> : null}>
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
            </Block>
          </Surface>
        ) : null}

        {tab === "sistema" ? (
          <Surface>
            <Block icon={Info} title={LABELS.SYSTEM_DESCRIPTION} caption="O que é o sistema e como funciona.">
              <Prose text={description} />
            </Block>
          </Surface>
        ) : null}

        {tab === "contexto" ? (
          <Surface>
            {CONTEXT_KEYS.map((key) => (
              <Block key={key} icon={CONTEXT_ICON[key] ?? FileText} title={LABELS[key]} caption={CONTEXT_CAPTION[key]}>
                <Prose text={meaningfulText(fieldOf(data, key).published?.value)} />
              </Block>
            ))}
          </Surface>
        ) : null}

        {tab === "resultados" ? (
          <Surface>
            {summary ? (
              <Block icon={FileText} title={LABELS.RESULTS_SUMMARY} caption="O que foi alcançado até agora.">
                <Prose text={summary} />
              </Block>
            ) : null}
            <Block icon={Target} title="Principais resultados esperados" caption="Metas a acompanhar." aside={expected.length > 0 ? <Count value={expected.length} /> : null}>
              {expected.length > 0 ? (
                <ol className="flex flex-col gap-3">
                  {expected.map((text, index) => (
                    <li key={`${index}-${text}`} className="flex items-start gap-3.5">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-status-done-soft text-xs font-semibold text-status-done-ink ring-1 ring-status-done/20 ring-inset" aria-hidden="true">
                        {index + 1}
                      </span>
                      <p className="min-w-0 pt-0.5 text-sm leading-relaxed break-words text-foreground/90">{text}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                NOT_INFORMED
              )}
            </Block>
          </Surface>
        ) : null}
      </div>
    </div>
  );
}
