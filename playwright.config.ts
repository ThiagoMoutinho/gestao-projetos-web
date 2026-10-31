import { defineConfig, devices } from "@playwright/test";

/**
 * Testes E2E do frontend. Rodam contra o ambiente de desenvolvimento local (web na 3001, API na 3000).
 * Credenciais ficam só em variáveis de ambiente (E2E_EMAIL e E2E_PASSWORD), nunca no repositório.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3001";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL,
    locale: "pt-BR",
    // Diagnóstico: captura de tela e trace apenas quando um teste falha.
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/, use: { ...devices["Desktop Chrome"] } },
    {
      name: "chromium",
      testIgnore: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
  // Reaproveita o servidor já aberto (pnpm dev); só inicia um se a 3001 estiver livre. A API precisa estar no ar.
  webServer: {
    command: "pnpm dev",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
