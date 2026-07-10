"use client";

import { useState } from "react";
import { ImageLightbox } from "@/components/image-lightbox";
import { RichBodyImageGrid } from "@/components/rich-body-image-grid";
import { PostText } from "@/components/post-text";
import type { Campaign } from "@/data/campaigns";

export function CampaignContentTab({ c }: { c: Campaign }) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  return (
    <div
      className="rounded-3xl border p-10 space-y-8"
      style={{
        background: "var(--card)",
        borderColor: "var(--border)",
      }}
    >
      <h2 style={{ fontFamily: "var(--font-black-han), sans-serif", fontSize: 26, color: "var(--foreground)" }}>
        {c.body.heading}
      </h2>
      {c.body.paragraphs.map((p, i) => (
        <PostText
          key={i}
          text={p}
          style={{ color: "var(--foreground-muted)", lineHeight: 1.8 }}
        />
      ))}
      <RichBodyImageGrid images={c.body.images} altPrefix="캠페인 상세 이미지" onImageClick={setLightboxIdx} />
      {lightboxIdx !== null && (
        <ImageLightbox
          images={c.body.images}
          index={lightboxIdx}
          altPrefix="캠페인 상세 이미지"
          onClose={() => setLightboxIdx(null)}
          onIndexChange={setLightboxIdx}
        />
      )}
    </div>
  );
}
