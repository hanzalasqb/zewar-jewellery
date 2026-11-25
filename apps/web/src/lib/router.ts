import { useEffect, useState } from "react";

export type Route =
  | { page: "home" }
  | { page: "shop"; category: string | null; q: string }
  | { page: "product"; slug: string }
  | { page: "checkout" }
  | { page: "order"; number: string }
  | { page: "track" }
  | { page: "wishlist" }
  | { page: "admin" };

export function parse(hash = location.hash): Route {
  const [path, qs] = hash.replace(/^#\/?/, "").split("?");
  const [a, b] = path.split("/");
  const params = new URLSearchParams(qs);
  switch (a) {
    case "shop":
      return { page: "shop", category: b || params.get("c"), q: params.get("q") ?? "" };
    case "p":
      return b ? { page: "product", slug: decodeURIComponent(b) } : { page: "shop", category: null, q: "" };
    case "checkout":
      return { page: "checkout" };
    case "order":
      return { page: "order", number: decodeURIComponent(b ?? "") };
    case "track":
    case "wishlist":
    case "admin":
      return { page: a };
    default:
      return { page: "home" };
  }
}

export function useRoute(): Route {
  const [r, setR] = useState(() => parse());
  useEffect(() => {
    const on = () => {
      setR(parse());
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return r;
}

export const go = (path: string) => {
  location.hash = path;
};
