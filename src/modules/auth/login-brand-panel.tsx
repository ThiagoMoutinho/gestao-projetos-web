import { Headset, Lock, Shield } from "lucide-react";
import Image from "next/image";

const FEATURES = [
  {
    icon: Shield,
    title: "Seguro e confiável",
    description: "Seus dados protegidos com segurança.",
  },
  {
    icon: Lock,
    title: "Acesso restrito",
    description: "Apenas usuários autorizados.",
  },
  {
    icon: Headset,
    title: "Suporte institucional",
    description: "Entre em contato com a nossa equipe.",
  },
] as const;

const STAR_POINTS = [
  "590,50",
  "637,185",
  "780,188",
  "666,275",
  "708,412",
  "590,330",
  "472,412",
  "514,275",
  "400,188",
  "543,185",
].join(" ");

export function LoginBrandPanel() {
  return (
    <section className="relative flex flex-col justify-between gap-12 overflow-hidden bg-brand px-6 py-10 text-brand-foreground sm:px-10 lg:px-12 lg:py-12 xl:px-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_12%_-10%,color-mix(in_oklch,var(--primary)_55%,transparent),transparent_52%),radial-gradient(ellipse_at_78%_22%,color-mix(in_oklch,var(--primary)_34%,transparent),transparent_40%),linear-gradient(160deg,color-mix(in_oklch,var(--brand),white_22%),var(--brand)_46%,color-mix(in_oklch,var(--brand),black_28%))]"
      />
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full text-brand-foreground"
        viewBox="0 0 800 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <circle
          cx="8"
          cy="390"
          r="108"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.18"
          strokeWidth="2"
        />
        <polygon
          points={STAR_POINTS}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.28"
          strokeWidth="2.4"
        />
        <path
          d="M-40 690 C 90 620, 180 760, 320 690 S 560 560, 840 650"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.28"
          strokeWidth="1.6"
        />
        <path
          d="M-40 735 C 120 660, 230 820, 380 740 S 620 610, 860 710"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.2"
          strokeWidth="1.4"
        />
        <path
          d="M-20 790 C 150 720, 280 860, 450 790 S 680 680, 880 770"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.14"
          strokeWidth="1.2"
        />
      </svg>

      <div className="relative space-y-12 lg:space-y-16">
        <div className="flex items-center gap-4">
          <Image
            src="/brand/igepps-logo.png"
            alt="IGEPPS — Instituto de Gestão Previdenciária e Proteção Social do Estado do Pará"
            width={218}
            height={85}
            priority
            className="h-14 w-auto sm:h-16"
          />
          <span className="h-12 w-px shrink-0 bg-brand-foreground/35" aria-hidden="true" />
          <div className="leading-tight">
            <p className="text-lg font-semibold tracking-wide sm:text-xl">CTIN</p>
            <p className="text-[0.68rem] font-medium tracking-[0.16em] text-brand-foreground/80 sm:text-xs">
              ESCRITÓRIO DE PROJETOS
            </p>
          </div>
        </div>

        <div className="max-w-xl space-y-5">
          <h1 className="max-w-xl text-[2rem] leading-[1.12] font-semibold tracking-tight sm:text-5xl">
            Gestão que
            <br />
            acompanha, <span className="text-primary">conecta</span>
            <br />e <span className="text-primary">entrega resultados.</span>
          </h1>
          <span className="block h-1 w-16 rounded-full bg-primary" aria-hidden="true" />
          <p className="max-w-md text-sm leading-relaxed text-brand-foreground/80 sm:text-base">
            Plataforma integrada para o acompanhamento dos projetos institucionais da CTIN,
            com foco em iniciativas, entregas e evidências em um único ambiente.
          </p>
        </div>
      </div>

      <ul className="relative grid gap-5 sm:grid-cols-3">
        {FEATURES.map((feature) => (
          <li key={feature.title} className="flex gap-3 sm:flex-col sm:gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <feature.icon className="size-5" aria-hidden="true" />
            </span>
            <span className="space-y-1">
              <span className="block text-sm font-semibold">{feature.title}</span>
              <span className="block text-xs leading-relaxed text-brand-foreground/75">
                {feature.description}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
