import { FallbackImage } from "@/components/fallback-image";

export function RichBodyImageGrid({
  images,
  altPrefix,
}: {
  images: string[];
  altPrefix: string;
}) {
  if (images.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {images.map((src, i) => (
        <div key={src} className="aspect-[4/3] overflow-hidden rounded-2xl">
          <FallbackImage
            src={src}
            alt={`${altPrefix} ${i + 1}`}
            className="h-full w-full object-cover"
          />
        </div>
      ))}
    </div>
  );
}
