import { existsSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { STORAGE_STATE } from "./storage-state";

const ERRO_SERVIDOR = /Internal Server Error|Application error/i;

test.describe("sem login", () => {
  test("redireciona a listagem de projetos para o login", async ({ page }) => {
    await page.goto("/projetos");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("#email")).toBeVisible();
  });
});

test.describe("autenticado", () => {
  test.skip(!existsSync(STORAGE_STATE), "Sem sessão: defina E2E_EMAIL e E2E_PASSWORD.");
  test.use({ storageState: STORAGE_STATE });

  test("lista projetos e abre a Visão Geral do primeiro", async ({ page }) => {
    const respostas: number[] = [];
    page.on("response", (response) => {
      if (response.url().includes("/projetos") && response.request().resourceType() === "document") {
        respostas.push(response.status());
      }
    });

    await page.goto("/projetos");
    await expect(page.getByRole("heading", { name: "Todos os Projetos" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(ERRO_SERVIDOR);

    const primeiro = page.locator('a[href^="/projetos/"]').first();
    await expect(primeiro).toBeVisible();
    await primeiro.click();

    await expect(page).toHaveURL(/\/projetos\/[^/]+$/);
    await expect(page.getByText("Visão geral do projeto", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: /Acessar EAP/i })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(ERRO_SERVIDOR);
    expect(respostas.every((status) => status < 500)).toBe(true);
  });
});
