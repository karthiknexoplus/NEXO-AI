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

  const inputClass =
    "mt-1.5 w-full rounded-xl border border-nexo-border bg-nexo-composer px-3 py-3 text-base sm:text-sm min-h-[48px]";

  return (
    <div
      className="fixed inset-0 z-[100] overflow-x-hidden overflow-y-auto overscroll-y-contain nexo-app-bg [-webkit-overflow-scrolling:touch]"
      role="document"
    >
      <div
        className="pointer-events-none fixed inset-0 opacity-40"
        aria-hidden
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 30%, color-mix(in srgb, var(--nexo-brand) 25%, transparent) 0%, transparent 45%),
            radial-gradient(circle at 85% 70%, color-mix(in srgb, var(--nexo-brand-2) 20%, transparent) 0%, transparent 40%)
          `,
        }}
      />

      <div className="relative min-h-full flex flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 border-b border-nexo-border/60 bg-nexo-sidebar/90 backdrop-blur-md">
          <div className="h-10 w-10 shrink-0 rounded-xl ring-1 ring-nexo-border bg-nexo-composer/80 flex items-center justify-center p-1.5">
            <img
              src="/nexoplus-logo.png"
              alt=""
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <p className="font-display text-base font-bold tracking-tight text-nexo-fg leading-none">
              NEXOPLUS
            </p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-nexo-muted">AI Studio</p>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-10 py-5 sm:py-8 pb-safe max-w-6xl w-full mx-auto">
          <div className="lg:grid lg:grid-cols-2 lg:gap-14 lg:items-start">
            {/* Auth first on mobile */}
            <div className="order-1 lg:order-2 w-full max-w-md mx-auto lg:max-w-none lg:ml-auto lg:sticky lg:top-20">
              <div className="nexo-glass bg-nexo-sidebar border border-nexo-border rounded-2xl sm:rounded-3xl shadow-composer p-5 sm:p-8">
                <h2 className="font-display text-xl font-semibold text-nexo-fg">
                  {tab === "signin" ? "Welcome back" : "Create account"}
                </h2>
                <p className="text-[13px] text-nexo-muted mt-1 mb-4">
                  Sign in, sign up, or try guest mode.
                </p>

                <div className="flex rounded-xl border border-nexo-border p-0.5 mb-4 bg-nexo-composer/40">
                  {(["signin", "signup"] as AuthTab[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTab(t)}
                      className={`flex-1 py-2.5 min-h-[44px] rounded-[10px] text-[13px] font-semibold transition-all ${
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
                      className={inputClass}
                      placeholder="Optional"
                      autoComplete="name"
                    />
                  </label>
                )}

                <form
                  onSubmit={tab === "signin" ? handleSignIn : handleSignUp}
                  className="space-y-3"
                >
                  <label className="block text-[12px] text-nexo-muted">
                    Email
                    <input
                      type="email"
                      inputMode="email"
                      autoCapitalize="none"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputClass}
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
                      className={inputClass}
                      placeholder={tab === "signup" ? "At least 8 characters" : "••••••••"}
                      autoComplete={tab === "signin" ? "current-password" : "new-password"}
                      required
                      minLength={tab === "signup" ? 8 : 1}
                    />
                  </label>

                  {error && <p className="text-[13px] text-red-500">{error}</p>}

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full min-h-[48px] py-3 rounded-xl nexo-btn-primary font-semibold text-base sm:text-sm disabled:opacity-50"
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

                <div className="relative my-4">
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
                  className="w-full min-h-[48px] flex items-center justify-center gap-2 py-2.5 rounded-xl border border-nexo-border bg-white text-gray-800 text-base sm:text-sm font-medium disabled:opacity-40 dark:bg-nexo-composer dark:text-nexo-fg"
                >
                  <GoogleIcon />
                  Sign in with Google
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleGuest()}
                  className="mt-3 w-full min-h-[48px] py-2.5 rounded-xl text-[14px] sm:text-[13px] font-medium border border-nexo-border text-nexo-muted"
                >
                  Continue as guest
                </button>
              </div>
            </div>

            {/* Marketing below auth on mobile */}
            <div className="order-2 lg:order-1 mt-8 lg:mt-0 space-y-6">
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border border-nexo-border bg-nexo-composer/60 text-nexo-muted mb-4">
                  <Sparkles className="w-3.5 h-3.5 text-nexo-brand" />
                  Built for NEXOPLUS Automations
                </span>
                <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight tracking-tight text-nexo-fg">
                  Build with <span className="nexo-gradient-text">NEXOPLUS</span> intelligence.
                </h1>
                <p className="mt-3 text-[14px] sm:text-[15px] text-nexo-muted leading-relaxed">
                  Chat, generate projects, import code, and ship to GitHub — in one studio.
                </p>
              </div>

              <ul className="space-y-3 text-[13px] text-nexo-fg/90 lg:hidden">
                <li className="flex gap-2">
                  <span className="text-nexo-brand">•</span>
                  Per-chat workspaces and Monaco editing
                </li>
                <li className="flex gap-2">
                  <span className="text-nexo-brand">•</span>
                  Fast, Smart, and Deep modes
                </li>
                <li className="flex gap-2">
                  <span className="text-nexo-brand">•</span>
                  Git commit and push from the browser
                </li>
              </ul>

              <div className="hidden lg:grid grid-cols-1 gap-3">
                {[
                  "NEXOPLUS Fast · Smart · Deep",
                  "Per-chat workspaces & folder import",
                  "GitHub commit, push, create repo",
                ].map((line) => (
                  <div
                    key={line}
                    className="rounded-2xl border border-nexo-border bg-nexo-sidebar/80 p-4 text-[13px] text-nexo-fg"
                  >
                    {line}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>

        <footer className="shrink-0 py-4 text-center text-[10px] text-nexo-muted border-t border-nexo-border/50 pb-safe">
          © {new Date().getFullYear()} NEXOPLUS Automations · Coimbatore
        </footer>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
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
  );
}
