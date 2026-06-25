import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Hero3D } from "./components/hero-3d";
import { TiltCardGrid } from "./components/tilt-card-grid";
import { Carousel3D } from "./components/carousel-3d";
import { ThemeToggle } from "./components/theme-toggle";
import { SiteHeader } from "./components/site-header";
import { ThemeProvider, useTheme } from "./theme-context";
import { LoginPage } from "./pages/login";
import { SignupPage } from "./pages/signup";
import { MyPage } from "./pages/mypage";
import { ProfileEditPage } from "./pages/profile-edit";
import { NotFoundPage } from "./pages/not-found";
import { LogosPage } from "./pages/logos";
import { CampaignListPage } from "./pages/campaign-list";
import { CampaignDetailPage } from "./pages/campaign-detail";
import { HomeFeedPage } from "./pages/home-feed";
import { PostDetailPage } from "./pages/post-detail";
import { PostCreatePage } from "./pages/post-create";
import { CampaignCreatePage } from "./pages/campaign-create";
import { NotificationsPage } from "./pages/notifications";

type Page =
  | "home"
  | "login"
  | "signup"
  | "mypage"
  | "profile"
  | "logos"
  | "notfound"
  | "campaigns"
  | "campaign-detail"
  | "home-feed"
  | "post-detail"
  | "post-create"
  | "campaign-create"
  | "notifications";

function Footer() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return (
    <footer
      className="py-10 px-8 transition-colors"
      style={{ background: dark ? "#0f1f22" : "#1c4044", color: "rgba(255,255,255,0.6)" }}
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <p style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 22, color: "#7dd3a3" }}>다시, 다</p>
        <p className="text-[12px] tracking-[0.3em] uppercase">© 2026 Upcycle Project · 서비스 소개 · 팀 소개</p>
      </div>
    </footer>
  );
}

function HomePage() {
  return (
    <>
      <Hero3D />
      <TiltCardGrid />
      <Carousel3D />
    </>
  );
}

function Shell() {
  const { theme } = useTheme();
  const [page, setPage] = useState<Page>("home");
  const [campaignId, setCampaignId] = useState<string>("c1");
  const [postId, setPostId] = useState<string>("p1");

  const openCampaign = (id: string) => {
    setCampaignId(id);
    setPage("campaign-detail");
  };
  const openPost = (id: string) => {
    setPostId(id);
    setPage("post-detail");
  };

  return (
    <div
      className="relative w-full transition-colors"
      style={{ position: "relative", background: theme === "dark" ? "#0f1f22" : "#f9f7f2" }}
    >
      <SiteHeader page={page} setPage={setPage} />
      <ThemeToggle />
      <AnimatePresence mode="wait">
        <motion.div
          key={page + (page === "campaign-detail" ? campaignId : page === "post-detail" ? postId : "")}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4 }}
          style={{ position: "relative" }}
        >
          {page === "home" && <HomePage />}
          {page === "login" && <LoginPage goSignup={() => setPage("signup")} />}
          {page === "signup" && <SignupPage goLogin={() => setPage("login")} />}
          {page === "mypage" && <MyPage />}
          {page === "profile" && <ProfileEditPage />}
          {page === "logos" && <LogosPage />}
          {page === "campaigns" && (
            <CampaignListPage openCampaign={openCampaign} openCreate={() => setPage("campaign-create")} />
          )}
          {page === "campaign-detail" && (
            <CampaignDetailPage id={campaignId} goBack={() => setPage("campaigns")} />
          )}
          {page === "campaign-create" && <CampaignCreatePage goBack={() => setPage("campaigns")} />}
          {page === "home-feed" && <HomeFeedPage openPost={openPost} openCreate={() => setPage("post-create")} />}
          {page === "post-detail" && <PostDetailPage id={postId} goBack={() => setPage("home-feed")} />}
          {page === "post-create" && <PostCreatePage goBack={() => setPage("home-feed")} />}
          {page === "notifications" && <NotificationsPage />}
          {page === "notfound" && <NotFoundPage goHome={() => setPage("home")} />}
        </motion.div>
      </AnimatePresence>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Shell />
    </ThemeProvider>
  );
}
