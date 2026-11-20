import handler from "../../api/game.mjs";
import { netlifyHandler } from "./_adapt.mjs";

export default netlifyHandler(handler);

export const config = { path: "/api/game" };
