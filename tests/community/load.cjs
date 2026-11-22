const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
module.exports = function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../..', file);
  const compiled = ts.transpileModule(fs.readFileSync(filename,'utf8'), { compilerOptions: { module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022, esModuleInterop:true, jsx:ts.JsxEmit.ReactJSX } }).outputText;
  const mod = new Module(filename, module); mod.filename=filename; mod.paths=Module._nodeModulePaths(path.dirname(filename));
  const original=mod.require.bind(mod);
  mod.require=(id)=>Object.hasOwn(mocks,id)?mocks[id]:original(id);
  mod._compile(compiled,filename); return mod.exports;
};
