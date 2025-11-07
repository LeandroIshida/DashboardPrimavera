const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:9090";

export async function getAllTags() {
  try {
    const r = await fetch(`${API_BASE}/api/tags`);
    if (!r.ok) throw new Error("Failed to fetch data");
    return r.json();
  } catch (error) {
    console.error("Error fetching data:", error);
  }
}

export async function cmdEmergencia() {
  await fetch(`${API_BASE}/api/cmd/emergencia`, { method: "POST" });
}

export async function cmdReset(pulseMs = 200) {
  await fetch(`${API_BASE}/api/cmd/reset?pulseMs=${pulseMs}`, { method: "POST" });
}

export function openSSE(onEvent) {
  const es = new EventSource(`${API_BASE}/api/stream`);
  es.onmessage = (e) => {
    try { onEvent(JSON.parse(e.data)); } catch {}
  };
  return () => es.close();
}
