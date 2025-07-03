import { Request as ExpressRequest } from "express";

import { DrizzleCli } from "@/db/initDrizzle.js";

export interface ExtendedRequest extends ExpressRequest {
  db: DrizzleCli;
  id?: string;
  userId?: string;
  apiVersion?: number;
  timestamp?: number;
}
