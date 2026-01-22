/**
 * Bottom panel types
 */

/** Bottom panel tab types */
export type BottomPanelTab = "problems" | "output" | "terminal";

/** Bottom panel state */
export interface BottomPanelState {
  isOpen: boolean;
  activeTab: BottomPanelTab;
  height: number;
}
