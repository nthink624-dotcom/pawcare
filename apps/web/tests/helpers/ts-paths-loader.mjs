import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const root = process.cwd();
const srcRoot = path.join(root, "src");
const require = createRequire(import.meta.url);

function resolveExistingPath(basePath) {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.mjs`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "next/server") {
    return {
      shortCircuit: true,
      url: pathToFileURL(require.resolve("next/server")).href,
    };
  }

  if (specifier.startsWith("@petmanager/shared/")) {
    const target = resolveExistingPath(path.resolve(root, "../shared", specifier.slice("@petmanager/shared/".length)));
    if (!target) throw new Error(`Cannot resolve ${specifier}`);
    return {
      shortCircuit: true,
      url: pathToFileURL(target).href,
    };
  }

  if (specifier.startsWith("@/")) {
    const target = resolveExistingPath(path.join(srcRoot, specifier.slice(2)));
    if (!target) {
      throw new Error(`Cannot resolve ${specifier}`);
    }

    return {
      shortCircuit: true,
      url: pathToFileURL(target).href,
    };
  }

  return nextResolve(specifier, context);
}
