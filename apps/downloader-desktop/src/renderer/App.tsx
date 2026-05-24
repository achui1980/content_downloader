import { useEffect, useReducer, useState } from "react";
import type { StartInput } from "../shared/contracts";
import type { DownloaderPreloadApi } from "../preload/index";
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

const initialInput: StartInput = {
  url: "",
  outputDir: "",
  concurrency: 4,
  retries: 3
};

export function App() {
  const [state, dispatch] = useReducer(reduceAppState, undefined, createInitialAppState);
  const [input, setInput] = useState<StartInput>(initialInput);
  const api = window.downloader;

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
    setInput((prev) => ({
      ...prev,
      [field]: value
    }));
  }

  async function handleStart(): Promise<void> {
    if (!api) {
      dispatch({ type: "error", message: "Preload API is unavailable" });
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
    <main>
      <h1>Downloader Desktop</h1>
      <DownloadForm
        values={input}
        hasApi={Boolean(api)}
        isRunning={state.status === "running"}
        onChange={updateInput}
        onSubmit={handleStart}
        onStop={handleStop}
        onSelectOutputDir={handleSelectOutputDir}
        onOpenOutputDir={handleOpenOutputDir}
      />
      <ProgressPanel status={state.status} progressIndex={state.progressIndex} progressTotal={state.progressTotal} />
      <LogPanel logs={state.logs} />
      <ResultPanel status={state.status} message={state.resultMessage} />
    </main>
  );
}
