import { useEffect, useReducer, useState } from "react";
import { buildDefaultStartInput, type StartInput } from "../shared/contracts";
import type { DownloaderPreloadApi } from "../preload/index";
import { validateStartInput } from "../shared/validation";
import { DownloadForm } from "./components/DownloadForm";
import { ProgressPanel } from "./components/ProgressPanel";
import { LogPanel } from "./components/LogPanel";
import { ResultPanel } from "./components/ResultPanel";
import { createInitialAppState, reduceAppState } from "./state";

declare global {
  interface Window {
    downloader?: DownloaderPreloadApi;
  }
}

export function App() {
  const [state, dispatch] = useReducer(reduceAppState, undefined, createInitialAppState);
  const [input, setInput] = useState<StartInput>(buildDefaultStartInput);
  const [hasTriedStart, setHasTriedStart] = useState(false);
  const api = window.downloader;
  const validation = validateStartInput(input);

  useEffect(() => {
    if (!api) {
      return;
    }

    const offProgress = api.onProgress((event) => {
      dispatch({
        type: "progress",
        taskId: event.taskId,
        index: event.index,
        totalChapters: event.totalChapters,
        status: event.status
      });
    });

    const offLog = api.onLog((event) => {
      dispatch({
        type: "log",
        taskId: event.taskId,
        source: event.source,
        line: event.line
      });
    });

    const offStatus = api.onStatus((event) => {
      dispatch({
        type: "status",
        taskId: event.taskId,
        state: event.state,
        message: event.message
      });
    });

    return () => {
      offProgress();
      offLog();
      offStatus();
    };
  }, [api]);

  function updateInput(field: keyof StartInput, value: string | number): void {
    setHasTriedStart(false);
    setInput((prev) => ({
      ...prev,
      [field]: value
    }));
  }

  async function handleStart(): Promise<void> {
    setHasTriedStart(true);

    if (!api) {
      dispatch({ type: "error", message: "Preload API unavailable. Please start from Electron launcher." });
      return;
    }

    const validationResult = validateStartInput(input);
    if (!validationResult.ok) {
      dispatch({ type: "error", message: validationResult.errors[0] ?? "Invalid download parameters" });
      return;
    }

    const taskId = `task-${Date.now()}`;
    dispatch({ type: "started", taskId });

    try {
      await api.startDownload({
        ...input,
        taskId
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start download";
      dispatch({ type: "error", message });
    }
  }

  async function handleStop(): Promise<void> {
    if (!api || !state.taskId) {
      return;
    }

    try {
      const result = await api.stopDownload(state.taskId);
      if (result.stopped) {
        dispatch({ type: "stopped" });
        return;
      }

      dispatch({ type: "error", message: "停止失败：当前没有可停止的任务" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to stop download";
      dispatch({ type: "error", message });
    }
  }

  async function handleSelectOutputDir(): Promise<void> {
    if (!api) {
      return;
    }
    const selected = await api.selectOutputDir();
    if (selected) {
      setInput((prev) => ({ ...prev, outputDir: selected }));
    }
  }

  async function handleOpenOutputDir(): Promise<void> {
    if (!api || !input.outputDir) {
      return;
    }

    try {
      await api.openOutputDir(input.outputDir);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to open output directory";
      dispatch({ type: "error", message });
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>Downloader Desktop</h1>
          <p className="app-subtitle">2025copy comic downloader control center</p>
        </div>
        <span className={`status-pill status-pill--${state.status}`}>{state.status}</span>
      </header>

      {!api ? (
        <section className="app-alert app-alert--warning" role="alert">
          <strong>Preload API unavailable.</strong> Use <code>npm run dev:electron</code> or <code>./scripts/dev-electron.sh</code>.
        </section>
      ) : null}

      <section className="dashboard-grid">
        <div className="dashboard-col dashboard-col--primary">
          <DownloadForm
            values={input}
            hasApi={Boolean(api)}
            isRunning={state.status === "running"}
            canStart={validation.ok}
            validationErrors={hasTriedStart ? validation.errors : []}
            onChange={updateInput}
            onSubmit={handleStart}
            onStop={handleStop}
            onSelectOutputDir={handleSelectOutputDir}
            onOpenOutputDir={handleOpenOutputDir}
          />
        </div>

        <div className="dashboard-col dashboard-col--secondary">
          <ProgressPanel status={state.status} progressIndex={state.progressIndex} progressTotal={state.progressTotal} />
          <ResultPanel status={state.status} message={state.resultMessage} />
        </div>
      </section>

      <LogPanel logs={state.logs} />
    </main>
  );
}
