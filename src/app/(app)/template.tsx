import { PageTransition } from "@/components/layout/page-transition";

/** O template é recriado a cada troca de rota: ponto único da transição de entrada/saída das páginas. */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
