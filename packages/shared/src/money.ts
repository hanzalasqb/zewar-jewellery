/** Prices are integer paisa (1 rupee = 100 paisa) so totals never drift. */
const fmt = new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0, minimumFractionDigits: 0 });

export const formatPrice = (paisa: number) => fmt.format(Math.round(paisa / 100)).replace("PKR", "Rs").replace(/\s+/g, " ");
export const rupees = (r: number) => Math.round(r * 100);
