import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import { getWebApp } from "./telegram/webapp";
import "./ui/styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root element is missing");

createRoot(root).render(
  <StrictMode>
    <App webApp={getWebApp()} />
  </StrictMode>,
);
