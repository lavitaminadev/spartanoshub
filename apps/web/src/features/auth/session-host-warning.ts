interface SessionHostWarningOptions {
  isDevelopment: boolean;
  webHost: string;
  rawApiUrl?: string;
}

export function buildSessionHostWarning({ isDevelopment, webHost, rawApiUrl }: SessionHostWarningOptions): string | null {
  if (!isDevelopment || !rawApiUrl || rawApiUrl.startsWith('/')) return null;
  try {
    const apiUrl = new URL(rawApiUrl);
    if (apiUrl.hostname !== webHost) {
      return `Estás entrando por ${webHost}, pero la API local está configurada en ${apiUrl.hostname}. Para que la sesión no se cierre al recargar, usa http://${apiUrl.hostname}:5173 o alinea ambos en localhost.`;
    }
  } catch {
    return null;
  }
  return null;
}
