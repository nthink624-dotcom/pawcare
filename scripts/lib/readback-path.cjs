const fs = require("node:fs");
const path = require("node:path");
function resolveReadbackPath(root, relativePath, argv = process.argv) {
  const index = argv.indexOf("--readback-root");
  if (index < 0) return path.join(root, relativePath);
  if (!argv[index + 1]) throw new Error("Readback directory argument is missing");
  const realRoot = fs.realpathSync(root);
  const directory = fs.realpathSync(path.resolve(root, argv[index + 1]));
  const relative = path.relative(realRoot, directory);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error("Readback directory must be inside this checkout");
  const file = fs.realpathSync(path.join(directory, path.basename(relativePath)));
  const child = path.relative(directory, file);
  if (!child || child === ".." || child.startsWith(`..${path.sep}`) || path.isAbsolute(child) || !fs.statSync(file).isFile()) throw new Error("Readback file escaped its selected directory");
  return file;
}
module.exports = { resolveReadbackPath };
