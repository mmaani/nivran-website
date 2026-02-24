export type JsonRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Safely parse JSON from a response without throwing.
 * Returns the parsed JSON or null if parsing fails.
 */
export async function readJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const parsed: unknown = await readJsonSafe(response);
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