import handler from "../../api/webhooks/whatsapp.mjs";
import { netlifyHandler } from "./_adapt.mjs";

export default netlifyHandler(handler);

export const config = { path: "/api/webhooks/whatsapp" };
