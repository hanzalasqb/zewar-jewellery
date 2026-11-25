import { useEffect, useState } from "react";
import type { Product, Selection } from "@store/shared";
import { Viewer } from "../gl/renderer";
import { buildModel, viewFor } from "../brand/model";

/**
 * Product images are rendered from the same 3D models as the viewer, once, on a single hidden
 * WebGL context, then cached as data URLs. One context serves the whole grid.
 */
let viewer: Viewer | null = null;
let failed = false;
const cache = new Map<string, string>();
const waiting = new Map<string, Promise<string | null>>();
let chain: Promise<unknown> = Promise.resolve();

function getViewer() {
  if (viewer || failed) return viewer;
  try {
    const c = document.createElement("canvas");
    viewer = new Viewer(c, { interactive: false, autoRotate: 0, preserve: true, size: [640, 800] });
  } catch {
    failed = true;
  }
  return viewer;
}

const idle = () => new Promise<void>((r) => ("requestIdleCallback" in window ? (window as unknown as { requestIdleCallback: (f: () => void) => void }).requestIdleCallback(() => r()) : setTimeout(r, 16)));

export function thumbnail(product: Product, selection: Selection, angle = 0): Promise<string | null> {
  const key = `${product.id}|${JSON.stringify(selection)}|${angle}`;
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const pending = waiting.get(key);
  if (pending) return pending;
  const job = (chain = chain.then(async () => {
    await idle();
    const v = getViewer();
    if (!v) return null;
    const view = viewFor(product, "thumb");
    v.setView({ ...view, yaw: (view.yaw ?? 0) + angle }, true);
    v.setItems(buildModel(product, selection, { still: true }));
    const url = v.snapshot("image/webp", 0.86);
    cache.set(key, url);
    waiting.delete(key);
    return url;
  })) as Promise<string | null>;
  waiting.set(key, job);
  return job;
}

export function useThumbnail(product: Product | undefined, selection: Selection | undefined, angle = 0): string | null {
  const key = product && selection ? `${product.id}|${JSON.stringify(selection)}|${angle}` : "";
  const [url, setUrl] = useState<string | null>(() => cache.get(key) ?? null);
  useEffect(() => {
    if (!product || !selection) return;
    let live = true;
    setUrl(cache.get(key) ?? null);
    void thumbnail(product, selection, angle).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [key]);
  return url;
}
