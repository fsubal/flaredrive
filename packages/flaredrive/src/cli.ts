import { parseArgs } from "node:util";
import { generate, preview, serve } from "./node.js";

const USAGE = `flaredrive <command> [options]

Commands:
  serve      Run the production server from dist/ (build with "vite build" first)
             --port <n> --host <name> --entry <file> --client <dir>
  generate   Export static HTML + Flight files from dist/ into static/
             [paths...] --out <dir> --origin <url> --entry <file> --client <dir>
  preview    Serve a static export
             --port <n> --host <name> --dir <dir>
`;

const [command, ...rest] = process.argv.slice(2);
const { values, positionals } = parseArgs({
  args: rest,
  allowPositionals: true,
  options: {
    port: { type: "string" },
    host: { type: "string" },
    entry: { type: "string" },
    client: { type: "string" },
    out: { type: "string" },
    dir: { type: "string" },
    origin: { type: "string" },
  },
});

const port = values.port ? Number(values.port) : undefined;

switch (command) {
  case "serve":
    await serve({
      port,
      hostname: values.host,
      entry: values.entry,
      clientDir: values.client,
    });
    break;
  case "generate":
    await generate({
      paths: positionals,
      outDir: values.out,
      origin: values.origin,
      entry: values.entry,
      clientDir: values.client,
    });
    break;
  case "preview":
    await preview({ port, hostname: values.host, dir: values.dir });
    break;
  default:
    console.error(USAGE);
    process.exit(command ? 1 : 0);
}
