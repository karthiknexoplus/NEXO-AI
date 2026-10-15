import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  RefreshCw,
  Search as SearchIcon,
  Users,
  X,
} from "lucide-react";

interface DailyRow {
  date: string;
  chats: number;
  searches: number;
  events: number;
  activeUsers: number;
}

interface TopQuery {
  query: string;
  count: number;
  lastAt: number;
  users: number;
}

interface TopUser {
  userId: string;
  email: string;
  events: number;
  chats: number;
  searches: number;
  logins: number;
  lastActive: number;
}

interface RecentEvent {
  id: string;
  userId: string;
  userEmail: string;
  eventType: string;
  metadata: Record<string, unknown>;
  createdAt: number;
}

interface Summary {
  generatedAt: number;
  totals: {
    registeredUsers: number;
    distinctUsersEver: number;
    events: number;
    chats: number;
    searches: number;
    logins: number;
    registrations: number;
    guests: number;
  };
  activeUsers: { last24h: number; last7d: number; last30d: number };
  daily: DailyRow[];
  modes: { mode: string; count: number }[];
  eventTypes: { type: string; count: number }[];
  topQueries: TopQuery[];
  topUsers: TopUser[];
  recentEvents: RecentEvent[];
  insights: {
    avgChatsPerActiveUserLast7d: number;
    peakDay: string | null;
    peakDayChats: number;
    peakHour: string | null;
    last7dChats: number;
    topMode: string | null;
  };
  hourDistribution: number[];
}

interface Props {
  onClose: () => void;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function eventLabel(type: string): string {
  const map: Record<string, string> = {
    chat_query: "Chat prompt",
    chat_search: "Chat search",
    auth_login: "Login",
    auth_register: "Register",
    auth_guest: "Guest session",
    new_chat: "New chat",
    project_created: "Project created",
    folder_imported: "Folder imported",
    zip_downloaded: "ZIP downloaded",
    mode_switched: "Mode switched",
    app_opened: "App opened",
    build_wizard_submitted: "Build wizard",
  };
  return map[type] || type;
}

function Kpi({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-xl border border-nexo-border bg-nexo-panel/95 p-4 shadow-sm">
      <div className="text-[11px] uppercase tracking-wider text-nexo-muted">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold text-nexo-fg">{value}</div>
      {sub && <div className="text-[11px] text-nexo-muted mt-1">{sub}</div>}
    </div>
  );
}

export function AnalyticsDashboard({ onClose }: Props) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/analytics/summary", { credentials: "include" });
      if (!res.ok) {
        setError(res.status === 403 ? "Admin access required" : "Failed to load analytics");
        return;
      }
      const data = (await res.json()) as Summary;
      setSummary(data);
      setError(null);
    } catch {
      setError("Failed to load analytics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  const maxChat = Math.max(1, ...(summary?.daily.map((d) => d.chats) || [1]));
  const maxActive = Math.max(1, ...(summary?.daily.map((d) => d.activeUsers) || [1]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4">
      <div className="w-full max-w-6xl h-[92vh] flex flex-col rounded-2xl border border-nexo-border bg-nexo-composer shadow-2xl overflow-hidden backdrop-blur-xl">
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-nexo-border">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-nexo-brand" />
            <h2 className="font-display text-[16px] font-semibold text-nexo-fg">Analytics & Usage</h2>
            <span className="text-[11px] text-nexo-muted">auto-refreshes every 30s</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={load}
              className="p-2 rounded-lg hover:bg-nexo-hover text-nexo-muted"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-nexo-hover text-nexo-muted"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {loading && !summary && (
            <div className="flex items-center justify-center h-40 text-nexo-muted gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading analytics…
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-400">
              {error}
            </div>
          )}

          {summary && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Kpi label="Registered users" value={summary.totals.registeredUsers} sub={`${summary.totals.distinctUsersEver} distinct active`} />
                <Kpi label="Active 24h" value={summary.activeUsers.last24h} sub={`7d: ${summary.activeUsers.last7d} · 30d: ${summary.activeUsers.last30d}`} />
                <Kpi label="Total prompts" value={summary.totals.chats} sub={`searches: ${summary.totals.searches}`} />
                <Kpi label="Events" value={summary.totals.events} sub={`logins ${summary.totals.logins} · guests ${summary.totals.guests}`} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Kpi label="Avg prompts / active user (7d)" value={summary.insights.avgChatsPerActiveUserLast7d} sub="prompt density" />
                <Kpi label="Peak day" value={summary.insights.peakDay ? summary.insights.peakDay.slice(5) : "—"} sub={`${summary.insights.peakDayChats} prompts`} />
                <Kpi label="Peak hour" value={summary.insights.peakHour || "—"} sub="last 30 days" />
                <Kpi label="Top mode" value={summary.insights.topMode || "—"} sub={`7d prompts: ${summary.insights.last7dChats}`} />
              </div>

              <section className="rounded-xl border border-nexo-border bg-nexo-panel/95 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-semibold text-nexo-fg">Daily prompts (14 days)</h3>
                  <span className="text-[11px] text-nexo-muted">max {maxChat}</span>
                </div>
                <div className="flex items-end gap-1 h-40">
                  {summary.daily.map((d) => {
                    const h = Math.round((d.chats / maxChat) * 100);
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`${d.date}: ${d.chats} prompts, ${d.activeUsers} active`}>
                        <div className="w-full flex-1 flex items-end">
                          <div
                            className="w-full rounded-t bg-nexo-brand/80 hover:bg-nexo-brand transition-colors"
                            style={{ height: `${h}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-nexo-muted truncate">{d.date.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-xl border border-nexo-border bg-nexo-panel/95 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-semibold text-nexo-fg">Daily active users (14 days)</h3>
                  <span className="text-[11px] text-nexo-muted">max {maxActive}</span>
                </div>
                <div className="flex items-end gap-1 h-32">
                  {summary.daily.map((d) => {
                    const h = Math.round((d.activeUsers / maxActive) * 100);
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`${d.date}: ${d.activeUsers} active`}>
                        <div className="w-full flex-1 flex items-end">
                          <div
                            className="w-full rounded-t bg-emerald-500/70 hover:bg-emerald-500 transition-colors"
                            style={{ height: `${h}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-nexo-muted truncate">{d.date.slice(8)}</span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <div className="grid sm:grid-cols-2 gap-4">
                <section className="rounded-xl border border-nexo-border bg-nexo-panel/95 p-4 shadow-sm">
                  <h3 className="text-[13px] font-semibold text-nexo-fg mb-3">Mode distribution</h3>
                  <div className="space-y-2">
                    {summary.modes.length === 0 && <p className="text-[12px] text-nexo-muted">No data yet</p>}
                    {summary.modes.map((m) => {
                      const pct = summary.totals.chats ? Math.round((m.count / summary.totals.chats) * 100) : 0;
                      return (
                        <div key={m.mode}>
                          <div className="flex justify-between text-[12px] text-nexo-fg mb-1">
                            <span>{m.mode}</span>
                            <span className="text-nexo-muted">{m.count} ({pct}%)</span>
                          </div>
                          <div className="h-2 rounded bg-nexo-hover overflow-hidden">
                            <div className="h-full bg-nexo-brand/80" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="rounded-xl border border-nexo-border bg-nexo-panel/95 p-4 shadow-sm">
                  <h3 className="text-[13px] font-semibold text-nexo-fg mb-3">Event types</h3>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {summary.eventTypes.map((e) => (
                      <div key={e.type} className="flex items-center justify-between text-[12px]">
                        <span className="text-nexo-fg">{eventLabel(e.type)}</span>
                        <span className="text-nexo-muted">{e.count}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <section className="rounded-xl border border-nexo-border bg-nexo-panel/95 p-4 shadow-sm">
                <h3 className="text-[13px] font-semibold text-nexo-fg mb-3 flex items-center gap-2">
                  <SearchIcon className="w-4 h-4" /> Top queries / searches
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="text-nexo-muted text-left">
                        <th className="py-1 pr-3">Query</th>
                        <th className="py-1 pr-3">Count</th>
                        <th className="py-1 pr-3">Users</th>
                        <th className="py-1 pr-3">Last</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.topQueries.length === 0 && (
                        <tr><td colSpan={4} className="py-3 text-nexo-muted">No queries yet</td></tr>
                      )}
                      {summary.topQueries.map((q, i) => (
                        <tr key={i} className="border-t border-nexo-border/50">
                          <td className="py-1.5 pr-3 text-nexo-fg max-w-[420px] truncate" title={q.query}>{q.query}</td>
                          <td className="py-1.5 pr-3 text-nexo-muted">{q.count}</td>
                          <td className="py-1.5 pr-3 text-nexo-muted">{q.users}</td>
                          <td className="py-1.5 pr-3 text-nexo-muted">{timeAgo(q.lastAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="grid sm:grid-cols-2 gap-4">
                <section className="rounded-xl border border-nexo-border bg-nexo-panel/95 p-4 shadow-sm">
                  <h3 className="text-[13px] font-semibold text-nexo-fg mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" /> Top users
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="text-nexo-muted text-left">
                          <th className="py-1 pr-3">User</th>
                          <th className="py-1 pr-2">Events</th>
                          <th className="py-1 pr-2">Prompts</th>
                          <th className="py-1 pr-2">Last</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.topUsers.map((u) => (
                          <tr key={u.userId} className="border-t border-nexo-border/50">
                            <td className="py-1.5 pr-3 text-nexo-fg max-w-[220px] truncate" title={u.email}>{u.email || u.userId}</td>
                            <td className="py-1.5 pr-2 text-nexo-muted">{u.events}</td>
                            <td className="py-1.5 pr-2 text-nexo-muted">{u.chats}</td>
                            <td className="py-1.5 pr-2 text-nexo-muted">{timeAgo(u.lastActive)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="rounded-xl border border-nexo-border bg-nexo-panel/95 p-4 shadow-sm">
                  <h3 className="text-[13px] font-semibold text-nexo-fg mb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Recent activity
                  </h3>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {summary.recentEvents.map((e) => (
                      <div key={e.id} className="flex items-center justify-between text-[12px] gap-2">
                        <div className="min-w-0">
                          <span className="text-nexo-fg">{eventLabel(e.eventType)}</span>
                          <span className="text-nexo-muted"> · {e.userEmail || e.userId}</span>
                          {e.eventType === "chat_query" && typeof e.metadata?.prompt === "string" && (
                            <div className="text-[11px] text-nexo-muted truncate max-w-[360px]" title={e.metadata.prompt as string}>
                              {e.metadata.prompt as string}
                            </div>
                          )}
                        </div>
                        <span className="text-nexo-muted shrink-0">{timeAgo(e.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <section className="rounded-xl border border-nexo-border bg-nexo-panel/95 p-4 shadow-sm">
                <h3 className="text-[13px] font-semibold text-nexo-fg mb-3">Activity by hour (30 days)</h3>
                <div className="flex items-end gap-0.5 h-20">
                  {summary.hourDistribution.map((c, h) => {
                    const maxH = Math.max(1, ...summary.hourDistribution);
                    const height = Math.round((c / maxH) * 100);
                    return (
                      <div key={h} className="flex-1 flex flex-col items-center gap-0.5" title={`${h}:00 — ${c}`}>
                        <div className="w-full flex-1 flex items-end">
                          <div className="w-full rounded-t bg-sky-500/70" style={{ height: `${height}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[9px] text-nexo-muted mt-1">
                  <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>24h</span>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}