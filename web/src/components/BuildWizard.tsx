import { useState } from "react";
import { Rocket, X } from "lucide-react";
import clsx from "clsx";

const STACKS = [
  { id: "react-vite", label: "React + Vite", desc: "Modern SPA frontend" },
  { id: "next", label: "Next.js", desc: "Full-stack React" },
  { id: "express", label: "Node + Express", desc: "REST API backend" },
  { id: "fullstack", label: "Express + React", desc: "API + frontend" },
  { id: "static", label: "HTML / CSS / JS", desc: "Lightweight static site" },
  { id: "python-api", label: "Python API", desc: "FastAPI-style structure" },
];

const DEPLOY = [
  { id: "local", label: "Local / dev only" },
  { id: "docker", label: "Docker container" },
  { id: "vps", label: "VPS (Linux server)" },
  { id: "vercel", label: "Vercel / static host" },
  { id: "railway", label: "Railway / PaaS" },
];

interface BuildWizardProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (prompt: string, autoSend?: boolean) => void;
}

export function buildWizardPrompt(opts: {
  name: string;
  description: string;
  stack: string;
  deploy: string;
}): string {
  const stackLabel = STACKS.find((s) => s.id === opts.stack)?.label ?? opts.stack;
  const deployLabel = DEPLOY.find((d) => d.id === opts.deploy)?.label ?? opts.deploy;

  return `Build a complete project for NEXOPLUS workspace.

**App name:** ${opts.name}
**What it does:** ${opts.description}
**Stack:** ${stackLabel}
**Deploy target:** ${deployLabel}

Requirements:
1. Create ALL necessary files using path fences (\`\`\`path/to/file\`\`\`) in your response.
2. Include README with setup and run instructions for ${deployLabel}.
3. Use production-ready structure, error handling, and sensible defaults.
4. Start with core files, then supporting config — every file must be complete (no placeholders).

Begin scaffolding now.`;
}

export function BuildWizard({ open, onClose, onSubmit }: BuildWizardProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [stack, setStack] = useState("fullstack");
  const [deploy, setDeploy] = useState("local");

  if (!open) return null;

  const canNext = step === 0 ? name.trim().length > 1 : step === 1 ? description.trim().length > 5 : true;

  const finish = () => {
    onSubmit(
      buildWizardPrompt({
        name: name.trim(),
        description: description.trim(),
        stack,
        deploy,
      }),
      true
    ); // auto-send to NEXOPLUS
    onClose();
    setStep(0);
    setName("");
    setDescription("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-nexo-border nexo-glass bg-nexo-sidebar shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-nexo-border">
          <div className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-nexo-brand" />
            <h2 className="font-display text-sm font-semibold">Build my app</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-md hover:bg-nexo-hover">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex gap-2">
            {["Name", "Details", "Stack"].map((label, i) => (
              <div
                key={label}
                className={clsx(
                  "flex-1 h-1 rounded-full transition-colors",
                  i <= step ? "bg-nexo-brand" : "bg-nexo-border"
                )}
              />
            ))}
          </div>

          {step === 0 && (
            <div>
              <label className="text-[12px] text-nexo-muted">App name</label>
              <input
                className="mt-1 w-full rounded-xl border border-nexo-border bg-nexo-composer px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-nexo-brand"
                placeholder="e.g. TaskFlow, ShopLite"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
          )}

          {step === 1 && (
            <div>
              <label className="text-[12px] text-nexo-muted">What should it do?</label>
              <textarea
                className="mt-1 w-full rounded-xl border border-nexo-border bg-nexo-composer px-3 py-2.5 text-sm min-h-[100px] focus:outline-none focus:ring-1 focus:ring-nexo-brand"
                placeholder="Describe features, users, and must-have screens…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          )}

          {step === 2 && (
            <>
              <div>
                <p className="text-[12px] text-nexo-muted mb-2">Technology stack</p>
                <div className="grid grid-cols-2 gap-2">
                  {STACKS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStack(s.id)}
                      className={clsx(
                        "text-left px-3 py-2 rounded-xl border text-[12px] transition-all",
                        stack === s.id
                          ? "border-nexo-brand bg-nexo-brand/15 text-nexo-fg"
                          : "border-nexo-border hover:bg-nexo-hover text-nexo-muted"
                      )}
                    >
                      <span className="font-medium block">{s.label}</span>
                      <span className="text-[10px] opacity-80">{s.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[12px] text-nexo-muted mb-2">Deploy target</p>
                <div className="flex flex-wrap gap-2">
                  {DEPLOY.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDeploy(d.id)}
                      className={clsx(
                        "px-3 py-1.5 rounded-full text-[11px] border transition-all",
                        deploy === d.id
                          ? "border-nexo-brand bg-nexo-brand text-white"
                          : "border-nexo-border text-nexo-muted hover:bg-nexo-hover"
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-between px-5 py-4 border-t border-nexo-border">
          <button
            type="button"
            onClick={() => (step > 0 ? setStep(step - 1) : onClose())}
            className="text-[12px] text-nexo-muted hover:text-nexo-fg"
          >
            {step === 0 ? "Cancel" : "Back"}
          </button>
          {step < 2 ? (
            <button
              type="button"
              disabled={!canNext}
              onClick={() => setStep(step + 1)}
              className="px-4 py-2 rounded-xl nexo-btn-primary text-[12px] font-semibold disabled:opacity-30"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={finish}
              className="px-4 py-2 rounded-xl nexo-btn-primary text-[12px] font-semibold"
            >
              Generate with NEXOPLUS
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
