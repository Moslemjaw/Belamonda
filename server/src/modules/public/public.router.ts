import { Router } from "express";
import { getHomePayload } from "../../services/public.service.js";

export const publicRouter = Router();

publicRouter.get("/home", async (_req, res, next) => {
  try {
    const payload = await getHomePayload();
    return res.json(payload);
  } catch (e) {
    next(e);
  }
});
