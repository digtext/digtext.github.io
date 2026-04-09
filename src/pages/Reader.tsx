import SiteHeader from "@/components/SiteHeader";
import DigTextReader from "@/components/DigTextReader";
import { ABOUT_DEMO_CONTENT } from "@/content/aboutDemoContent";

const Reader = () => (
  <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
    <SiteHeader />
    <section className="relative min-h-[calc(100dvh-74px)] overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
      >
        <div
          className="absolute -top-24 -right-24 h-[600px] w-[600px] rounded-full opacity-40 blur-[120px]"
          style={{
            background:
              "radial-gradient(circle, rgba(251,191,36,0.5) 0%, rgba(244,63,94,0.35) 40%, rgba(139,92,246,0.3) 70%, transparent 80%)",
          }}
        />
        <div
          className="absolute -bottom-20 -left-20 h-[400px] w-[400px] rounded-full opacity-25 blur-[100px]"
          style={{
            background:
              "radial-gradient(circle, rgba(139,92,246,0.5) 0%, rgba(244,63,94,0.2) 60%, transparent 80%)",
          }}
        />
      </div>

      <div className="relative mx-auto h-[calc(100dvh-74px)] md:max-w-4xl md:px-6 md:py-4">
        <DigTextReader content={ABOUT_DEMO_CONTENT} mode="fullscreen" />
      </div>
    </section>
  </div>
);

export default Reader;
