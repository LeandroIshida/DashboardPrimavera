// @ts-check

/**
 * @typedef {{ name: string, value: number, ts: string, quality: "GOOD" | "BAD", error?: string }} RawTag
 * @typedef {{ ts: string, tags: Record<string, RawTag> }} TagsResponse
 * @typedef {{ values: Record<string, number | boolean | undefined>, meta: Record<string, RawTag> }} NormalizedTags
 */

// CRA lê REACT_APP_* em tempo de build
const RAW_BASE = process.env.REACT_APP_API_BASE ?? "http://localhost:9090";
// remove barra no final pra evitar "//backend"
const API_BASE = RAW_BASE.replace(/\/+$/, "");

/** @returns {Promise<NormalizedTags>} */
export async function getTagsValues() {
  const r = await fetch(`${API_BASE}/api/tags`, { cache: "no-store" });
  if (!r.ok) throw new Error(`Falha ao obter tags (HTTP ${r.status})`);
  /** @type {TagsResponse} */
  const data = await r.json();

  /** @type {Record<string, number | boolean | undefined>} */
  const values = {};
  for (const [key, t] of Object.entries(data.tags)) {
    if (t.quality !== "GOOD") {
      values[key] = undefined;
      continue;
    }
    const isCoil =
      key.includes("parada") ||
      key.includes("emergencia") ||
      key.includes("ciclo_") ||
      key.includes("run") ||
      key.includes("fault") ||
      key.startsWith("motor_") ||
      key.startsWith("bomba_");

    values[key] = isCoil ? t.value >= 0.5 : t.value;
  }
  return { values, meta: data.tags };
}

export async function cmdEmergencia(pulseMs = 400) {
  const r = await fetch(
    `${API_BASE}/api/cmd/parar?pulseMs=${pulseMs}`,
    { method: "POST" }
  );
  if (!r.ok) throw new Error(`Falha ao acionar EMERGÊNCIA (HTTP ${r.status})`);
}

export async function cmdReset(pulseMs = 400) {
  const r = await fetch(
    `${API_BASE}/api/cmd/reset?pulseMs=${pulseMs}`,
    { method: "POST" }
  );
  if (!r.ok) throw new Error(`Falha ao enviar RESET (HTTP ${r.status})`);
}
