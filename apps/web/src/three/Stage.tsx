import { useEffect, useRef, useState, type ReactNode } from "react";
import { LuMinus, LuPlus, LuRotate3D } from "react-icons/lu";
import { Viewer, type Item, type ViewOptions } from "../gl/renderer";

interface Props {
  items: Item[];
  view: ViewOptions;
  label: string;
  className?: string;
  controls?: boolean;
  fallback?: ReactNode;
  onFrame?: (viewer: Viewer, t: number) => boolean | void;
}

/**
 * React wrapper around the WebGL viewer. The viewer is created once per mount;
 * new `items` (e.g. after choosing another metal or colour) swap in without re-creating the GL context.
 */
export function Stage({ items, view, label, className, controls = false, fallback, onFrame }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const [failed, setFailed] = useState(false);
  const frame = useRef(onFrame);
  frame.current = onFrame;

  useEffect(() => {
    if (!canvas.current) return;
    try {
      const v = new Viewer(canvas.current, view);
      v.onFrame = (t) => frame.current?.(v, t);
      viewer.current = v;
    } catch {
      setFailed(true);
    }
    return () => {
      viewer.current?.destroy();
      viewer.current = null;
    };
    // The view is applied at creation; remount with a new key to change it.
  }, []);

  useEffect(() => {
    viewer.current?.setItems(items);
  }, [items]);

  if (failed) return <div className={`stage stage-fallback ${className ?? ""}`}>{fallback ?? <p>3D preview needs WebGL 2.</p>}</div>;

  return (
    <div className={`stage ${className ?? ""}`}>
      <canvas ref={canvas} role="img" aria-label={label} tabIndex={controls ? 0 : -1} />
      {controls && (
        <div className="stage-controls">
          <span className="stage-hint">
            <LuRotate3D aria-hidden /> Drag to rotate
          </span>
          <button type="button" aria-label="Zoom in" onClick={() => viewer.current?.zoom(0.85)}>
            <LuPlus />
          </button>
          <button type="button" aria-label="Zoom out" onClick={() => viewer.current?.zoom(1.18)}>
            <LuMinus />
          </button>
        </div>
      )}
    </div>
  );
}
