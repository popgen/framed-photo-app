import handler from "../../api/contact.mjs";
import { netlifyHandler } from "./_adapt.mjs";

export default netlifyHandler(handler);

export const config = { path: "/api/contact" };
