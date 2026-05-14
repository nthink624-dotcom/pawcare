const PORTONE_ID_MAX_LENGTH = 32;

function randomBase36(length: number) {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(length);
    cryptoApi.getRandomValues(bytes);
    return Array.from(bytes, (byte) => (byte % 36).toString(36)).join("");
  }

  return Math.random().toString(36).slice(2, 2 + length).padEnd(length, "0");
}

export function createPortoneId(prefix: string) {
  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 8) || "pm";
  const id = `${safePrefix}_${Date.now().toString(36)}_${randomBase36(10)}`;

  return id.slice(0, PORTONE_ID_MAX_LENGTH);
}
