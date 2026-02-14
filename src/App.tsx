import { useMemo } from "react";
import { StandardModePage } from "./features/standard/StandardModePage";
import { WidgetModePage } from "./features/widget/WidgetModePage";
import { detectAppMode } from "./shared/tauri/window";
import "./App.css";

function App() {
  const mode = useMemo(() => detectAppMode(), []);

  if (mode === "widget") {
    return <WidgetModePage />;
  }

  return <StandardModePage />;
}

export default App;
