"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useSwipeX } from "@/lib/use-swipe";

export function ImageLightbox({
  images,
  index,
  altPrefix,
  onClose,
  onIndexChange,
}: {
  images: string[];
  index: number;
  altPrefix: string;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // 네이티브 <dialog>.showModal()이 포커스 트랩·top-layer 렌더링을 기본 제공한다(confirm-dialog 와 동일 패턴).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    dialog.addEventListener("cancel", onCancel);
    dialog.showModal();
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.removeEventListener("cancel", onCancel);
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const many = images.length > 1;
  const prev = () => onIndexChange((index - 1 + images.length) % images.length);
  const next = () => onIndexChange((index + 1) % images.length);
  const swipeHandlers = useSwipeX({ onSwipeLeft: next, onSwipeRight: prev });

  return (
    <dialog
      ref={dialogRef}
      aria-label="이미지 크게 보기"
      className="m-auto h-full max-h-full w-full max-w-full bg-transparent p-0 backdrop:bg-black/90"
      onKeyDown={(e) => {
        if (!many) return;
        if (e.key === "ArrowLeft") prev();
        if (e.key === "ArrowRight") next();
      }}
      onClick={(e) => {
        // 이미지·버튼 밖(어두운 영역) 클릭 시 닫는다.
        if (e.target === e.currentTarget) onClose();
      }}
      {...(many ? swipeHandlers : {})}
    >
      <div className="pointer-events-none flex h-full w-full items-center justify-center p-4 sm:p-10">
        <img
          src={images[index]}
          alt={`${altPrefix} ${index + 1}`}
          className="pointer-events-auto max-h-full max-w-full rounded-xl object-contain"
        />
      </div>
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="크게 보기 닫기"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full"
        style={{ background: "rgba(15,31,34,0.6)", color: "#fff" }}
      >
        <X size={20} aria-hidden />
      </button>
      {many && (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="크게 보기 이전 사진"
            className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full"
            style={{ background: "rgba(15,31,34,0.6)", color: "#fff" }}
          >
            <ChevronLeft size={20} aria-hidden />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="크게 보기 다음 사진"
            className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full"
            style={{ background: "rgba(15,31,34,0.6)", color: "#fff" }}
          >
            <ChevronRight size={20} aria-hidden />
          </button>
          <span
            aria-live="polite"
            className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[13px]"
            style={{ background: "rgba(15,31,34,0.6)", color: "#fff" }}
          >
            {index + 1} / {images.length}
          </span>
        </>
      )}
    </dialog>
  );
}
