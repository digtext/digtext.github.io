import { Link } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";

const links = [
  { label: "About v1", to: "/p/about-v1" },
];

const P = () => (
  <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
    <SiteHeader />
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="font-serif text-2xl mb-8 text-neutral-400 dark:text-neutral-500">Pages</h1>
      <ul className="flex flex-col gap-2">
        {links.map(({ label, to }) => (
          <li key={to}>
            <Link
              to={to}
              className="font-sans text-sm text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-50 transition-colors"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

export default P;
