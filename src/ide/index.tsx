/**
 * IDE Window Entry Point
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { IdeApp } from "./IdeApp";
import { initializeMonaco } from "./monaco";
import "../styles/globals.css";

// Start loading Monaco immediately, before React renders
// This ensures Monaco is fully configured before any editor mounts
initializeMonaco().catch(console.error);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <IdeApp />
  </React.StrictMode>
);
