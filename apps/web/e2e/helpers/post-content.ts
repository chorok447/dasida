import { type Page, expect } from "@playwright/test";

/** 게시글 본문 입력(Tiptap contenteditable). */
export async function fillPostContent(page: Page, text: string) {
  const editor = page.locator(".tiptap-editor").first();
  await expect(editor).toBeVisible();
  await editor.click();
  await editor.fill(text);
}
