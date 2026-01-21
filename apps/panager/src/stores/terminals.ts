import { create } from "zustand";
import type { Terminal } from "../types";
import * as api from "../lib/tauri";
import { useSettingsStore } from "./settings";

interface TerminalsState {
  terminals: Terminal[];
  loading: boolean;
  error: string | null;

  fetchTerminals: () => Promise<void>;
  syncTerminals: () => Promise<void>;
  getTerminalById: (id: string) => Terminal | undefined;
  getDefaultTerminal: () => Terminal | undefined;
}

/** Preferred terminal order for fallback selection */
const PREFERRED_TERMINALS = ["iterm2", "warp", "terminal", "alacritty", "kitty"];

export const useTerminalsStore = create<TerminalsState>((set, get) => ({
  terminals: [],
  loading: false,
  error: null,

  fetchTerminals: async () => {
    set({ loading: true, error: null });
    try {
      const terminals = await api.getTerminals();
      set({ terminals, loading: false });
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },

  syncTerminals: async () => {
    set({ loading: true, error: null });
    try {
      const terminals = await api.syncTerminals();
      set({ terminals, loading: false });
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },

  getTerminalById: (id) => get().terminals.find((t) => t.id === id),

  getDefaultTerminal: () => {
    const { terminals } = get();
    const { settings } = useSettingsStore.getState();

    // Check user-configured default terminal
    if (settings.default_terminal_id) {
      const defaultTerminal = terminals.find(
        (t) => t.id === settings.default_terminal_id && t.isAvailable
      );
      if (defaultTerminal) {
        return defaultTerminal;
      }
    }

    // Fallback to preferred terminals in order
    for (const cmd of PREFERRED_TERMINALS) {
      const terminal = terminals.find(
        (t) => t.command === cmd && t.isAvailable
      );
      if (terminal) {
        return terminal;
      }
    }

    // Last resort: any available terminal
    return terminals.find((t) => t.isAvailable) ?? terminals[0];
  },
}));
