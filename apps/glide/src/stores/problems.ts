/**
 * Problems/Diagnostics store
 * Receives diagnostics from backend plugins via Tauri events
 */

import { create } from "zustand";
import type { Diagnostic, DiagnosticsSummary } from "../types/problems";

interface ProblemsState {
  // State
  diagnosticsByFile: Map<string, Diagnostic[]>;
  selectedDiagnosticId: string | null;

  // Actions (called from event listener)
  setDiagnostics: (filePath: string, diagnostics: Diagnostic[]) => void;
  clearDiagnostics: (pluginId: string, filePath?: string) => void;
  clearAllDiagnostics: () => void;
  selectDiagnostic: (id: string | null) => void;

  // Computed getters
  getSummary: () => DiagnosticsSummary;
  getAllDiagnostics: () => Diagnostic[];
  getDiagnosticsForFile: (filePath: string) => Diagnostic[];
}

export const useProblemsStore = create<ProblemsState>((set, get) => ({
  diagnosticsByFile: new Map(),
  selectedDiagnosticId: null,

  setDiagnostics: (filePath, diagnostics) => {
    console.log("[ProblemsStore] setDiagnostics called for", filePath, "with", diagnostics.length, "items");
    set((state) => {
      const newMap = new Map(state.diagnosticsByFile);
      if (diagnostics.length > 0) {
        newMap.set(filePath, diagnostics);
      } else {
        newMap.delete(filePath);
      }
      console.log("[ProblemsStore] New diagnosticsByFile map has", newMap.size, "files");
      return { diagnosticsByFile: newMap };
    });
  },

  clearDiagnostics: (pluginId, filePath) => {
    set((state) => {
      const newMap = new Map(state.diagnosticsByFile);

      if (filePath) {
        // Clear diagnostics from specific plugin for specific file
        const existing = newMap.get(filePath) || [];
        const filtered = existing.filter((d) => d.source !== pluginId);
        if (filtered.length > 0) {
          newMap.set(filePath, filtered);
        } else {
          newMap.delete(filePath);
        }
      } else {
        // Clear all diagnostics from this plugin across all files
        for (const [path, diags] of newMap) {
          const filtered = diags.filter((d) => d.source !== pluginId);
          if (filtered.length > 0) {
            newMap.set(path, filtered);
          } else {
            newMap.delete(path);
          }
        }
      }

      return { diagnosticsByFile: newMap };
    });
  },

  clearAllDiagnostics: () => {
    set({ diagnosticsByFile: new Map(), selectedDiagnosticId: null });
  },

  selectDiagnostic: (id) => set({ selectedDiagnosticId: id }),

  getSummary: () => {
    const all = get().getAllDiagnostics();
    return {
      errors: all.filter((d) => d.severity === "error").length,
      warnings: all.filter((d) => d.severity === "warning").length,
      information: all.filter((d) => d.severity === "information").length,
      hints: all.filter((d) => d.severity === "hint").length,
      total: all.length,
    };
  },

  getAllDiagnostics: () => {
    const all: Diagnostic[] = [];
    for (const diags of get().diagnosticsByFile.values()) {
      all.push(...diags);
    }
    // Sort by severity (errors first, then warnings, etc.)
    const severityOrder: Record<string, number> = {
      error: 0,
      warning: 1,
      information: 2,
      hint: 3,
    };
    return all.sort(
      (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
    );
  },

  getDiagnosticsForFile: (filePath) => {
    return get().diagnosticsByFile.get(filePath) || [];
  },
}));
