import type { StoreClient } from "./client";
import { createDemoClient } from "./demo";
import { createHttpClient } from "./http";

export const IS_DEMO = import.meta.env.VITE_DEMO === "true";
export const client: StoreClient = IS_DEMO ? createDemoClient() : createHttpClient();
