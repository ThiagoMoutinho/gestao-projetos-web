"use client";

import { authClient } from "@/lib/auth/client";

export function loginWithEmail(email: string, password: string, rememberMe: boolean) {
  return authClient.signIn.email({
    email,
    password,
    rememberMe,
  });
}

export function logout() {
  return authClient.signOut();
}

export function getBrowserSession() {
  return authClient.getSession();
}
