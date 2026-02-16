export type JsonRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const parsed: unknown = await response.json().catch(() => null);
    if (isRecord(parsed) && typeof parsed.error === "string" && parsed.error.trim()) {
      return parsed.error;
    }
  }

  const text = await response.text().catch(() => "");
  if (text.trim()) {
    return text.slice(0, 220);
  }

  return fallback;
}
