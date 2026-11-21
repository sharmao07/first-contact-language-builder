export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, options: { method?: string; token?: string | null; body?: unknown; form?: FormData } = {}): Promise<T> {
  const headers = new Headers();
  if (options.token) headers.set("x-participant-token", options.token);
  let body: BodyInit | undefined;
  if (options.form) {
    body = options.form;
  } else if (options.body !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(options.body);
  }
  const response = await fetch(path, {
    method: options.method ?? (body ? "POST" : "GET"),
    headers,
    body,
  });
  if (response.headers.get("content-type")?.includes("application/json")) {
    const data = await response.json();
    if (!response.ok) throw new ApiError(data.error || "Request failed.", response.status);
    return data as T;
  }
  if (!response.ok) throw new ApiError("Request failed.", response.status);
  return (await response.text()) as T;
}
