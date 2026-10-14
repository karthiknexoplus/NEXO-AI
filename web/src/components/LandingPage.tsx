import { useEffect, useState } from "react";
import { Code2, FolderOpen, Github, Loader2, Sparkles, Zap } from "lucide-react";
import {
  fetchAuthConfig,
  login,
  loginAsGuest,
  register,
  startGoogleSignIn,
  type AuthSession,
} from "../lib/auth";

type AuthTab = "signin" | "signup";

interface LandingPageProps {
  onAuthenticated: (session: AuthSession) => void;
}

const HIGHLIGHTS = [
  { icon: Zap, title: "NEXOPLUS Fast · Smart · Deep", desc: "Modes tuned for drafts, builds, and deep work" },
  { icon: FolderOpen, title: "Per-chat workspaces", desc: "Import folders, edit in Monaco, ask to change code" },
  { icon: Github, title: "Ship to GitHub", desc: "Commit, push, and create repos from the studio" },
];

export function LandingPage({ onAuthenticated }: LandingPageProps) {
  const [tab, setTab] = useState<AuthTab>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    void fetchAuthConfig().then((c) => setGoogleEnabled(c.googleEnabled));
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("auth_error");
    if (authError) {
      setError(
        authError === "google_not_configured"
          ? "Google sign-in is not configured on this server yet."
          : authError === "google_denied"
            ? "Google sign-in was cancelled."
            : decodeURIComponent(authError)
      );
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (params.get("signed_in") === "1") {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const finish = (session: AuthSession) => {
    onAuthenticated({ ...session, authenticated: true });
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      finish(await login(email, password));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      finish(await register(email, password));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setBusy(false);
    }
  };

  const handleGuest = async () => {
    setBusy(true);
    setError(null);
    try {
      finish(await loginAsGuest());
    } catch {
      setError("Could not start guest session");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col nexo-app-bg overflow-x-hidden overflow-y-auto relative">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        aria-hidden
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 30%, color-mix(in srgb, var(--nexo-brand) 25%, transparent) 0%, transparent 45%),
            radial-gradient(circle at 85% 70%, color-mix(in srgb, var(--nexo-brand-2) 20%, transparent) 0%, transparent 40%)
          `,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(var(--nexo-border) 1px, transparent 1px), linear-gradient(90deg, var(--nexo-border) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
        aria-hidden
      />

      <header className="relative z-10 shrink-0 flex items-center justify-between px-6 lg:px-10 py-5 border-b border-nexo-border/60">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 shrink-0 rounded-xl ring-1 ring-nexo-border bg-nexo-composer/80 flex items-center justify-center overflow-hidden p-1.5">
            <img
              src="/nexoplus-logo.png"
              alt=""
              className="max-h-full max-w-full w-auto h-auto object-contain"
            />
          </div>
          <div>
            <p className="font-display text-[17px] font-bold tracking-tight text-nexo-fg leading-none">
              NEXOPLUS
            </p>
            <p className="text-[10px] uppercase tracking-[0.22em] text-nexo-muted mt-0.5">
              AI Studio
            </p>
          </div>
        </div>
        <p className="hidden sm:block text-[11px] text-nexo-muted">
          NEXOPLUS Automations · Coimbatore
        </p>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-10 py-6 lg:py-8">
        <div className="w-full max-w-6xl grid lg:grid-cols-[1.05fr_0.95fr] gap-8 lg:gap-14 items-center">
          <div className="space-y-8">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border border-nexo-border bg-nexo-composer/60 text-nexo-muted mb-5">
                <Sparkles className="w-3.5 h-3.5 text-nexo-brand" />
                Intelligence built for builders
              </span>
              <h1 className="font-display text-[2.25rem] sm:text-4xl lg:text-[2.75rem] font-bold leading-[1.08] tracking-tight text-nexo-fg">
                Build software with{" "}
                <span className="nexo-gradient-text">NEXOPLUS</span> in one studio.
              </h1>
              <p className="mt-4 text-[15px] text-nexo-muted max-w-lg leading-relaxed">
                Chat, generate full projects, import your codebase, and sync to GitHub — without
                leaving the browser.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {HIGHLIGHTS.map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-nexo-border bg-nexo-sidebar/80 nexo-glass p-4 shadow-sm"
                >
                  <Icon className="w-5 h-5 text-nexo-brand mb-2" />
                  <p className="text-[12px] font-semibold text-nexo-fg leading-snug">{title}</p>
                  <p className="text-[11px] text-nexo-muted mt-1 leading-snug">{desc}</p>
                </div>
              ))}
            </div>

            <div className="hidden lg:flex items-center gap-3 rounded-2xl border border-nexo-border bg-nexo-composer/50 p-4 max-w-md">
              <div className="h-10 w-10 rounded-lg nexo-btn-primary flex items-center justify-center shrink-0">
                <Code2 className="w-5 h-5 text-white" />
              </div>
              <p className="text-[12px] text-nexo-muted leading-relaxed">
                Each chat keeps its own file tree — switch chats without mixing projects.
              </p>
            </div>
          </div>

          <div className="w-full max-w-[420px] mx-auto lg:max-w-none lg:ml-auto">
            <div className="nexo-glass bg-nexo-sidebar border border-nexo-border rounded-3xl shadow-composer p-7 sm:p-8">
              <h2 className="font-display text-xl font-semibold text-nexo-fg">
                {tab === "signin" ? "Welcome back" : "Create your account"}
              </h2>
              <p className="text-[13px] text-nexo-muted mt-1 mb-5">
                Sign in, sign up, or continue as a guest.
              </p>

              <div className="flex rounded-xl border border-nexo-border p-0.5 mb-5 bg-nexo-composer/40">
                {(["signin", "signup"] as AuthTab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={`flex-1 py-2 rounded-[10px] text-[13px] font-semibold transition-all ${
                      tab === t
                        ? "nexo-pill-active shadow-sm"
                        : "text-nexo-muted hover:text-nexo-fg"
                    }`}
                  >
                    {t === "signin" ? "Sign in" : "Sign up"}
                  </button>
                ))}
              </div>

              {tab === "signup" && (
                <label className="block text-[12px] text-nexo-muted mb-3">
                  Your name
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-nexo-border bg-nexo-composer px-3 py-2.5 text-sm"
                    placeholder="Optional"
                    autoComplete="name"
                  />
                </label>
              )}

              <form
                onSubmit={tab === "signin" ? handleSignIn : handleSignUp}
                className="space-y-3.5"
              >
                <label className="block text-[12px] text-nexo-muted">
                  Email
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-nexo-border bg-nexo-composer px-3 py-2.5 text-sm"
                    placeholder="you@company.com"
                    autoComplete="email"
                    required
                  />
                </label>
                <label className="block text-[12px] text-nexo-muted">
                  Password
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-nexo-border bg-nexo-composer px-3 py-2.5 text-sm"
                    placeholder={tab === "signup" ? "At least 8 characters" : "••••••••"}
                    autoComplete={tab === "signin" ? "current-password" : "new-password"}
                    required
                    minLength={tab === "signup" ? 8 : 1}
                  />
                </label>

                {error && <p className="text-[12px] text-red-500">{error}</p>}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3 rounded-xl nexo-btn-primary font-semibold text-sm disabled:opacity-50 mt-1"
                >
                  {busy ? (
                    <span className="inline-flex items-center gap-2 justify-center">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Please wait…
                    </span>
                  ) : tab === "signin" ? (
                    "Sign in"
                  ) : (
                    "Create account"
                  )}
                </button>
              </form>

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-nexo-border" />
                </div>
                <div className="relative flex justify-center text-[11px]">
                  <span className="bg-nexo-sidebar px-2 text-nexo-muted">or</span>
                </div>
              </div>

              <button
                type="button"
                disabled={busy || !googleEnabled}
                onClick={() => startGoogleSignIn()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-nexo-border bg-white text-gray-800 text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed dark:bg-nexo-composer dark:text-nexo-fg dark:hover:bg-nexo-hover"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden>
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign in with Google
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => void handleGuest()}
                className="mt-3 w-full py-2.5 rounded-xl text-[13px] font-medium border border-nexo-border text-nexo-muted hover:text-nexo-fg hover:bg-nexo-hover transition-colors"
              >
                Continue as guest
              </button>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 shrink-0 py-3 text-center text-[10px] text-nexo-muted border-t border-nexo-border/50">
        © {new Date().getFullYear()} NEXOPLUS Automations
      </footer>
    </div>
  );
}
