import { Hero3D } from "@/components/hero-3d";
import { TiltCardGrid } from "@/components/tilt-card-grid";
import { Carousel3D } from "@/components/carousel-3d";

export function HomeShell() {
  return (
    <>
      <Hero3D />
      <TiltCardGrid />
      <Carousel3D />
    </>
  );
}
