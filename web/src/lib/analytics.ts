export async function trackEvent(eventType: string, metadata?: Record<string, unknown>): Promise<void> {
  if (!eventType) return;
  try {
    await fetch("/api/analytics/event", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType, metadata: metadata || {} }),
    });
  } catch {
    /* fire and forget */
  }
}