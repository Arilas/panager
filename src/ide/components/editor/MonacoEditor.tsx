/**
 * Monaco Editor Wrapper Component
 *
 * Uses @monaco-editor/react for proper Monaco integration with syntax highlighting.
 * Supports light/dark theme switching based on app settings.
 * Displays diagnostics from plugins as editor markers.
 * Integrates with backend LSP for intelligent features (go to definition, hover, completion, etc.)
 */

import { useRef, useCallback, useEffect } from "react";
import Editor, { OnMount, OnChange, loader, Monaco } from "@monaco-editor/react";
import type { editor, languages, IDisposable, Position, CancellationToken, IRange } from "monaco-editor";
import { useIdeStore } from "../../stores/ide";
import { useFilesStore, consumePendingNavigation } from "../../stores/files";
import { useProblemsStore } from "../../stores/problems";
import { useIdeSettingsContext } from "../../contexts/IdeSettingsContext";
import { cn } from "../../../lib/utils";
import type { DiagnosticSeverity } from "../../types/problems";
import * as lspApi from "../../lib/tauri-ide";

// Configure Monaco loader to use CDN (simplest setup)
loader.config({
  paths: {
    vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min/vs",
  },
});

// Languages that use the backend LSP
const LSP_LANGUAGES = ["typescript", "typescriptreact", "javascript", "javascriptreact"];

// Track if we've already registered LSP providers (they should be registered once globally)
let lspProvidersRegistered = false;

// Store reference to openFileAtPosition for the editor opener
let openFileAtPositionRef: ((path: string, position: { line: number; column: number }) => Promise<void>) | null = null;

/**
 * Set the file opener function reference.
 * Called from the component to allow the editor opener to access the store.
 */
export function setFileOpener(
  opener: (path: string, position: { line: number; column: number }) => Promise<void>
) {
  openFileAtPositionRef = opener;
}

// Track if editor opener is registered
let editorOpenerRegistered = false;

/**
 * Register an editor opener to intercept Monaco's file opening requests.
 * This is called when the user Cmd+Clicks on a symbol to go to its definition.
 */
function registerEditorOpener(monaco: Monaco): IDisposable | null {
  if (editorOpenerRegistered) return null;

  // Monaco's registerEditorOpener allows us to intercept when it tries to open a resource
  const disposable = monaco.editor.registerEditorOpener({
    openCodeEditor(
      _source: editor.ICodeEditor,
      resource: { scheme: string; path: string },
      selectionOrPosition?: { startLineNumber: number; startColumn: number }
    ): boolean {
      // Only handle file:// URIs
      if (resource.scheme !== "file") {
        return false; // Let Monaco handle other schemes
      }

      const filePath = resource.path;
      const position = selectionOrPosition
        ? { line: selectionOrPosition.startLineNumber, column: selectionOrPosition.startColumn }
        : { line: 1, column: 1 };

      console.log("[EditorOpener] Opening file:", filePath, "at position:", position);

      // Use the stored reference to open the file
      if (openFileAtPositionRef) {
        openFileAtPositionRef(filePath, position);
        return true; // We handled it
      }

      return false; // Fallback to Monaco's default behavior
    },
  });

  editorOpenerRegistered = true;
  console.log("[MonacoEditor] Registered editor opener for file navigation");
  return disposable;
}

/**
 * Disable Monaco's built-in TypeScript/JavaScript validation.
 * We use the backend LSP for diagnostics instead to avoid duplicate errors.
 */
function disableBuiltInValidation(monaco: Monaco) {
  // Disable TypeScript validation
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true,
  });

  // Disable JavaScript validation
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true,
  });

  console.log("[MonacoEditor] Disabled built-in TS/JS validation");
}

/**
 * Register LSP providers for intelligent features.
 * These providers call the backend Tauri commands which forward to the LSP server.
 */
function registerLspProviders(monaco: Monaco): IDisposable[] {
  const disposables: IDisposable[] = [];

  for (const languageId of LSP_LANGUAGES) {
    // Go to Definition (Cmd+Click, F12)
    disposables.push(
      monaco.languages.registerDefinitionProvider(languageId, {
        async provideDefinition(
          model: editor.ITextModel,
          position: Position,
          _token: CancellationToken
        ) {
          try {
            const locations = await lspApi.lspGotoDefinition(
              model.uri.path,
              position.lineNumber - 1, // Monaco is 1-indexed, LSP is 0-indexed
              position.column - 1
            );

            return locations.map((loc) => ({
              uri: monaco.Uri.parse(loc.uri),
              range: {
                startLineNumber: loc.range.start.line + 1,
                startColumn: loc.range.start.character + 1,
                endLineNumber: loc.range.end.line + 1,
                endColumn: loc.range.end.character + 1,
              },
            }));
          } catch (e) {
            console.error("[LSP] goto_definition error:", e);
            return [];
          }
        },
      })
    );

    // Hover (mouse over symbol)
    disposables.push(
      monaco.languages.registerHoverProvider(languageId, {
        async provideHover(
          model: editor.ITextModel,
          position: Position,
          _token: CancellationToken
        ) {
          try {
            const hover = await lspApi.lspHover(
              model.uri.path,
              position.lineNumber - 1,
              position.column - 1
            );

            if (!hover) return null;

            return {
              contents: [
                {
                  value: hover.contents.value,
                  isTrusted: true,
                },
              ],
              range: hover.range
                ? {
                    startLineNumber: hover.range.start.line + 1,
                    startColumn: hover.range.start.character + 1,
                    endLineNumber: hover.range.end.line + 1,
                    endColumn: hover.range.end.character + 1,
                  }
                : undefined,
            };
          } catch (e) {
            console.error("[LSP] hover error:", e);
            return null;
          }
        },
      })
    );

    // Completion (IntelliSense)
    disposables.push(
      monaco.languages.registerCompletionItemProvider(languageId, {
        triggerCharacters: [".", '"', "'", "/", "@", "<"],
        async provideCompletionItems(
          model: editor.ITextModel,
          position: Position,
          context: languages.CompletionContext,
          _token: CancellationToken
        ) {
          try {
            const triggerChar =
              context.triggerKind === 1 // TriggerCharacter
                ? context.triggerCharacter
                : undefined;

            const result = await lspApi.lspCompletion(
              model.uri.path,
              position.lineNumber - 1,
              position.column - 1,
              triggerChar
            );

            const suggestions: languages.CompletionItem[] = result.items.map((item) => ({
              label: item.label,
              kind: mapCompletionKind(monaco, item.kind),
              detail: item.detail,
              documentation: item.documentation
                ? { value: item.documentation.value, isTrusted: true }
                : undefined,
              insertText: item.insertText || item.label,
              insertTextRules:
                item.insertTextFormat === 2
                  ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                  : undefined,
              sortText: item.sortText,
              filterText: item.filterText,
              range: undefined as unknown as languages.CompletionItem["range"], // Use default range
            }));

            return {
              suggestions,
              incomplete: result.isIncomplete,
            };
          } catch (e) {
            console.error("[LSP] completion error:", e);
            return { suggestions: [] };
          }
        },
      })
    );

    // Find References (Shift+F12)
    disposables.push(
      monaco.languages.registerReferenceProvider(languageId, {
        async provideReferences(
          model: editor.ITextModel,
          position: Position,
          context: languages.ReferenceContext,
          _token: CancellationToken
        ) {
          try {
            const locations = await lspApi.lspReferences(
              model.uri.path,
              position.lineNumber - 1,
              position.column - 1,
              context.includeDeclaration
            );

            return locations.map((loc) => ({
              uri: monaco.Uri.parse(loc.uri),
              range: {
                startLineNumber: loc.range.start.line + 1,
                startColumn: loc.range.start.character + 1,
                endLineNumber: loc.range.end.line + 1,
                endColumn: loc.range.end.character + 1,
              },
            }));
          } catch (e) {
            console.error("[LSP] references error:", e);
            return [];
          }
        },
      })
    );

    // Rename (F2)
    disposables.push(
      monaco.languages.registerRenameProvider(languageId, {
        async provideRenameEdits(
          model: editor.ITextModel,
          position: Position,
          newName: string,
          _token: CancellationToken
        ) {
          try {
            const edit = await lspApi.lspRename(
              model.uri.path,
              position.lineNumber - 1,
              position.column - 1,
              newName
            );

            const edits: languages.WorkspaceEdit = { edits: [] };

            if (edit.changes) {
              for (const [uri, textEdits] of Object.entries(edit.changes)) {
                for (const textEdit of textEdits) {
                  edits.edits.push({
                    resource: monaco.Uri.parse(uri),
                    textEdit: {
                      range: {
                        startLineNumber: textEdit.range.start.line + 1,
                        startColumn: textEdit.range.start.character + 1,
                        endLineNumber: textEdit.range.end.line + 1,
                        endColumn: textEdit.range.end.character + 1,
                      },
                      text: textEdit.newText,
                    },
                    versionId: undefined,
                  });
                }
              }
            }

            return edits;
          } catch (e) {
            console.error("[LSP] rename error:", e);
            return { edits: [] };
          }
        },
      })
    );

    // Code Actions (Quick Fixes - lightbulb)
    disposables.push(
      monaco.languages.registerCodeActionProvider(languageId, {
        async provideCodeActions(
          model: editor.ITextModel,
          range: IRange,
          context: languages.CodeActionContext,
          _token: CancellationToken
        ) {
          try {
            // Convert Monaco diagnostics to LSP format for context
            const diagnostics = context.markers.map((m: editor.IMarkerData) => ({
              range: {
                start: { line: m.startLineNumber - 1, character: m.startColumn - 1 },
                end: { line: m.endLineNumber - 1, character: m.endColumn - 1 },
              },
              message: m.message,
              severity: m.severity,
              code: m.code,
              source: m.source,
            }));

            const actions = await lspApi.lspCodeAction(
              model.uri.path,
              range.startLineNumber - 1,
              range.startColumn - 1,
              range.endLineNumber - 1,
              range.endColumn - 1,
              diagnostics
            );

            const codeActions: languages.CodeAction[] = actions.map((action) => {
              const result: languages.CodeAction = {
                title: action.title,
                kind: action.kind,
                isPreferred: action.isPreferred,
              };

              if (action.edit) {
                result.edit = { edits: [] };
                if (action.edit.changes) {
                  for (const [uri, textEdits] of Object.entries(action.edit.changes)) {
                    for (const textEdit of textEdits) {
                      result.edit.edits.push({
                        resource: monaco.Uri.parse(uri),
                        textEdit: {
                          range: {
                            startLineNumber: textEdit.range.start.line + 1,
                            startColumn: textEdit.range.start.character + 1,
                            endLineNumber: textEdit.range.end.line + 1,
                            endColumn: textEdit.range.end.character + 1,
                          },
                          text: textEdit.newText,
                        },
                        versionId: undefined,
                      });
                    }
                  }
                }
              }

              return result;
            });

            return {
              actions: codeActions,
              dispose: () => {},
            };
          } catch (e) {
            console.error("[LSP] codeAction error:", e);
            return { actions: [], dispose: () => {} };
          }
        },
      })
    );
  }

  console.log("[MonacoEditor] Registered LSP providers for:", LSP_LANGUAGES.join(", "));
  return disposables;
}

/**
 * Map LSP completion kind to Monaco completion kind
 */
function mapCompletionKind(monaco: Monaco, kind?: number): languages.CompletionItemKind {
  if (!kind) return monaco.languages.CompletionItemKind.Text;

  // LSP CompletionItemKind values
  const kindMap: Record<number, languages.CompletionItemKind> = {
    1: monaco.languages.CompletionItemKind.Text,
    2: monaco.languages.CompletionItemKind.Method,
    3: monaco.languages.CompletionItemKind.Function,
    4: monaco.languages.CompletionItemKind.Constructor,
    5: monaco.languages.CompletionItemKind.Field,
    6: monaco.languages.CompletionItemKind.Variable,
    7: monaco.languages.CompletionItemKind.Class,
    8: monaco.languages.CompletionItemKind.Interface,
    9: monaco.languages.CompletionItemKind.Module,
    10: monaco.languages.CompletionItemKind.Property,
    11: monaco.languages.CompletionItemKind.Unit,
    12: monaco.languages.CompletionItemKind.Value,
    13: monaco.languages.CompletionItemKind.Enum,
    14: monaco.languages.CompletionItemKind.Keyword,
    15: monaco.languages.CompletionItemKind.Snippet,
    16: monaco.languages.CompletionItemKind.Color,
    17: monaco.languages.CompletionItemKind.File,
    18: monaco.languages.CompletionItemKind.Reference,
    19: monaco.languages.CompletionItemKind.Folder,
    20: monaco.languages.CompletionItemKind.EnumMember,
    21: monaco.languages.CompletionItemKind.Constant,
    22: monaco.languages.CompletionItemKind.Struct,
    23: monaco.languages.CompletionItemKind.Event,
    24: monaco.languages.CompletionItemKind.Operator,
    25: monaco.languages.CompletionItemKind.TypeParameter,
  };

  return kindMap[kind] || monaco.languages.CompletionItemKind.Text;
}

interface MonacoEditorProps {
  content: string;
  language: string;
  path: string;
  readOnly?: boolean;
}

// Map our severity to Monaco MarkerSeverity
function getSeverityNumber(severity: DiagnosticSeverity): number {
  switch (severity) {
    case "error":
      return 8; // MarkerSeverity.Error
    case "warning":
      return 4; // MarkerSeverity.Warning
    case "information":
      return 2; // MarkerSeverity.Info
    case "hint":
      return 1; // MarkerSeverity.Hint
    default:
      return 2;
  }
}

export function MonacoEditor({
  content,
  language,
  path,
  readOnly = false, // Enable editing by default
}: MonacoEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const setCursorPosition = useIdeStore((s) => s.setCursorPosition);
  const updateFileContent = useFilesStore((s) => s.updateFileContent);
  const openFileAtPosition = useFilesStore((s) => s.openFileAtPosition);
  const getDiagnosticsForFile = useProblemsStore((s) => s.getDiagnosticsForFile);
  const diagnosticsByFile = useProblemsStore((s) => s.diagnosticsByFile);
  const { effectiveTheme } = useIdeSettingsContext();

  const isDark = effectiveTheme === "dark";
  const monacoTheme = isDark ? "vs-dark" : "vs";

  // Set the file opener reference for the editor opener to use
  useEffect(() => {
    setFileOpener(openFileAtPosition);
  }, [openFileAtPosition]);

  const handleEditorMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      // Disable built-in TS/JS validation (we use backend LSP instead)
      disableBuiltInValidation(monaco);

      // Register editor opener for file navigation (only once globally)
      registerEditorOpener(monaco);

      // Register LSP providers (only once globally)
      if (!lspProvidersRegistered) {
        registerLspProviders(monaco);
        lspProvidersRegistered = true;
      }

      // Check for pending navigation
      const pendingPos = consumePendingNavigation(path);
      if (pendingPos) {
        editor.setPosition({ lineNumber: pendingPos.line, column: pendingPos.column });
        editor.revealLineInCenter(pendingPos.line);
      }

      // Set initial cursor position
      const pos = editor.getPosition();
      setCursorPosition({ line: pos?.lineNumber ?? 1, column: pos?.column ?? 1 });

      // Listen for cursor position changes
      editor.onDidChangeCursorPosition((e) => {
        setCursorPosition({
          line: e.position.lineNumber,
          column: e.position.column,
        });
      });

      // Focus the editor
      editor.focus();
    },
    [setCursorPosition, path]
  );

  // Handle pending navigation when the file changes (already open file navigating to different position)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const pendingPos = consumePendingNavigation(path);
    if (pendingPos) {
      editor.setPosition({ lineNumber: pendingPos.line, column: pendingPos.column });
      editor.revealLineInCenter(pendingPos.line);
      editor.focus();
    }
  }, [path, content]); // content change can indicate the file was reloaded

  // Update markers when diagnostics change
  useEffect(() => {
    const monaco = monacoRef.current;
    const editor = editorRef.current;

    if (!monaco || !editor) return;

    const model = editor.getModel();
    if (!model) return;

    // Get diagnostics for this file
    const diagnostics = getDiagnosticsForFile(path);

    // Convert to Monaco markers
    const markers = diagnostics.map((d) => ({
      severity: getSeverityNumber(d.severity),
      message: d.message,
      startLineNumber: d.startLine,
      startColumn: d.startColumn,
      endLineNumber: d.endLine,
      endColumn: d.endColumn,
      source: d.source,
      code: d.code,
    }));

    // Set markers on the model
    monaco.editor.setModelMarkers(model, "panager-diagnostics", markers);

    console.log("[MonacoEditor] Set", markers.length, "markers for", path);
  }, [path, diagnosticsByFile, getDiagnosticsForFile]);

  // Handle content changes
  const handleEditorChange: OnChange = useCallback(
    (value) => {
      if (value !== undefined && value !== content) {
        updateFileContent(path, value);
      }
    },
    [path, content, updateFileContent]
  );

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        language={language}
        value={content}
        path={path}
        theme={monacoTheme}
        onMount={handleEditorMount}
        onChange={handleEditorChange}
        options={{
          readOnly,
          minimap: { enabled: true },
          fontSize: 13,
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          wordWrap: "off",
          tabSize: 2,
          renderWhitespace: "selection",
          bracketPairColorization: { enabled: true },
          smoothScrolling: true,
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          padding: { top: 8 },
          scrollbar: {
            vertical: "auto",
            horizontal: "auto",
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
        }}
        loading={
          <div
            className={cn(
              "h-full w-full flex items-center justify-center",
              isDark ? "bg-neutral-900 text-neutral-500" : "bg-white text-neutral-400"
            )}
          >
            Loading editor...
          </div>
        }
      />
    </div>
  );
}
