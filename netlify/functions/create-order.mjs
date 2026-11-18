import shop from "../../api/shop.mjs";
import { netlifyHandler } from "./_adapt.mjs";

export default netlifyHandler(async (req, res) => {
  req.query = { ...req.query, op: "orders-create" };
  return shop(req, res);
});

export const config = { path: "/api/create-order" };
