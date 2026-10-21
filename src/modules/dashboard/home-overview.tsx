"use client";

import { CircleCheck, CirclePlay, Clock, FileText, Plus, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Pie, PieChart, XAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const INDICATORS: { label: string; icon: LucideIcon; tone: "primary" | "muted" | "destructive" }[] =
  [
    { label: "Projetos em andamento", icon: CirclePlay, tone: "primary" },
    { label: "Projetos concluídos", icon: CircleCheck, tone: "primary" },
    { label: "Projetos em atraso", icon: Clock, tone: "destructive" },
    { label: "Projetos bloqueados", icon: TriangleAlert, tone: "destructive" },
    { label: "Aguardando documentação", icon: FileText, tone: "muted" },
  ];

const BOARD_COLUMNS = ["Não iniciado", "Em execução", "Em validação", "Concluído"] as const;

const areaConfig = {
  total: { label: "Projetos", color: "var(--chart-1)" },
} satisfies ChartConfig;

const statusConfig = {
  total: { label: "Projetos", color: "var(--chart-2)" },
} satisfies ChartConfig;

const TONE_CLASS = {
  primary: "bg-primary/10 text-primary",
  muted: "bg-muted text-muted-foreground",
  destructive: "bg-destructive/10 text-destructive",
} as const;

function givenName(name: string) {
  const first = name.trim().split(/\s+/)[0];
  return first || name;
}

function QuietEmpty({ title, description }: { title: string; description: string }) {
  return (
    <Empty className="border-0 px-2 py-6">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export function HomeOverview({ name, todayLabel }: { name: string; todayLabel: string }) {
  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
            Olá, {givenName(name)}!
          </h1>
          <p className="text-sm text-muted-foreground">
            Aqui está o panorama dos projetos da CTIN.
          </p>
          <p className="text-sm text-muted-foreground">
            Os indicadores serão preenchidos quando a integração com os projetos estiver disponível.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">{todayLabel}</p>
          <Button type="button" variant="outline" disabled>
            Período indisponível
            <span className="sr-only">. O filtro de período ainda não está disponível.</span>
          </Button>
        </div>
      </div>

      <section aria-label="Indicadores">
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {INDICATORS.map((indicator) => {
            const Icon = indicator.icon;

            return (
              <li key={indicator.label}>
                <Card size="sm" className="h-full">
                  <CardHeader>
                    <CardDescription className="min-w-0 leading-snug">{indicator.label}</CardDescription>
                    <CardAction>
                      <span
                        className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${TONE_CLASS[indicator.tone]}`}
                      >
                        <Icon className="size-4" />
                      </span>
                    </CardAction>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-medium tracking-tight">Sem dados</p>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="grid gap-3 lg:grid-cols-2" aria-label="Gráficos">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Projetos por área</CardTitle>
            <CardDescription>Sem dados para exibir.</CardDescription>
          </CardHeader>
          <CardContent className="relative">
            <ChartContainer config={areaConfig} className="aspect-auto h-44 w-full">
              <BarChart data={[]}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="area" tickLine={false} axisLine={false} />
                <Bar dataKey="total" fill="var(--color-total)" radius={4} />
              </BarChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-x-6 top-8 flex flex-col gap-3">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Situação dos projetos</CardTitle>
            <CardDescription>Sem dados para exibir.</CardDescription>
          </CardHeader>
          <CardContent className="relative">
            <ChartContainer config={statusConfig} className="mx-auto aspect-auto h-44 w-full max-w-xs">
              <PieChart>
                <Pie data={[]} dataKey="total" nameKey="situacao" innerRadius={48} outerRadius={72} />
              </PieChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <EmptyMedia variant="icon">
                <Clock />
              </EmptyMedia>
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
        <Card className="min-w-0 overflow-visible">
          <CardHeader className="border-b">
            <CardTitle className="min-w-0">Projetos em andamento</CardTitle>
            <CardAction>
              <Button type="button" size="sm" disabled>
                <Plus />
                Novo Projeto
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="kanban">
              <TabsList variant="line">
                <TabsTrigger value="kanban">Visão Kanban</TabsTrigger>
                <TabsTrigger value="lista" disabled>
                  Visão de Lista
                </TabsTrigger>
                <TabsTrigger value="meus" disabled>
                  Meus Projetos
                </TabsTrigger>
              </TabsList>
              <TabsContent value="kanban" className="pt-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {BOARD_COLUMNS.map((column) => (
                    <div key={column} className="rounded-lg bg-muted/50 p-3">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h3 className="text-sm font-medium">{column}</h3>
                        <Badge variant="secondary">Vazio</Badge>
                      </div>
                      <QuietEmpty
                        title="Nenhum projeto"
                        description="Nenhum projeto nesta etapa."
                      />
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="flex min-w-0 flex-col gap-3">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Próximos marcos</CardTitle>
            </CardHeader>
            <CardContent>
              <QuietEmpty
                title="Nenhum marco"
                description="Os marcos aparecem aqui quando houver projetos vinculados."
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Minhas tarefas</CardTitle>
            </CardHeader>
            <CardContent>
              <QuietEmpty
                title="Nenhuma tarefa"
                description="Suas tarefas aparecem aqui quando o módulo estiver disponível."
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Últimos comunicados</CardTitle>
            </CardHeader>
            <CardContent>
              <QuietEmpty
                title="Nenhum comunicado"
                description="Os comunicados aparecem aqui quando houver publicações."
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
