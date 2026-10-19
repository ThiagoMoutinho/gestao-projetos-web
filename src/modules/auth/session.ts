import { cookies } from "next/headers";

import { authClient } from "@/lib/auth/client";

export async function getServerSession() {
  const cookieStore = await cookies();

  return authClient.getSession({
    fetchOptions: {
      headers: {
        cookie: cookieStore.toString(),
      },
      credentials: "include",
    },
  });
}
