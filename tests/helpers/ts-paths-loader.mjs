import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const srcRoot = path.join(root, "src");

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
      url: pathToFileURL(path.join(root, "node_modules", "next", "server.js")).href,
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
