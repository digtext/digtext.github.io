import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Check, Share } from "lucide-react";

const SiteHeader = () => {
  const { pathname } = useLocation();
  const isArticles =
    pathname.startsWith("/articles") || pathname.startsWith("/article/");
  const isHome =
    pathname === "/" || pathname.startsWith("/reader") || pathname.startsWith("/about");

  const [shared, setShared] = useState(false);

  const handleShare = async () => {
    const data = {
      title: "Dig text",
      text: "Read text collapsed-first. Dig only as deep as you want.",
      url: window.location.href,
    };
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share(data);
      } catch {
        /* user cancelled */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(data.url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const linkBase =
    "px-3 py-1.5 rounded-full font-sans text-sm transition-all";
  const inactive =
    "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-neutral-50 dark:hover:bg-neutral-800";
  const active =
    "text-neutral-900 font-medium dark:text-neutral-50";

  const navItem = (to: string, label: string, isActive: boolean) =>
    isActive ? (
      <span className={`${linkBase} ${active}`}>{label}</span>
    ) : (
      <Link to={to} className={`${linkBase} ${inactive}`}>
        {label}
      </Link>
    );

  const ctaClass =
    "ml-1 inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-1.5 font-sans text-sm text-white hover:bg-neutral-700 transition-colors dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200";

  return (
    <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-neutral-100 dark:bg-neutral-950/80 dark:border-neutral-800">
      <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <Link
          to="/"
          className="flex items-center gap-2 text-neutral-900 dark:text-neutral-50"
        >
          <svg
            aria-hidden
            viewBox="0 0 15 15"
            className="h-5 w-5 relative -top-[3px] left-[1px]"
            fill="currentColor"
          >
            <path opacity="0.05" fillRule="evenodd" clipRule="evenodd" d="M12.1399 3.88623C13.8554 4.94166 15.0001 6.83707 15.0001 9.00007C15.0001 12.3137 12.3138 15.0001 9.00008 15.0001C6.84357 15.0001 4.95302 13.8622 3.89575 12.1553L4.32082 11.892C5.29075 13.4579 7.02382 14.5001 9.00008 14.5001C12.0376 14.5001 14.5001 12.0376 14.5001 9.00007C14.5001 7.01787 13.4516 5.28033 11.8779 4.31209L12.1399 3.88623Z" />
            <path opacity="0.2" fillRule="evenodd" clipRule="evenodd" d="M12.851 5.07324C13.8684 6.07109 14.5 7.46203 14.5 9.00003C14.5 12.0376 12.0376 14.5 9.00004 14.5C7.46215 14.5 6.07132 13.8685 5.07349 12.8513L5.43043 12.5011C6.3381 13.4265 7.60186 14 9.00004 14C11.7614 14 14 11.7614 14 9.00003C14 7.60174 13.4264 6.33789 12.5009 5.4302L12.851 5.07324Z" />
            <path opacity="0.35" fillRule="evenodd" clipRule="evenodd" d="M13.3022 6.45081C13.7456 7.19747 14.0001 8.06945 14.0001 9.0001C14.0001 11.7615 11.7615 14.0001 9.00008 14.0001C8.04874 14.0001 7.15874 13.7342 6.40125 13.2724L6.66148 12.8455C7.34281 13.2608 8.14312 13.5001 9.00008 13.5001C11.4853 13.5001 13.5001 11.4854 13.5001 9.0001C13.5001 8.16174 13.2711 7.37763 12.8723 6.70609L13.3022 6.45081Z" />
            <path opacity="0.5" fillRule="evenodd" clipRule="evenodd" d="M13.3745 7.94031C13.4566 8.28041 13.5 8.63535 13.5 9.0001C13.5 11.4854 11.4853 13.5001 9.00003 13.5001C8.61104 13.5001 8.23323 13.4507 7.87268 13.3577L7.99759 12.8735C8.31768 12.9561 8.65353 13.0001 9.00003 13.0001C11.2091 13.0001 13 11.2092 13 9.0001C13 8.67518 12.9613 8.35962 12.8884 8.05766L13.3745 7.94031Z" />
            <path opacity="0.65" fillRule="evenodd" clipRule="evenodd" d="M12.9156 9.82142C12.5899 11.3814 11.3563 12.6073 9.79211 12.9216L9.6936 12.4314C11.0614 12.1566 12.1413 11.0835 12.4261 9.71924L12.9156 9.82142Z" />
            <path fillRule="evenodd" clipRule="evenodd" d="M1.2771 7.50259C1.2771 4.06462 4.06413 1.27759 7.5021 1.27759C10.94 1.27759 13.7271 4.06462 13.7271 7.50259C13.7271 10.9405 10.94 13.7276 7.5021 13.7276C4.06413 13.7276 1.2771 10.9405 1.2771 7.50259ZM7.5021 2.22759C4.5888 2.22759 2.2271 4.58929 2.2271 7.50259C2.2271 10.4159 4.5888 12.7776 7.5021 12.7776C10.4154 12.7776 12.7771 10.4159 12.7771 7.50259C12.7771 4.58929 10.4154 2.22759 7.5021 2.22759Z" />
            <path d="M6.77218 10.1736C6.60522 10.1736 6.48627 10.1339 6.41531 10.0546C6.34435 9.97112 6.32348 9.87303 6.3527 9.76034L7.68001 4.87686C7.7134 4.76833 7.79061 4.67651 7.91166 4.60138C8.0327 4.52207 8.1767 4.48242 8.34366 4.48242C8.51479 4.4866 8.63374 4.52834 8.70053 4.60764C8.76731 4.68694 8.78401 4.78086 8.75061 4.88938L7.42957 9.77912C7.39618 9.88764 7.32105 9.98155 7.20418 10.0609C7.08731 10.1402 6.94331 10.1777 6.77218 10.1736ZM4.65601 7.3186C4.69774 7.16416 4.77496 7.04312 4.88766 6.95547C5.00453 6.86781 5.12557 6.82399 5.25079 6.82399H10.1969C10.3221 6.82399 10.4139 6.86781 10.4724 6.95547C10.5308 7.04312 10.5391 7.16416 10.4974 7.3186C10.4515 7.47303 10.3617 7.59199 10.2282 7.67547C10.0946 7.75894 9.95896 7.80068 9.82122 7.80068H5.04418C4.88974 7.80068 4.77496 7.75894 4.69983 7.67547C4.6247 7.59199 4.61009 7.47303 4.65601 7.3186Z" />
          </svg>
          <span className="font-serif italic text-xl leading-none">
            Dig text
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <nav className="flex items-center gap-1">
            {navItem("/", "Home", isHome)}
            {navItem("/articles", "Articles", isArticles)}
          </nav>

          <button onClick={handleShare} className={ctaClass}>
            {shared ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Link copied
              </>
            ) : (
              <>
                <Share className="h-3.5 w-3.5" />
                Share
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

export default SiteHeader;
