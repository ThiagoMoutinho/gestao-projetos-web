import { mkdirSync } from "node:fs";
import path from "node:path";

import { expect, test as setup } from "@playwright/test";

import { STORAGE_STATE } from "./storage-state";

/**
 * Entra uma vez pela tela de login e guarda a sessão para os demais testes.
 * Sem E2E_EMAIL e E2E_PASSWORD o passo é ignorado e os testes que exigem login também.
 */
setup("autentica o usuário de teste", async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  setup.skip(!email || !password, "Defina E2E_EMAIL e E2E_PASSWORD para os testes autenticados.");

  await page.goto("/login");
  await page.getByLabel("E-mail").or(page.locator("#email")).fill(email as string);
  await page.locator("#password").fill(password as string);
  await page.getByRole("button", { name: /acessar sistema/i }).click();
  await expect(page).not.toHaveURL(/\/login/);

  mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });
  await page.context().storageState({ path: STORAGE_STATE });
});
