import { useEffect } from "react";
import { apiGet } from "./api";
import { getToken } from "./auth";

/**
 * 마운트 후 토큰이 있으면 path를 다시 조회해 사용자별 상태(likedByMe/joinedByMe 등)를 갱신한다.
 * 서버 컴포넌트 렌더 시점엔 getToken()=null 이라 항상 비로그인 상태로 내려오기 때문에 필요.
 */
export function useAuthedRefresh<T>(path: string, apply: (data: T) => void) {
  useEffect(() => {
    if (!getToken()) return;
    let alive = true;
    apiGet<T>(path)
      .then((d) => alive && apply(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
}
