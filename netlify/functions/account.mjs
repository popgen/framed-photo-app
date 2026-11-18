import shop from "../../api/shop.mjs";
import { netlifyHandler } from "./_adapt.mjs";

export default netlifyHandler(async (req, res) => {
  const op = req.body?.read || req.body?.profile ? "profile" : "customers-list";
  req.query = { ...req.query, op };
  return shop(req, res);
});

export const config = { path: "/api/account" };
