/**
 * Welcome Window Entry Point
 *
 * Lightweight entry for welcome/launcher windows.
 * Does not initialize Monaco or other heavy IDE components.
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { WelcomeApp } from "./WelcomeApp";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <WelcomeApp />
  </React.StrictMode>
);
