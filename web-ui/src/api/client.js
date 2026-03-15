const API_BASE = import.meta.env.VITE_API_URL || "";

export async function getConfig() {
  const res = await fetch(`${API_BASE}/api/config`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function putConfigEndpoint(path, body) {
  const res = await fetch(`${API_BASE}/api/config${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || res.statusText);
  }
  return res.json();
}

export async function putConfigUnifi(body) {
  return putConfigEndpoint("/unifi", body);
}

export async function putConfigTraefik(body) {
  return putConfigEndpoint("/traefik", body);
}

export async function putConfigSystem(body) {
  return putConfigEndpoint("/system", body);
}

export async function putConfigOverrides(body) {
  return putConfigEndpoint("/overrides", body);
}

export async function getDiscovered() {
  const res = await fetch(`${API_BASE}/api/discovered`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
