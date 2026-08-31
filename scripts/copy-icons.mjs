import { cpSync, mkdirSync } from "node:fs";

// tsc emits only JS, so the icon has to be copied into dist beside the compiled
// node or n8n renders a blank square. Doing it in a script rather than pulling in
// gulp, which is what the official starter uses, for one file.
mkdirSync("dist/nodes/SilentFail", { recursive: true });
cpSync("nodes/SilentFail/silentFail.svg", "dist/nodes/SilentFail/silentFail.svg");
console.log("copied silentFail.svg into dist");
