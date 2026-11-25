export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export const fmtDate = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
