import shop from "../../api/shop.mjs";
import { netlifyHandler } from "./_adapt.mjs";

export default netlifyHandler(async (req, res) => {
  const op = req.body?.preview ? "orders-preview" : req.body?.orderToken ? "orders-update" : "orders-create";
  req.query = { ...req.query, op };
  return shop(req, res);
});

export const config = { path: "/api/create-order" };
