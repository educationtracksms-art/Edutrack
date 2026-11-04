import serverEntry from "../../dist/server/server.js";
import { defineHandler } from "nitro/h3";

export default defineHandler((event) => serverEntry.fetch(event.req, process.env, {}));