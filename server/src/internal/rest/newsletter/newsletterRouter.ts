import { Router } from "express";

import { handleFrontendReqError } from "@/utils/errorUtils.js";
import { ExtendedRequest } from "@/utils/models/Request.js";

export const newsletterRouter: Router = Router();

newsletterRouter.post("/subscribe", (req: any, res: any) => {
  try {
    const { db } = req as ExtendedRequest;
  } catch (error) {
    handleFrontendReqError({
      req,
      error,
      res,
      action: "newsletter: subscribe",
    });
  }
});
newsletterRouter.post("/send", (req: any, res: any) => {
  try {
  } catch (error) {
    handleFrontendReqError({
      req,
      error,
      res,
      action: "newsletter: subscribe",
    });
  }
});
newsletterRouter.post("/confirmation/:token", (req: any, res: any) => {
  try {
  } catch (error) {
    handleFrontendReqError({
      req,
      error,
      res,
      action: "newsletter: subscribe",
    });
  }
});
newsletterRouter.post("/unsubscribe/:token", (req: any, res: any) => {
  try {
  } catch (error) {
    handleFrontendReqError({
      req,
      error,
      res,
      action: "newsletter: subscribe",
    });
  }
});
