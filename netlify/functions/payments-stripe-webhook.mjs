import handler from "../../api/payments/stripe-webhook.mjs";
import { netlifyHandler } from "./_adapt.mjs";

export default netlifyHandler(handler);

export const config = { path: "/api/payments/stripe-webhook" };
