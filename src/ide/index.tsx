/**
 * IDE Window Entry Point
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { IdeApp } from "./IdeApp";
import "../styles/globals.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <IdeApp />
  </React.StrictMode>
);
