import * as monaco from "monaco-editor";
// @ts-expect-error Worker imports are not typed
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
// @ts-expect-error Worker imports are not typed
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
// @ts-expect-error Worker imports are not typed
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
// @ts-expect-error Worker imports are not typed
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
// @ts-expect-error Worker imports are not typed
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

// @ts-ignore
self.MonacoEnvironment = {
  getWorker(_: any, label: string) {
    if (label === "json") {
      return new jsonWorker();
    }
    if (label === "css" || label === "scss" || label === "less") {
      return new cssWorker();
    }
    if (label === "html" || label === "handlebars" || label === "razor") {
      return new htmlWorker();
    }
    if (label === "typescript" || label === "javascript") {
      return new tsWorker();
    }
    return new editorWorker();
  },
};

// @ts-expect-error typescriptDefaults is not typed
monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);
