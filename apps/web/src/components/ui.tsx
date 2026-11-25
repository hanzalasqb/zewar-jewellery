import type { ReactNode } from "react";
import { LuStar } from "react-icons/lu";
import { formatPrice } from "@store/shared";
import { cx } from "../lib/format";

export const Price = ({ value, compareAt, className }: { value: number; compareAt?: number; className?: string }) => (
  <span className={cx("price", className)}>
    <span className="price-now">{formatPrice(value)}</span>
    {compareAt && compareAt > value && <s className="price-was">{formatPrice(compareAt)}</s>}
  </span>
);

export function Stars({ rating, reviews }: { rating: number; reviews?: number }) {
  return (
    <span className="stars" aria-label={`Rated ${rating} out of 5${reviews ? ` from ${reviews} reviews` : ""}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <LuStar key={i} className={i <= Math.round(rating) ? "on" : ""} aria-hidden />
      ))}
      {reviews != null && <span className="muted">({reviews})</span>}
    </span>
  );
}

export function Qty({ value, onChange, max = 10, label }: { value: number; onChange: (n: number) => void; max?: number; label: string }) {
  return (
    <span className="qty" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(value - 1)} aria-label="Decrease quantity">
        −
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="Increase quantity">
        +
      </button>
    </span>
  );
}

export function Field({ label, error, children, hint, className }: { label: string; error?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("field", className)}>
      <span className="field-label">{label}</span>
      {children}
      {error ? <small className="field-error">{error}</small> : hint ? <small className="field-hint">{hint}</small> : null}
    </label>
  );
}

export const Badge = ({ children }: { children: ReactNode }) => <span className="badge">{children}</span>;
