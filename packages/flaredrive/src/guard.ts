import { parse } from "@babel/parser";
import type { Plugin } from "vite";

const FORBIDDEN = "use server";

/**
 * Throws when the source declares a Server Function via a `"use server"`
 * directive, either as a module prologue or inside a function body.
 * Comments and ordinary string expressions are allowed.
 */
export function assertNoServerFunctions(code: string, id: string): void {
  if (!code.includes(FORBIDDEN)) return;

  const ast = parse(code, {
    sourceType: "unambiguous",
    errorRecovery: true,
    plugins: ["jsx", "typescript", "decorators-legacy"],
  });

  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }

    const record = node as Record<string, unknown>;
    if (
      record.type === "Directive" &&
      (record.value as { value?: unknown } | undefined)?.value === FORBIDDEN
    ) {
      throw new Error(
        `[flaredrive] Server Functions are not supported ("use server" in ${id}). ` +
          "Expose an explicit HTTP API route and call it with fetch() from a Client Component.",
      );
    }

    for (const child of Object.values(record)) visit(child);
  };

  visit(ast.program);
}

const SOURCE_ID = /\.[cm]?[jt]sx?(?:\?|$)/;

/**
 * Vite plugin that rejects `"use server"` before the RSC plugin can
 * transform it into a Server Function. Runs in every environment.
 */
export function forbidServerFunctions(): Plugin {
  return {
    name: "flaredrive:forbid-server-functions",
    enforce: "pre",
    transform(code, id) {
      if (id.startsWith("\0") || !SOURCE_ID.test(id)) return;
      assertNoServerFunctions(code, id);
    },
  };
}
