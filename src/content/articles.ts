export interface Article {
  id: string;
  title: string;
  subtitle: string;
  source: string;
  date: string;
  readTime?: string;
  active: boolean;
  content?: string;
  externalUrl?: string;
}

// Frontmatter parser — supports simple `key: value` lines between `---` fences.
// Kept small on purpose; avoid adding a dependency.
const parseFrontmatter = (raw: string): { data: Record<string, string>; body: string } => {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };
  const data: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([a-zA-Z_][\w-]*):\s*(.*)$/);
    if (m) data[m[1]] = m[2].trim();
  }
  return { data, body: match[2] };
};

const slugFromPath = (path: string) => {
  const file = path.split("/").pop() ?? "";
  return file.replace(/\.md$/, "");
};

// Auto-discover articles from src/content/library/*.md.
// The archive subfolder is intentionally excluded from the glob so archived
// articles don't appear in the library UI.
const libraryModules = import.meta.glob(
  "/src/content/library/*.md",
  { eager: true, query: "?raw", import: "default" },
) as Record<string, string>;

const loadedArticles: Article[] = Object.entries(libraryModules).map(
  ([path, raw]) => {
    const { data, body } = parseFrontmatter(raw);
    return {
      id: (data.id ?? slugFromPath(path)).trim(),
      title: data.title ?? slugFromPath(path),
      subtitle: data.subtitle ?? "",
      source: data.source ?? "",
      date: data.date ?? "",
      readTime: data.readTime,
      active: true,
      content: body.trim(),
    };
  },
);

// Grayed-out library entries — references the reader can explore elsewhere.
// Order controls how they appear in the library below featured articles.
const grayedOutArticles: Article[] = [
  {
    id: "augmenting-long-term-memory",
    title: "Augmenting Long-term Memory",
    subtitle:
      "How to use spaced repetition systems like Anki to remember almost anything",
    source: "Michael Nielsen",
    date: "",
    active: false,
    externalUrl: "https://augmentingcognition.com/ltm.html",
  },
  {
    id: "happiness-and-life-satisfaction",
    title: "Happiness and Life Satisfaction",
    subtitle:
      "Cross-country data on self-reported life satisfaction and the link between income and happiness",
    source: "Esteban Ortiz-Ospina, Max Roser",
    date: "",
    active: false,
    externalUrl: "https://ourworldindata.org/happiness-and-life-satisfaction",
  },
  {
    id: "aligning-recommender-systems",
    title: "Aligning Recommender Systems as Cause Area",
    subtitle:
      "Improving the alignment of recommender systems with user values as an EA cause area",
    source: "Ivan Vendrov",
    date: "",
    active: false,
    externalUrl:
      "https://forum.effectivealtruism.org/posts/xzjQvqDYahigHcwgQ/aligning-recommender-systems-as-cause-area",
  },
  {
    id: "meditations-on-moloch",
    title: "Meditations On Moloch",
    subtitle:
      "Multipolar traps, coordination failures, and the forces that prevent humanity from optimizing for what it actually wants",
    source: "Scott Alexander",
    date: "",
    active: false,
    externalUrl: "https://www.slatestarcodexabridged.com/Meditations-On-Moloch",
  },
  {
    id: "democracy",
    title: "Democracy",
    subtitle:
      "How democracy has spread across countries and whether we are moving towards a more democratic world",
    source: "Bastian Herre, Max Roser",
    date: "",
    active: false,
    externalUrl: "https://ourworldindata.org/democracy",
  },
];

export const articles: Article[] = [...loadedArticles, ...grayedOutArticles];

export function getArticleById(articleId?: string) {
  return articles.find((article) => article.id === articleId);
}
