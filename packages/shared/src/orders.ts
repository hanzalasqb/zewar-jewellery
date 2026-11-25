import { z } from "zod";
import { CartLineSchema } from "./cart";

export const CITIES = ["Lahore", "Karachi", "Islamabad", "Rawalpindi", "Faisalabad", "Multan", "Peshawar", "Quetta", "Sialkot", "Gujranwala", "Hyderabad", "Other"] as const;

export const CheckoutSchema = z.object({
  name: z.string().trim().min(3, "Enter your full name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .refine((v) => /^(\+92|0)3\d{9}$/.test(v), "Use a Pakistani mobile number, e.g. 0300 1234567"),
  city: z.enum(CITIES, { errorMap: () => ({ message: "Choose your city" }) }),
  address: z.string().trim().min(10, "Add house, street and area").max(240),
  notes: z.string().trim().max(300).default(""),
  payment: z.enum(["cod", "bank"]),
  coupon: z.string().trim().max(30).nullable().default(null),
  lines: z.array(CartLineSchema).min(1, "Your bag is empty").max(30),
});
export type CheckoutInput = z.input<typeof CheckoutSchema>;
export type Checkout = z.infer<typeof CheckoutSchema>;

export const ORDER_STATUSES = ["placed", "confirmed", "shipped", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_FLOW: Record<OrderStatus, OrderStatus[]> = {
  placed: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export const STATUS_LABEL: Record<OrderStatus, string> = { placed: "Order placed", confirmed: "Confirmed", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled" };

export interface OrderLine {
  productId: string;
  name: string;
  variant: string;
  selection: Record<string, string>;
  qty: number;
  unit: number;
  total: number;
}

export interface Order {
  id: string;
  number: string;
  status: OrderStatus;
  history: { status: OrderStatus; at: string }[];
  customer: { name: string; email: string; phone: string; city: string; address: string; notes: string };
  payment: "cod" | "bank";
  lines: OrderLine[];
  subtotal: number;
  discount: number;
  shipping: number;
  codFee: number;
  total: number;
  coupon: string | null;
  createdAt: string;
}

export const canMove = (from: OrderStatus, to: OrderStatus) => STATUS_FLOW[from].includes(to);

/** Masks an email for public order tracking: "ay***@gmail.com". */
export const maskEmail = (e: string) => e.replace(/^(.{2}).*(@.*)$/, "$1***$2");
