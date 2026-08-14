export async function readRequestBody(request: Request): Promise<Record<string, unknown>> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) return (await request.json()) as Record<string, unknown>;
  return Object.fromEntries((await request.formData()).entries());
}
