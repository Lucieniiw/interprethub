import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "@/assets/styles/globals/global.css";

function bootstrapTheme(): void {
  try {
    const t = localStorage.getItem("iiw-theme");
    if (t === "light" || t === "dark") {
      document.documentElement.setAttribute("data-theme", t);
    } else {
      document.documentElement.setAttribute(
        "data-theme",
        window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
      );
    }
  } catch {
    document.documentElement.setAttribute("data-theme", "dark");
  }
}

bootstrapTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
