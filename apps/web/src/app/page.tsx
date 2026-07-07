import { Hero3D } from "@/components/hero-3d";
import { TiltCardGrid } from "@/components/tilt-card-grid";
import { Carousel3D } from "@/components/carousel-3d";
import { LandingStats } from "@/components/landing-stats";
import { LandingFlow } from "@/components/landing-flow";

// 랜딩 내러티브: 감탄(Hero) → 소개(Tilt) → 설득(Stats) → 사례(Carousel) → 행동(Flow/CTA)
export default function Home() {
  return (
    <>
      <Hero3D />
      <TiltCardGrid />
      <LandingStats />
      <Carousel3D />
      <LandingFlow />
    </>
  );
}
