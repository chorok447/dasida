import { FallbackImage } from "@/components/fallback-image";

export function RichBodyImageGrid({
  images,
  altPrefix,
  onImageClick,
}: {
  images: string[];
  altPrefix: string;
  /** 지정하면 각 이미지가 버튼이 되어 클릭 시 해당 인덱스를 넘긴다(라이트박스 열기 등). */
  onImageClick?: (index: number) => void;
}) {
  if (images.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {images.map((src, i) => {
        const image = (
          <FallbackImage
            src={src}
            alt={`${altPrefix} ${i + 1}`}
            className="h-full w-full object-cover"
            priority={i === 0}
          />
        );
        return (
          <div key={src} className="aspect-[4/3] overflow-hidden rounded-2xl">
            {onImageClick ? (
              <button
                type="button"
                onClick={() => onImageClick(i)}
                aria-label={`${altPrefix} ${i + 1} 크게 보기`}
                className="block h-full w-full cursor-zoom-in"
              >
                {image}
              </button>
            ) : (
              image
            )}
          </div>
        );
      })}
    </div>
  );
}
