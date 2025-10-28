import express from "express";
import {
  getCartByUser,
  addToCart,
  removeFromCart,
  clearCart,
} from "../controllers/cartController.js";

const cartRouter = express.Router();

cartRouter.get("user/:userId", getCartByUser);
cartRouter.post("/add", addToCart);
cartRouter.delete("/remove", removeFromCart);
cartRouter.post("/clear", clearCart);

export default cartRouter;
