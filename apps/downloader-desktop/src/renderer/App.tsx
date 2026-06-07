import { useEffect, useReducer, useState } from "react";
import { buildDefaultStartInput, type StartInput } from "../shared/contracts";
import type { DownloaderPreloadApi } from "../preload/index";
import { validatePreviewInput, validateStartInput } from "../shared/validation";
import { DownloadForm } from "./components/DownloadForm";
import { ChapterListPanel } from "./components/ChapterListPanel";
import { ReaderPanel } from "./components/ReaderPanel";
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
  const [previewMaxChapters, setPreviewMaxChapters] = useState(5);
  const [previewImagesPerChapter, setPreviewImagesPerChapter] = useState(6);
  const api = window.downloader;
  const startPayload: StartInput = {
    ...input,
    selectedChapterUrls: state.selectedChapterUrls
  };
  const validation = validateStartInput(startPayload);
  const previewValidation = validatePreviewInput({
    url: input.url,
    previewMaxChapters,
    previewImagesPerChapter
  });
  const activeChapter = state.previewChapters.find((chapter) => chapter.chapterUrl === state.activeChapterUrl) ?? null;

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

    const offPreviewLog = api.onPreviewLog((event) => {
      dispatch({
        type: "previewLog",
        taskId: event.taskId,
        source: event.source,
        line: event.line
      });
    });

    const offPreviewChapter = api.onPreviewChapter((event) => {
      dispatch({
        type: "previewChapter",
        taskId: event.taskId,
        index: event.index,
        totalChapters: event.totalChapters,
        chapterTitle: event.chapterTitle,
        chapterUrl: event.chapterUrl,
        images: event.images
      });
    });

    const offPreviewStatus = api.onPreviewStatus((event) => {
      dispatch({
        type: "previewStatus",
        taskId: event.taskId,
        state: event.state,
        message: event.message
      });
    });

    return () => {
      offProgress();
      offLog();
      offStatus();
      offPreviewLog();
      offPreviewChapter();
      offPreviewStatus();
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

    if (state.previewStatus === "previewing") {
      dispatch({ type: "error", message: "Stop preview before starting download." });
      return;
    }

    const validationResult = validateStartInput(startPayload);
    if (!validationResult.ok) {
      dispatch({ type: "error", message: validationResult.errors[0] ?? "Invalid download parameters" });
      return;
    }

    const taskId = `task-${Date.now()}`;
    dispatch({ type: "started", taskId });

    try {
      await api.startDownload({
        ...startPayload,
        taskId
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start download";
      dispatch({ type: "error", message });
    }
  }

  async function handleStartPreview(): Promise<void> {
    if (!api) {
      dispatch({ type: "previewClientError", message: "Preload API unavailable. Please start from Electron launcher." });
      return;
    }

    const previewInput = {
      url: input.url,
      previewMaxChapters,
      previewImagesPerChapter
    };
    const validationResult = validatePreviewInput(previewInput);
    if (!validationResult.ok) {
      dispatch({ type: "previewClientError", message: validationResult.errors[0] ?? "Invalid preview parameters" });
      return;
    }

    const taskId = `preview-${Date.now()}`;
    dispatch({ type: "previewStarted", taskId });

    try {
      await api.startPreview({
        ...previewInput,
        taskId
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start preview";
      dispatch({ type: "previewClientError", message });
    }
  }

  async function handleStopPreview(): Promise<void> {
    if (!api || !state.previewTaskId) {
      return;
    }

    try {
      const result = await api.stopPreview(state.previewTaskId);
      if (result.stopped) {
        dispatch({ type: "previewStatus", taskId: state.previewTaskId, state: "stopped" });
        return;
      }
      dispatch({ type: "previewClientError", message: "Stop preview failed" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to stop preview";
      dispatch({ type: "previewClientError", message });
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

      dispatch({ type: "error", message: "Stop failed: there is no active download task" });
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

      <section className="control-row">
        <div className="control-col">
          <DownloadForm
            values={input}
            hasApi={Boolean(api)}
            isRunning={state.status === "running"}
            isPreviewing={state.previewStatus === "previewing"}
            canStart={validation.ok}
            canPreview={previewValidation.ok}
            selectedChapterCount={state.selectedChapterUrls.length}
            previewMaxChapters={previewMaxChapters}
            previewImagesPerChapter={previewImagesPerChapter}
            validationErrors={hasTriedStart ? validation.errors : []}
            onChange={updateInput}
            onChangePreviewMaxChapters={setPreviewMaxChapters}
            onChangePreviewImagesPerChapter={setPreviewImagesPerChapter}
            onStartPreview={handleStartPreview}
            onStopPreview={handleStopPreview}
            onSubmit={handleStart}
            onStop={handleStop}
            onSelectOutputDir={handleSelectOutputDir}
            onOpenOutputDir={handleOpenOutputDir}
          />
        </div>
      </section>

      <section className="reader-grid">
        <div className="reader-grid-col reader-grid-col--chapters">
          <ChapterListPanel
            chapters={state.previewChapters}
            selectedChapterUrls={state.selectedChapterUrls}
            activeChapterUrl={state.activeChapterUrl}
            selectionLocked={state.status === "running"}
            onToggleChapter={(chapterUrl) => dispatch({ type: "toggleChapterSelection", chapterUrl })}
            onSelectChapter={(chapterUrl) => dispatch({ type: "setActiveChapter", chapterUrl })}
          />
        </div>

        <div className="reader-grid-col reader-grid-col--reader">
          <ReaderPanel previewStatus={state.previewStatus} activeChapter={activeChapter} previewError={state.previewError} />
        </div>
      </section>

      <section className="status-row">
        <div className="status-row-col">
          <ProgressPanel status={state.status} progressIndex={state.progressIndex} progressTotal={state.progressTotal} />
        </div>
        <div className="status-row-col">
          <ResultPanel status={state.status} message={state.resultMessage} />
        </div>
      </section>

      <LogPanel logs={state.logs} />
    </main>
  );
}
