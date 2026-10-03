const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function createTemporaryEnvFile(prefix) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
  return { directory, file: path.join(directory, "production.env") };
}

function removeTemporaryEnvFile(temporaryFile) {
  if (!temporaryFile) return;
  if (fs.existsSync(temporaryFile.file)) fs.unlinkSync(temporaryFile.file);
  if (fs.existsSync(temporaryFile.directory)) fs.rmdirSync(temporaryFile.directory);
}

module.exports = { createTemporaryEnvFile, removeTemporaryEnvFile };
