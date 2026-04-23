import { Link } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";

type Version = { label: string; to: string; live?: boolean };
type Group = { title: string; versions: Version[] };

const groups: Group[] = [
  {
    title: "Home",
    versions: [
      { label: "Home v1", to: "/p/home-v1" },
      { label: "Home v2", to: "/p/home-v2" },
      { label: "Home v2.1 (bullet)", to: "/p/home-v2-1" },
      { label: "Home v2.2 (preview)", to: "/p/home-v2-2" },
      { label: "Home v2.3 (no input)", to: "/p/home-v2-3" },
      { label: "Home v2.4 (not text-area)", to: "/p/home-v2-4" },
      { label: "Home v2.5 (text-area)", to: "/p/home-v2-5-text-area" },
      { label: "Home v2.6 (markdown)", to: "/p/home-v2-6-markdown" },
      { label: "Home v2.7 (md w plus)", to: "/p/home-v2-7-md-w-plus" },
      { label: "Home v2.8 (minimal)", to: "/p/home-v2-8-minimal" },
      { label: "Home v2.9 (no-chevrons)", to: "/p/home-v2-9-no-chevrons" },
      { label: "Home v2.10 (enter-icon)", to: "/p/home-v2-10-enter-icon" },
      { label: "Home v2.11 (new minimal styling)", to: "/p/home-v2-11-new-minimal-styling" },
      { label: "Home v2.11 (new-qual)", to: "/p/home-v2-11-new-qual" },
      { label: "Home v3.0 (new-style)", to: "/p/home-v3-0-new-style" },
      { label: "Home v3.1 (inline back)", to: "/p/home-v3-1-inline-back" },
      { label: "Home v3.2 (awesome closings)", to: "/p/home-v3-2-awesome-closings" },
      { label: "Home v3.3 (polished fullscreen)", to: "/", live: true },
    ],
  },
  {
    title: "Library",
    versions: [
      { label: "Library v1", to: "/p/articles-v1" },
      { label: "Library v2 (minimal)", to: "/library", live: true },
    ],
  },
  {
    title: "About (deprecated)",
    versions: [
      { label: "About v1", to: "/p/about-v1" },
      { label: "About v1.1", to: "/p/about-v1-1" },
      { label: "About v1.2", to: "/p/about-v1-2" },
    ],
  },
];

const LivePill = () => (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-sans text-[10px] font-medium uppercase tracking-wider text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-400">
    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
    live
  </span>
);

const P = () => (
  <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
    <SiteHeader />
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="font-serif text-2xl mb-10 text-neutral-400 dark:text-neutral-500">Pages</h1>

      <div className="flex flex-col gap-10">
        {groups.map((group) => (
          <section key={group.title}>
            <h2 className="font-sans text-[10px] tracking-[0.25em] uppercase text-neutral-400 dark:text-neutral-500 mb-3">
              {group.title}
            </h2>
            <ul className="flex flex-col gap-2">
              {group.versions.map(({ label, to, live }) => (
                <li key={to} className="flex items-center gap-3">
                  <Link
                    to={to}
                    className="font-sans text-sm text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-50 transition-colors"
                  >
                    {label}
                  </Link>
                  {live && <LivePill />}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  </div>
);

export default P;
