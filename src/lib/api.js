// @ts-check

/**
 * @typedef {{ name: string, value: number, ts: string, quality: "GOOD" | "BAD", error?: string }} RawTag
 * @typedef {{ ts: string, tags: Record<string, RawTag> }} TagsResponse
 * @typedef {{ values: Record<string, number | boolean | undefined>, meta: Record<string, RawTag> }} NormalizedTags
 */

// Em dev: use REACT_APP_API_BASE (ex: "http://localhost:9090")
// Em prod (sem REACT_APP_API_BASE): use "/backend" e passa pelo Nginx
const RAW_BASE = process.env.REACT_APP_API_BASE ?? "/backend";
// tira barras sobrando no final pra evitar "/backend/" + "/api"
const API_BASE = RAW_BASE.replace(/\/+$/, "");

/** @returns {Promise<NormalizedTags>} */
export async function getTagsValues() {
  // -> dev:   http://localhost:9090/api/tags
  // -> prod:  /backend/api/tags  (Nginx -> /api/tags no backend)
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

/**
 * Comando de emergência (pulso)
 * Mantendo exatamente o endpoint antigo: /api/cmd/parar?pulseMs=...
 */
export async function cmdEmergencia(pulseMs = 400) {
  const r = await fetch(`${API_BASE}/api/cmd/parar?pulseMs=${pulseMs}`, {
    method: "POST",
  });
  if (!r.ok) {
    throw new Error(`Falha ao acionar EMERGÊNCIA (HTTP ${r.status})`);
  }
}

/**
 * Comando de reset
 * Mantendo /api/cmd/reset?pulseMs=...
 */
export async function cmdReset(pulseMs = 400) {
  const r = await fetch(`${API_BASE}/api/cmd/reset?pulseMs=${pulseMs}`, {
    method: "POST",
  });
  if (!r.ok) {
    throw new Error(`Falha ao enviar RESET (HTTP ${r.status})`);
  }
}

/**
 * Comando de reset
 * Mantendo /api/cmd/resume?pulseMs=...
 */
export async function cmdResume(pulseMs = 400) {
  const r = await fetch(`${API_BASE}/api/cmd/resume?pulseMs=${pulseMs}`, {
    method: "POST",
  });
  if (!r.ok) {
    throw new Error(`Falha ao enviar RESUME (HTTP ${r.status})`);
  }
}

/**
 * Comando de reset
 * Mantendo /api/cmd/reset?pulseMs=...
 */
export async function cmdStoptime(pulseMs = 400) {
  const r = await fetch(`${API_BASE}/api/cmd/stoptime?pulseMs=${pulseMs}`, {
    method: "POST",
  });
  if (!r.ok) {
    throw new Error(`Falha ao enviar STOPTIME (HTTP ${r.status})`);
  }
}

/**
 * Comando de reset
 * Mantendo /api/cmd/reset?pulseMs=...
 */
export async function cmdEmpty(pulseMs = 400) {
  const r = await fetch(`${API_BASE}/api/cmd/empty?pulseMs=${pulseMs}`, {
    method: "POST",
  });
  if (!r.ok) {
    throw new Error(`Falha ao enviar EMPTY (HTTP ${r.status})`);
  }
}