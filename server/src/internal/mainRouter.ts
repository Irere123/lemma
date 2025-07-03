import "dotenv/config";

import { Router } from "express";
import { newsletterRouter } from "./newsletter/newsletterRouter.js";

const mainRouter: Router = Router();

mainRouter.get("", async (req: any, res) => {
  res.status(200).json({ message: "Hello World" });
});

mainRouter.use("/newsletter", newsletterRouter);

export default mainRouter;
