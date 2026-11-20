import handler from "../../api/game-confirm.mjs";
import { netlifyHandler } from "./_adapt.mjs";

export default netlifyHandler(handler);

export const config = { path: "/api/game-confirm" };
