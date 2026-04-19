import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import About from "./pages/About.tsx";
import Articles from "./pages/Articles.tsx";
import ArticlePage from "./pages/ArticlePage.tsx";
import NotFound from "./pages/NotFound.tsx";
import P from "./pages/P.tsx";
import Reader from "./pages/Reader.tsx";
import AboutV1 from "./pages/AboutV1.tsx";
import AboutV1_1 from "./pages/AboutV1_1.tsx";
import AboutV1_2 from "./pages/AboutV1_2.tsx";
import HomeV1 from "./pages/HomeV1.tsx";
import HomeV2_1 from "./pages/HomeV2_1.tsx";
import HomeV2_2 from "./pages/HomeV2_2.tsx";
import HomeV2_3 from "./pages/HomeV2_3.tsx";
import HomeV2_4 from "./pages/HomeV2_4.tsx";
import HomeV2_4_TextArea from "./pages/HomeV2_4_TextArea.tsx";
import HomeV2_5_TextArea from "./pages/HomeV2_5_TextArea.tsx";
import HomeV2_6_Markdown from "./pages/HomeV2_6_Markdown.tsx";
import HomeV2_7_MdWPlus from "./pages/HomeV2_7_MdWPlus.tsx";
import ArticlesV1 from "./pages/ArticlesV1.tsx";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomeV2_7_MdWPlus />} />
            <Route path="/about" element={<About />} />
            <Route path="/articles" element={<Articles />} />
            <Route path="/article/:articleId" element={<ArticlePage />} />
            <Route path="/reader" element={<Reader />} />
            <Route path="/p" element={<P />} />
            <Route path="/p/home-v1" element={<HomeV1 />} />
            <Route path="/p/home-v2" element={<About />} />
            <Route path="/p/home-v2-1" element={<HomeV2_1 />} />
            <Route path="/p/home-v2-2" element={<HomeV2_2 />} />
            <Route path="/p/home-v2-3" element={<HomeV2_3 />} />
            <Route path="/p/home-v2-4" element={<HomeV2_4 />} />
            <Route path="/p/home-v2-4-text-area" element={<HomeV2_4_TextArea />} />
            <Route path="/p/home-v2-5-text-area" element={<HomeV2_5_TextArea />} />
            <Route path="/p/home-v2-6-markdown" element={<HomeV2_6_Markdown />} />
            <Route path="/p/home-v2-7-md-w-plus" element={<HomeV2_7_MdWPlus />} />
            <Route path="/p/articles-v1" element={<ArticlesV1 />} />
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
