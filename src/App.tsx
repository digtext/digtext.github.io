import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "./pages/Home.tsx";
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
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/articles" element={<Articles />} />
            <Route path="/article/:articleId" element={<ArticlePage />} />
            <Route path="/reader" element={<Reader />} />
            <Route path="/p" element={<P />} />
            <Route path="/p/home-v1" element={<HomeV1 />} />
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
