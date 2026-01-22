import { create } from "zustand";
import type { CreateSshAliasRequest, SshAlias } from "../types";
import * as api from "../lib/tauri";

interface SshState {
  aliases: SshAlias[];
  loading: boolean;
  error: string | null;

  // Actions
  fetchAliases: () => Promise<void>;
  createAlias: (request: CreateSshAliasRequest) => Promise<SshAlias>;
  getAliasDetails: (host: string) => Promise<SshAlias | null>;
}

export const useSshStore = create<SshState>((set) => ({
  aliases: [],
  loading: false,
  error: null,

  fetchAliases: async () => {
    set({ loading: true, error: null });
    try {
      const aliases = await api.readSshAliases();
      set({ aliases, loading: false });
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },

  createAlias: async (request) => {
    try {
      const alias = await api.createSshAlias(request);
      set((state) => ({
        aliases: [...state.aliases, alias],
      }));
      return alias;
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  getAliasDetails: async (host) => {
    try {
      return await api.getSshAliasDetails(host);
    } catch (error) {
      console.error("Failed to get SSH alias details:", error);
      return null;
    }
  },
}));
