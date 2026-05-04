import { Router } from "express";
import { PRODUCT_CATALOG } from "@belamonda/shared";

export const productsRouter = Router();

// Public — list all product definitions
productsRouter.get("/", (_req, res) => {
  return res.json({ products: PRODUCT_CATALOG });
});

// Public — get single product by code
productsRouter.get("/:code", (req, res) => {
  const product = PRODUCT_CATALOG.find((p) => p.code === req.params.code);
  if (!product) return res.status(404).json({ error: "PRODUCT_NOT_FOUND" });
  return res.json({ product });
});
