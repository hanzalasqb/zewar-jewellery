import type { Product, Selection } from "@store/shared";
import { formatPrice } from "@store/shared";
import { cx } from "../lib/format";

interface Props {
  product: Product;
  selection: Selection;
  onChange: (s: Selection) => void;
  stockFor: (s: Selection) => number;
}

/** Swatches and chips for every option, with sold-out values crossed out for the current combination. */
export function OptionPicker({ product, selection, onChange, stockFor }: Props) {
  return (
    <div className="options">
      {product.options.map((o) => {
        const current = o.values.find((v) => v.id === selection[o.id]);
        return (
          <fieldset key={o.id} className="option">
            <legend>
              {o.label}: <strong>{current?.label}</strong>
            </legend>
            <div className={cx("option-values", o.kind === "swatch" ? "swatches" : "chips")}>
              {o.values.map((v) => {
                const next = { ...selection, [o.id]: v.id };
                const out = stockFor(next) === 0;
                const delta = v.priceDelta ?? 0;
                return (
                  <button
                    key={v.id}
                    type="button"
                    className={cx(o.kind === "swatch" ? "swatch" : "chip", selection[o.id] === v.id && "on", out && "out")}
                    aria-pressed={selection[o.id] === v.id}
                    aria-label={`${v.label}${out ? ", sold out" : ""}${delta ? `, ${delta > 0 ? "+" : "−"}${formatPrice(Math.abs(delta))}` : ""}`}
                    title={`${v.label}${delta ? ` (${delta > 0 ? "+" : "−"}${formatPrice(Math.abs(delta))})` : ""}${out ? " · sold out" : ""}`}
                    onClick={() => onChange(next)}
                  >
                    {o.kind === "swatch" ? <span className="swatch-dot" style={{ background: v.hex }} /> : v.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
