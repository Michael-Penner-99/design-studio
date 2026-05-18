export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const owner = process.env.GITHUB_REPO_OWNER || "Michael-Penner-99";
  const repo = process.env.GITHUB_REPO_NAME || "design-studio";
  const branch = process.env.GITHUB_DEFAULT_BRANCH || "main";
  const factoryDomain =
    process.env.NEXT_PUBLIC_FACTORY_DOMAIN || "actiondesignstudio.com";
  const version = process.env.npm_package_version || "0.1.0";
  const tokenPresent = Boolean(process.env.GITHUB_TOKEN);
  const formTokenPresent = Boolean(process.env.FORM_SUBMIT_TOKEN);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Read-only view of how this operator app is wired. To change values, edit
          the Vercel project environment variables and redeploy.
        </p>
      </div>

      <section className="card space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          GitHub
        </h2>
        <Item
          label="Repo"
          value={
            <a
              href={`https://github.com/${owner}/${repo}`}
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:text-accent-light"
            >
              github.com/{owner}/{repo}
            </a>
          }
        />
        <Item label="Branch" value={<span className="font-mono">{branch}</span>} />
        <Item
          label="GITHUB_TOKEN"
          value={
            tokenPresent ? (
              <span className="text-emerald-300">configured</span>
            ) : (
              <span className="text-rose-300">missing</span>
            )
          }
        />
      </section>

      <section className="card space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Vercel deployment
        </h2>
        <Item label="Domain" value={`factory.${factoryDomain}`} />
        <Item label="Project" value="factory-actiondesignstudio" />
        <Item
          label="Auth"
          value="Vercel Password Protection (Settings → Deployment Protection)"
        />
        <Item
          label="FORM_SUBMIT_TOKEN"
          value={
            formTokenPresent ? (
              <span className="text-emerald-300">configured</span>
            ) : (
              <span className="text-rose-300">missing</span>
            )
          }
        />
      </section>

      <section className="card space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          App
        </h2>
        <Item label="Version" value={<span className="font-mono">{version}</span>} />
        <Item
          label="Mode"
          value="Single operator · single worker · no DB (repo-as-message-bus)"
        />
      </section>
    </div>
  );
}

function Item({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-xs uppercase tracking-wider text-muted">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
