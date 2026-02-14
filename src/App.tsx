import { useEffect, useMemo } from "react";
import { StandardModePage } from "./features/standard/StandardModePage";
import { WidgetModePage } from "./features/widget/WidgetModePage";
import { useTodoStore } from "./shared/state/useTodoStore";
import { detectAppMode } from "./shared/tauri/window";
import "./App.css";

function App() {
  const mode = useMemo(() => detectAppMode(), []);
  const dataInitialized = useTodoStore((state) => state.dataInitialized);
  const initializeData = useTodoStore((state) => state.initializeData);

  useEffect(() => {
    void initializeData();
  }, [initializeData]);

  if (!dataInitialized) {
    return <div className="app-loading">Loading...</div>;
  }

  if (mode === "widget") {
    return <WidgetModePage />;
  }

  return <StandardModePage />;
}

export default App;
