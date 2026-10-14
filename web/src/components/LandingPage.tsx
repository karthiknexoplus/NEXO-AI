import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
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

const FEATURES = [
  "Chat-native coding with per-chat project files",
  "Import folders, edit in Monaco, ask NEXOPLUS to change code",
  "Git commit, push, and create GitHub repos from the studio",
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
      const session = await login(email, password);
      finish(session);
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
      const session = await register(email, password);
      finish(session);
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
      const session = await loginAsGuest();
      finish(session);
    } catch {
      setError("Could not start guest session");
    } finally {
      setBusy(false);
    }
  };

  const fillDemo = () => {
    setTab("signin");
    setEmail("karthik@nexoplus.in");
    setPassword("Nexoplus@1234");
  };

  return (
    <div className="min-h-full nexo-app-bg overflow-y-auto">
      <div className="min-h-full grid lg:grid-cols-2">
        <section
          className="relative flex flex-col justify-between p-10 lg:p-14 border-b lg:border-b-0 lg:border-r border-nexo-border"
          style={{
            background:
              "linear-gradient(145deg, color-mix(in srgb, var(--nexo-brand) 18%, var(--nexo-sidebar)) 0%, var(--nexo-panel) 55%, var(--nexo-app-bg) 100%)",
          }}
        >
          <div>
            <div className="flex items-center gap-3 mb-12">
              <img
                src="/nexoplus-logo.png"
                alt="NEXOPLUS"
                className="w-12 h-12 rounded-2xl ring-1 ring-nexo-border shadow-sm"
              />
              <div>
                <p className="font-display text-xl font-bold tracking-tight text-nexo-fg">
                  NEXOPLUS
                </p>
                <p className="text-[11px] uppercase tracking-[0.2em] text-nexo-muted">
                  AI Studio
                </p>
              </div>
            </div>
            <h1 className="font-display text-4xl lg:text-5xl font-bold leading-[1.1] tracking-tight text-nexo-fg max-w-lg">
              Build software with{" "}
              <span className="nexo-gradient-text">intelligence built in.</span>
            </h1>
            <p className="mt-5 text-[15px] text-nexo-muted max-w-md leading-relaxed">
              NEXOPLUS Automations — chat, generate projects, import your codebase, and ship to
              GitHub from one modern studio.
            </p>
            <ul className="mt-10 space-y-3">
              {FEATURES.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2.5 text-[13px] text-nexo-fg/90"
                >
                  <Sparkles className="w-4 h-4 text-nexo-brand shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-12 text-[11px] text-nexo-muted">
            © {new Date().getFullYear()} NEXOPLUS Automations · Coimbatore
          </p>
        </section>

        <section className="flex items-center justify-center p-8 lg:p-14">
          <div className="w-full max-w-md">
            <div className="nexo-glass bg-nexo-sidebar border border-nexo-border rounded-3xl shadow-lg p-8">
              <h2 className="font-display text-2xl font-semibold text-nexo-fg text-center">
                Welcome back
              </h2>
              <p className="text-center text-[13px] text-nexo-muted mt-1 mb-6">
                Sign in, create an account, or try the studio as a guest.
              </p>

              <div className="flex rounded-xl border border-nexo-border p-0.5 mb-6 bg-nexo-composer/40">
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
                <label className="block text-[12px] text-nexo-muted mb-4">
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

              <form onSubmit={tab === "signin" ? handleSignIn : handleSignUp} className="space-y-4">
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
                  className="w-full py-3 rounded-xl nexo-btn-primary font-semibold text-sm disabled:opacity-50"
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

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-nexo-border" />
                </div>
                <div className="relative flex justify-center text-[11px]">
                  <span className="bg-nexo-sidebar px-2 text-nexo-muted">or continue with</span>
                </div>
              </div>

              <button
                type="button"
                disabled={busy || !googleEnabled}
                onClick={() => startGoogleSignIn()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-nexo-border bg-white text-gray-800 text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed dark:bg-nexo-composer dark:text-nexo-fg dark:hover:bg-nexo-hover"
                title={
                  googleEnabled
                    ? "Sign in with Google"
                    : "Ask your admin to add Google OAuth credentials in Studio settings"
                }
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden>
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
                className="mt-4 w-full py-2.5 rounded-xl text-[13px] font-medium text-nexo-muted hover:text-nexo-fg hover:bg-nexo-hover border border-transparent hover:border-nexo-border transition-colors"
              >
                Continue as guest
              </button>

              <p className="mt-6 text-[11px] text-center text-nexo-muted leading-relaxed">
                Team demo account?{" "}
                <button
                  type="button"
                  onClick={fillDemo}
                  className="text-nexo-brand hover:underline font-medium"
                >
                  Use default credentials
                </button>
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
