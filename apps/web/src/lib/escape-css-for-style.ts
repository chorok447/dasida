/**
 * CSS 문자열을 HTML `<style>` 태그 안에 안전하게 삽입하기 위한 이스케이프 유틸.
 *
 * 배경: PostCSS ≤8.5.5 계열 CVE — `postcss.parse(userCSS).toResult().css` 를
 * `<style>${output}</style>` 에 그대로 넣으면 CSS 값에 포함된
 * `</style><script>...</script>` 가 스타일 컨텍스트를 탈출해 XSS 가 된다.
 * 권고 수정안(`</style` → `<\/style`)을 그대로 반영한 방어 유틸이다.
 *
 * 현재 코드베이스에는 사용자 CSS 를 `<style>` 에 삽입하는 경로가 없다.
 * **향후 사용자 정의 CSS/테마 커스텀 기능을 추가해 임의 문자열을 `<style>` 에
 * 넣게 되면 반드시 이 함수를 거쳐라.** (postcss 파싱 결과 포함)
 *
 * CSS 내부 이스케이프(`<\/` 의 `\`)는 CSS 문법상 유효한 escape 라 스타일
 * 해석에는 영향이 거의 없고, HTML 파서가 닫는 태그로 오인하는 것만 막는다.
 */
export function escapeCssForStyle(input: string): string {
  return (
    input
      // NUL 은 HTML/CSS 파서마다 처리 방식이 달라 제거
      .replace(/\0/g, "")
      // `</style` (대소문자 무관) → `<\/style` : 스타일 컨텍스트 탈출 차단 (CVE 권고)
      .replace(/<\/(style)/gi, "<\\/$1")
      // `<!--` → `<\!--` : HTML 주석으로 빠져나가는 것 방지
      .replace(/<!--/g, "<\\!--")
      // `<script` (대소문자 무관) → `<\script` : 방어적 2중
      .replace(/<(script)/gi, "<\\$1")
  );
}

/* 예시 (향후 사용자 CSS 기능이 생겼을 때):
 *
 *   const safeCss = escapeCssForStyle(postcss.parse(userCss).toResult().css);
 *   <style dangerouslySetInnerHTML={{ __html: safeCss }} />
 *
 * 절대 escapeCssForStyle 없이 사용자 유래 문자열을 <style> 에 넣지 말 것.
 */
