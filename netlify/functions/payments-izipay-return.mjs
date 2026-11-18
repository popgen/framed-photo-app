import handler from "../../api/payments/izipay-return.mjs";
import { netlifyHandler } from "./_adapt.mjs";

export default netlifyHandler(handler);

export const config = { path: "/api/payments/izipay-return" };
