import handler from "../../api/shop.mjs";
import { netlifyHandler } from "./_adapt.mjs";

export default netlifyHandler(handler);

export const config = { path: "/api/shop" };
