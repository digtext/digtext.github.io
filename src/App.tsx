import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import About from "./pages/About.tsx";
import ArticlePage from "./pages/ArticlePage.tsx";
import ArticleV1 from "./pages/ArticleV1.tsx";
import NotFound from "./pages/NotFound.tsx";
import P from "./pages/P.tsx";
import Reader from "./pages/Reader.tsx";
import AboutV1 from "./pages/AboutV1.tsx";
import AboutV1_1 from "./pages/AboutV1_1.tsx";
import AboutV1_2 from "./pages/AboutV1_2.tsx";
import HomeV1 from "./pages/HomeV1.tsx";
import HomeV2 from "./pages/HomeV2.tsx";
import HomeV2_1 from "./pages/HomeV2_1.tsx";
import HomeV2_2 from "./pages/HomeV2_2.tsx";
import HomeV2_3 from "./pages/HomeV2_3.tsx";
import HomeV2_4 from "./pages/HomeV2_4.tsx";
import HomeV2_4_TextArea from "./pages/HomeV2_4_TextArea.tsx";
import HomeV2_5_TextArea from "./pages/HomeV2_5_TextArea.tsx";
import HomeV2_6_Markdown from "./pages/HomeV2_6_Markdown.tsx";
import HomeV2_7_MdWPlus from "./pages/HomeV2_7_MdWPlus.tsx";
import HomeV2_8_Minimal from "./pages/HomeV2_8_Minimal.tsx";
import HomeV2_9_NoChevrons from "./pages/HomeV2_9_NoChevrons.tsx";
import HomeV2_10_EnterIcon from "./pages/HomeV2_10_EnterIcon.tsx";
import HomeV2_11_NewMinimalStyling from "./pages/HomeV2_11_NewMinimalStyling.tsx";
import HomeV2_11_NewQual from "./pages/HomeV2_11_NewQual.tsx";
import HomeV3_0_NewStyle from "./pages/HomeV3_0_NewStyle.tsx";
import HomeV3_1_InlineBack from "./pages/HomeV3_1_InlineBack.tsx";
import HomeV3_2_AwesomeClosings from "./pages/HomeV3_2_AwesomeClosings.tsx";
import HomeV3_3_PolishedFullscreen from "./pages/HomeV3_3_PolishedFullscreen.tsx";
import PromptPage from "./pages/PromptPage.tsx";
import LlmsTxtPage from "./pages/LlmsTxtPage.tsx";
import ArticlesV1 from "./pages/ArticlesV1.tsx";
import Library from "./pages/ArticlesV2.tsx";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomeV3_3_PolishedFullscreen />} />
            <Route path="/about" element={<About />} />
            <Route path="/library" element={<Library />} />
            <Route path="/articles" element={<Navigate to="/library" replace />} />
            <Route path="/article/:articleId" element={<ArticlePage />} />
            <Route path="/p/article-v1/:articleId" element={<ArticleV1 />} />
            <Route path="/p/article-v1" element={<ArticleV1 />} />
            <Route path="/p/article-v2/:articleId" element={<ArticlePage />} />
            <Route path="/p/article-v2" element={<ArticlePage />} />
            <Route path="/reader" element={<Reader />} />
            <Route path="/prompt" element={<PromptPage />} />
            <Route path="/llms" element={<LlmsTxtPage />} />
            <Route path="/p" element={<P />} />
            <Route path="/p/home-v1" element={<HomeV1 />} />
            <Route path="/p/home-v2" element={<HomeV2 />} />
            <Route path="/p/home-v2-1" element={<HomeV2_1 />} />
            <Route path="/p/home-v2-2" element={<HomeV2_2 />} />
            <Route path="/p/home-v2-3" element={<HomeV2_3 />} />
            <Route path="/p/home-v2-4" element={<HomeV2_4 />} />
            <Route path="/p/home-v2-4-text-area" element={<HomeV2_4_TextArea />} />
            <Route path="/p/home-v2-5-text-area" element={<HomeV2_5_TextArea />} />
            <Route path="/p/home-v2-6-markdown" element={<HomeV2_6_Markdown />} />
            <Route path="/p/home-v2-7-md-w-plus" element={<HomeV2_7_MdWPlus />} />
            <Route path="/p/home-v2-8-minimal" element={<HomeV2_8_Minimal />} />
            <Route path="/p/home-v2-9-no-chevrons" element={<HomeV2_9_NoChevrons />} />
            <Route path="/p/home-v2-10-enter-icon" element={<HomeV2_10_EnterIcon />} />
            <Route path="/p/home-v2-11-new-minimal-styling" element={<HomeV2_11_NewMinimalStyling />} />
            <Route path="/p/home-v2-11-new-qual" element={<HomeV2_11_NewQual />} />
            <Route path="/p/home-v3-0-new-style" element={<HomeV3_0_NewStyle />} />
            <Route path="/p/home-v3-1-inline-back" element={<HomeV3_1_InlineBack />} />
            <Route path="/p/home-v3-2-awesome-closings" element={<HomeV3_2_AwesomeClosings />} />
            <Route path="/p/home-v3-3-polished-fullscreen" element={<HomeV3_3_PolishedFullscreen digSourceUrl="/dig/home-v3-3.md" />} />
            <Route path="/p/articles-v1" element={<ArticlesV1 />} />
            <Route path="/p/articles-v2" element={<Library />} />
            <Route path="/p/about-v1" element={<AboutV1 />} />
            <Route path="/p/about-v1-1" element={<AboutV1_1 />} />
            <Route path="/p/about-v1-2" element={<AboutV1_2 />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
