import handler from "../../api/payments/mock-confirm.mjs";
import { netlifyHandler } from "./_adapt.mjs";

export default netlifyHandler(handler);

export const config = { path: "/api/payments/mock-confirm" };
