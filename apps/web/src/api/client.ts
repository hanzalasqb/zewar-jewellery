import type { CheckoutInput, Order, OrderStatus, Product } from "@store/shared";

export type Stock = Record<string, Record<string, number>>; // productId → variant → units

/** The storefront talks only to this interface: `httpClient` for the Node API, `demoClient` for the live demo. */
export interface StoreClient {
  readonly mode: "demo" | "live";
  catalog(): Promise<{ products: Product[]; stock: Stock }>;
  placeOrder(input: CheckoutInput): Promise<Order>;
  track(number: string, email: string): Promise<Order>;
  adminLogin(email: string, password: string): Promise<void>;
  adminOrders(): Promise<Order[]>;
  adminSetStatus(number: string, status: OrderStatus): Promise<Order>;
  adminInventory(): Promise<Stock>;
  adminSetStock(productId: string, variant: string, stock: number): Promise<void>;
  isAdmin(): boolean;
  adminLogout(): void;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public issues: { path: string; message: string }[] = [],
  ) {
    super(message);
  }
}

export const toApiError = (e: unknown): unknown => {
  const issues = (e as { issues?: { path: (string | number)[]; message: string }[] }).issues;
  return issues ? new ApiError("Validation failed", 400, issues.map((i) => ({ path: i.path.join("."), message: i.message }))) : e;
};
