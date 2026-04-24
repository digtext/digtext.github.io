import { useParams } from "react-router-dom";
import HomeV3_3_PolishedFullscreen from "@/pages/HomeV3_3_PolishedFullscreen";
import { articles, getArticleById } from "@/content/articles";
import NotFound from "./NotFound";

// The live article view reuses the same composer/reader as the Home page
// (via HomeV3_3_PolishedFullscreen in article mode). This keeps one source of
// truth for how dig text is read and composed — any improvement to the home
// composer shows up here too.
const ArticlePage = () => {
  const { articleId } = useParams();
  // Fallback to the first active article so the /p/article-v2 preview route
  // renders a demo even without an :articleId.
  const article =
    getArticleById(articleId) ?? articles.find((a) => a.active && a.content);

  if (!article?.active || !article.content) {
    return <NotFound />;
  }

  return (
    <HomeV3_3_PolishedFullscreen
      articleMode
      articleInitialText={article.content}
      articleBackTo="/library"
      articleBackLabel="Library"
    />
  );
};

export default ArticlePage;
