"use client";

import { authClient } from "@/lib/auth/client";

export function loginWithEmail(email: string, password: string) {
  return authClient.signIn.email({
    email,
    password,
  });
}

export function logout() {
  return authClient.signOut();
}

export function getBrowserSession() {
  return authClient.getSession();
}
