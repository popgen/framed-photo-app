import handler from "../../api/payments/mercadopago-webhook.mjs";
import { netlifyHandler } from "./_adapt.mjs";

export default netlifyHandler(handler);

export const config = { path: "/api/payments/mercadopago-webhook" };
