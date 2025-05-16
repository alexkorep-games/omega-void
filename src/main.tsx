import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { registerSW } from 'virtual:pwa-register'

registerSW({
  onNeedRefresh() {
    // e.g. notify your user that a new version is available
    console.log('New content available, please refresh.')
  },
  onOfflineReady() {
    // e.g. inform the user that app is ready to work offline
    console.log('App is ready to work offline.')
  }
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
