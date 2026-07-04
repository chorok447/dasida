"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Unlink,
} from "lucide-react";
import { uploadMedia, uploadMediaErrorMessage } from "@/lib/upload-media";
import { PostText } from "@/components/post-text";

export type RichTextEditorProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  placeholder?: string;
  minHeight?: number;
  required?: boolean;
  disabled?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

function normalizeEditorHtml(html: string): string {
  const trimmed = html.trim();
  if (!trimmed || trimmed === "<p></p>") return "";
  return trimmed;
}

function ToolbarButton({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--accent-soft)] disabled:opacity-40"
      style={{
        color: active ? "var(--accent-secondary)" : "var(--foreground)",
        background: active ? "var(--accent-soft)" : undefined,
      }}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({
  id,
  value,
  onChange,
  maxLength,
  placeholder = "내용을 입력해주세요",
  minHeight = 120,
  required,
  disabled,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: RichTextEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadingRef = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [textLength, setTextLength] = useState(() => richTextLengthFallback(value));
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({ heading: false }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Image.configure({ inline: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    onUpdate: ({ editor: current }) => {
      const len = current.getText().trim().length;
      if (len > maxLength) {
        current.commands.undo();
        return;
      }
      setTextLength(len);
      onChange(normalizeEditorHtml(current.getHTML()));
    },
    editorProps: {
      attributes: {
        id,
        class: "tiptap-editor focus:outline-none",
        "aria-invalid": ariaInvalid ? "true" : "false",
        "aria-required": required ? "true" : "false",
        style: `min-height:${minHeight}px`,
        ...(ariaDescribedBy ? { "aria-describedby": ariaDescribedBy } : {}),
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor) return;
    const incoming = value.trim();
    const current = normalizeEditorHtml(editor.getHTML());
    if (incoming === current) return;
    editor.commands.setContent(incoming || "");
  }, [editor, value]);

  const setLink = useCallback(() => {
    if (!editor || disabled) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("링크 URL (https://…)", previous ?? "https://");
    if (url === null) return;
    const trimmed = url.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: trimmed }).run();
  }, [editor, disabled]);

  const onImagePick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !editor || disabled || uploadingRef.current) return;

    uploadingRef.current = true;
    setUploading(true);
    try {
      const url = await uploadMedia(file);
      editor.chain().focus().setImage({ src: url, alt: "본문 이미지" }).run();
    } catch (error) {
      window.alert(uploadMediaErrorMessage(error, "이미지 업로드에 실패했습니다."));
    } finally {
      uploadingRef.current = false;
      setUploading(false);
    }
  };

  return (
    <div
      className="rich-text-editor overflow-hidden rounded-2xl border"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      <div
        className="flex flex-wrap items-center justify-between gap-2 border-b px-2 py-1.5"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg p-0.5" style={{ background: "var(--border)" }} role="tablist" aria-label="에디터 모드">
            {(["edit", "preview"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={mode === tab}
                onClick={() => setMode(tab)}
                className="rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors"
                style={{
                  background: mode === tab ? "var(--card)" : "transparent",
                  color: mode === tab ? "var(--accent-secondary)" : "var(--foreground-muted)",
                }}
              >
                {tab === "edit" ? "작성" : "미리보기"}
              </button>
            ))}
          </div>
          {mode === "edit" ? (
            <div className="flex flex-wrap items-center gap-0.5" role="toolbar" aria-label="글 서식">
          <ToolbarButton
            label="굵게"
            disabled={disabled || !editor}
            active={editor?.isActive("bold")}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <Bold size={15} aria-hidden />
          </ToolbarButton>
          <ToolbarButton
            label="기울임"
            disabled={disabled || !editor}
            active={editor?.isActive("italic")}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <Italic size={15} aria-hidden />
          </ToolbarButton>
          <ToolbarButton
            label="글머리 목록"
            disabled={disabled || !editor}
            active={editor?.isActive("bulletList")}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            <List size={15} aria-hidden />
          </ToolbarButton>
          <ToolbarButton
            label="번호 목록"
            disabled={disabled || !editor}
            active={editor?.isActive("orderedList")}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered size={15} aria-hidden />
          </ToolbarButton>
          <ToolbarButton label="링크" disabled={disabled || !editor} onClick={setLink}>
            <Link2 size={15} aria-hidden />
          </ToolbarButton>
          <ToolbarButton
            label="링크 제거"
            disabled={disabled || !editor || !editor.isActive("link")}
            onClick={() => editor?.chain().focus().unsetLink().run()}
          >
            <Unlink size={15} aria-hidden />
          </ToolbarButton>
          <ToolbarButton
            label="이미지 삽입"
            disabled={disabled || !editor || uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <ImageIcon size={15} aria-hidden />}
          </ToolbarButton>
            </div>
          ) : null}
        </div>
        <p className="px-1 text-[11px] tabular-nums opacity-60" style={{ color: "var(--foreground)" }} aria-live="polite">
          {textLength}/{maxLength}
        </p>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => void onImagePick(event)}
        disabled={disabled || uploading}
      />

      <div className="px-4 py-3 text-[14px] leading-relaxed" style={{ color: "var(--foreground)" }}>
        {mode === "edit" ? (
          <EditorContent editor={editor} />
        ) : value.trim() ? (
          <PostText text={value} />
        ) : (
          <p className="text-[13px] opacity-50" style={{ color: "var(--foreground-muted)", minHeight }}>
            미리볼 내용이 없어요.
          </p>
        )}
      </div>

      <p
        className="border-t px-4 py-2 text-[11px] opacity-55"
        style={{ borderColor: "var(--border)", color: "var(--foreground-muted)" }}
      >
        링크·이미지를 본문에 바로 넣을 수 있어요. 글자 수는 본문 텍스트 기준입니다.
      </p>
    </div>
  );
}

function richTextLengthFallback(value: string): number {
  return value.replace(/<[^>]*>/g, "").trim().length;
}
