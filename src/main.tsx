import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AppProvider } from "./store";
import App from "./App";
import { RoomProvider } from "./lib/room";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AppProvider>
        <RoomProvider>
          <App />
        </RoomProvider>
      </AppProvider>
    </BrowserRouter>
  </StrictMode>
);
