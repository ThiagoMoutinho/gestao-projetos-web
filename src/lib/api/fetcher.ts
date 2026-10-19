import { getApiUrl } from "./config";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export type ErrorType<ErrorData> = ApiError & { data?: ErrorData };
export type BodyType<BodyData> = BodyData;

const EMPTY_STATUSES = new Set([204, 205, 304]);

async function serverCookieHeader() {
  if (typeof window !== "undefined") {
    return undefined;
  }

  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const cookie = cookieStore.toString();
  return cookie || undefined;
}

export async function apiFetcher<T>(url: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  const cookie = await serverCookieHeader();

  if (cookie && !headers.has("cookie")) {
    headers.set("cookie", cookie);
  }

  const response = await fetch(new URL(url, getApiUrl()), {
    ...options,
    headers,
    credentials: "include",
  });

  if (EMPTY_STATUSES.has(response.status)) {
    if (!response.ok) {
      throw new ApiError(response.status, "EMPTY_RESPONSE", "A API não retornou conteúdo.");
    }

    return { data: undefined, status: response.status, headers: response.headers } as T;
  }

  const text = await response.text();
  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  const data: unknown =
    text && contentType.includes("json") ? JSON.parse(text) : text ? text : undefined;

  if (!response.ok) {
    const body =
      typeof data === "object" && data !== null
        ? (data as { message?: string; code?: string })
        : {};
    throw new ApiError(
      response.status,
      body.code ?? "HTTP_ERROR",
      body.message ?? "A API recusou a requisição.",
    );
  }

  return { data, status: response.status, headers: response.headers } as T;
}
