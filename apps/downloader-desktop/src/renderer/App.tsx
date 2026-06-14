import { useEffect, useReducer, useRef, useState } from "react";
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
import { resolveDownloadScope, type DownloadRequestMode } from "./download-scope";
import { getAdjacentChapterUrls } from "./reader-navigation";

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
  const [forceSetupStage, setForceSetupStage] = useState(false);
  const chapterDetailRequestSeq = useRef(0);
  const chapterDetailLoadInFlightRef = useRef<string | null>(null);
  const readerScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const readerScrollFrameRef = useRef<number | null>(null);
  const pendingReaderScrollRef = useRef<{ chapterUrl: string; position: number } | null>(null);
  const latestStateRef = useRef(state);
  const api = window.downloader;
  latestStateRef.current = state;
  const baseStartValidation = validateStartInput({
    ...input,
    selectedChapterUrls: ["placeholder"]
  });
  const previewValidation = validatePreviewInput({
    url: input.url,
    previewMaxChapters,
    previewImagesPerChapter
  });
  const activeChapter = state.previewChapters.find((chapter) => chapter.chapterUrl === state.activeChapterUrl) ?? null;
  const adjacentChapterUrls = state.activeChapterUrl
    ? getAdjacentChapterUrls(state.previewChapters, state.activeChapterUrl)
    : { previousChapterUrl: null, nextChapterUrl: null };
  const previousChapter = adjacentChapterUrls.previousChapterUrl
    ? state.previewChapters.find((chapter) => chapter.chapterUrl === adjacentChapterUrls.previousChapterUrl) ?? null
    : null;
  const nextChapter = adjacentChapterUrls.nextChapterUrl
    ? state.previewChapters.find((chapter) => chapter.chapterUrl === adjacentChapterUrls.nextChapterUrl) ?? null
    : null;
  const isReaderStage =
    !forceSetupStage && (state.chapterDetailStatus === "loading" || state.chapterDetailStatus === "error" || state.readerMode === "reading");

  function nextChapterDetailRequestId(): string {
    chapterDetailRequestSeq.current += 1;
    return `chapter-${chapterDetailRequestSeq.current}`;
  }

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

  useEffect(() => {
    if (state.chapterDetailStatus !== "success" || !state.chapterDetail || !state.pendingRestoreChapterUrl) {
      return;
    }

    if (state.pendingRestoreChapterUrl !== state.chapterDetail.chapterUrl) {
      return;
    }

    if (readerScrollContainerRef.current) {
      readerScrollContainerRef.current.scrollTop = state.readerPositions[state.pendingRestoreChapterUrl] ?? 0;
    }

    dispatch({ type: "readerPositionRestored", chapterUrl: state.pendingRestoreChapterUrl });
  }, [state.chapterDetail, state.chapterDetailStatus, state.pendingRestoreChapterUrl, state.readerPositions]);

  useEffect(() => {
    return () => {
      if (readerScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(readerScrollFrameRef.current);
      }
    };
  }, []);

  function resetPendingReaderScroll(): void {
    pendingReaderScrollRef.current = null;

    if (readerScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(readerScrollFrameRef.current);
      readerScrollFrameRef.current = null;
    }
  }

  function clearChapterDetailLoadGate(): void {
    chapterDetailLoadInFlightRef.current = null;
  }

  function updateInput(field: keyof StartInput, value: string | number): void {
    setHasTriedStart(false);

    if (field === "url" && value !== input.url) {
      resetPendingReaderScroll();
      clearChapterDetailLoadGate();
      dispatch({ type: "previewInvalidated" });
    }

    setInput((prev) => ({
      ...prev,
      [field]: value
    }));
  }

  async function previewAlreadySettled(): Promise<boolean> {
    // Let any already-fired preview terminal event update renderer state before treating stop=false as a failure.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      if (latestStateRef.current.previewStatus !== "previewing") {
        return true;
      }
    }

    return false;
  }

  async function handleDownload(mode: DownloadRequestMode): Promise<void> {
    setHasTriedStart(true);

    if (!api) {
      dispatch({ type: "error", message: "Preload API unavailable. Please start from Electron launcher." });
      return;
    }

    const resolvedScope = resolveDownloadScope(mode, state.selectedChapterUrls);
    if (resolvedScope.errorMessage) {
      dispatch({ type: "error", message: resolvedScope.errorMessage });
      return;
    }

    const payload: StartInput = {
      ...input,
      selectedChapterUrls: resolvedScope.selectedChapterUrls
    };
    const validationResult = validateStartInput({
      ...payload,
      selectedChapterUrls: payload.selectedChapterUrls.length > 0 ? payload.selectedChapterUrls : ["placeholder"]
    });
    if (!validationResult.ok) {
      dispatch({ type: "error", message: validationResult.errors[0] ?? "Invalid download parameters" });
      return;
    }

    if (state.previewStatus === "previewing") {
      const previewTaskId = state.previewTaskId;
      if (!previewTaskId) {
        dispatch({ type: "error", message: "Preview is running but no preview task is available to stop." });
        return;
      }

      try {
        const stopResult = await api.stopPreview(previewTaskId);
        if (!stopResult.stopped) {
          if (!(await previewAlreadySettled())) {
            dispatch({ type: "error", message: "Stop preview failed. Download was not started." });
            return;
          }
        } else {
          dispatch({ type: "previewStatus", taskId: previewTaskId, state: "stopped" });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to stop preview";
        dispatch({ type: "error", message: `Failed to stop preview before download: ${message}` });
        return;
      }
    }

    const taskId = `task-${Date.now()}`;
    dispatch({ type: "started", taskId });

    if (resolvedScope.fallbackToAll) {
      dispatch({ type: "clientLog", line: "No chapters selected. Falling back to Download All." });
    }

    try {
      await api.startDownload({
        ...payload,
        taskId
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start download";
      dispatch({ type: "error", message });
    }
  }

  async function handleDownloadAll(): Promise<void> {
    await handleDownload("all");
  }

  async function handleDownloadSelected(): Promise<void> {
    await handleDownload("selected");
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
    resetPendingReaderScroll();
    clearChapterDetailLoadGate();
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

    const previewTaskId = state.previewTaskId;

    try {
      const result = await api.stopPreview(previewTaskId);
      if (result.stopped) {
        dispatch({ type: "previewStatus", taskId: previewTaskId, state: "stopped" });
        return;
      }

      if (!(await previewAlreadySettled())) {
        dispatch({ type: "previewClientError", message: "Stop preview failed" });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to stop preview";
      dispatch({ type: "previewClientError", message });
    }
  }

  async function handleLoadChapter(chapterUrl: string): Promise<void> {
    if (!api) {
      dispatch({ type: "previewClientError", message: "Preload API unavailable. Please start from Electron launcher." });
      return;
    }

    if (chapterDetailLoadInFlightRef.current) {
      return;
    }

    const requestId = nextChapterDetailRequestId();
    chapterDetailLoadInFlightRef.current = requestId;
    setForceSetupStage(false);
    dispatch({ type: "previewChapterDetailLoading", requestId, chapterUrl });

    try {
      const detail = await api.loadPreviewChapter({ chapterUrl });
      dispatch({ type: "previewChapterDetailSuccess", requestId, detail });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load full chapter";
      dispatch({ type: "previewChapterDetailError", requestId, message });
    } finally {
      if (chapterDetailLoadInFlightRef.current === requestId) {
        chapterDetailLoadInFlightRef.current = null;
      }
    }
  }

  async function handleRetryCurrentChapter(): Promise<void> {
    if (!state.activeChapterUrl) {
      return;
    }
    await handleLoadChapter(state.activeChapterUrl);
  }

  async function handleLoadAdjacentChapter(chapterUrl: string | null): Promise<void> {
    if (!chapterUrl) {
      return;
    }
    await handleLoadChapter(chapterUrl);
  }

  function handleReturnToSetup(): void {
    resetPendingReaderScroll();
    clearChapterDetailLoadGate();
    setForceSetupStage(true);
    dispatch({ type: "setReaderMode", mode: "catalog" });
  }

  function handleReaderScroll(): void {
    if (!state.activeChapterUrl || !readerScrollContainerRef.current) {
      return;
    }

    pendingReaderScrollRef.current = {
      chapterUrl: state.activeChapterUrl,
      position: readerScrollContainerRef.current.scrollTop
    };

    if (readerScrollFrameRef.current !== null) {
      return;
    }

    readerScrollFrameRef.current = window.requestAnimationFrame(() => {
      readerScrollFrameRef.current = null;
      if (!pendingReaderScrollRef.current) {
        return;
      }

      dispatch({
        type: "readerPositionChanged",
        chapterUrl: pendingReaderScrollRef.current.chapterUrl,
        position: pendingReaderScrollRef.current.position
      });
    });
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
    <main className={`app-shell ${isReaderStage ? "app-shell--reader-stage" : "app-shell--setup-stage"}`}>
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

      {isReaderStage ? (
        <div className="app-stage app-stage--reader">
          <div className="reader-stage-shell">
            <div className="reader-grid">
              <div className="reader-grid-col reader-grid-col--chapters">
                <ChapterListPanel
                  chapters={state.previewChapters}
                   selectedChapterUrls={state.selectedChapterUrls}
                   activeChapterUrl={state.activeChapterUrl}
                   selectionLocked={state.status === "running"}
                   chapterActionDisabled={state.chapterDetailStatus === "loading"}
                   onToggleChapter={(chapterUrl) => dispatch({ type: "toggleChapterSelection", chapterUrl })}
                   onSelectChapter={(chapterUrl) => {
                     void handleLoadChapter(chapterUrl);
                  }}
                />
              </div>

              <div className="reader-grid-col reader-grid-col--reader">
                <ReaderPanel
                  isReaderStage={true}
                  previewStatus={state.previewStatus}
                  activeChapter={activeChapter}
                  chapterDetailStatus={state.chapterDetailStatus}
                  chapterDetail={state.chapterDetail}
                  chapterDetailError={state.chapterDetailError}
                  previewError={state.previewError}
                  previousChapter={previousChapter}
                  nextChapter={nextChapter}
                  scrollContainerRef={readerScrollContainerRef}
                  onReaderScroll={handleReaderScroll}
                  readerZoom={state.readerZoom}
                  onReaderZoomChange={(zoom) => dispatch({ type: "setReaderZoom", zoom })}
                  onBackToSetup={handleReturnToSetup}
                  onStopPreview={handleStopPreview}
                  canStopPreview={state.previewStatus === "previewing"}
                  navigationDisabled={state.chapterDetailStatus === "loading"}
                  onOpenPreviousChapter={() => {
                    void handleLoadAdjacentChapter(previousChapter?.chapterUrl ?? null);
                  }}
                  onOpenNextChapter={() => {
                    void handleLoadAdjacentChapter(nextChapter?.chapterUrl ?? null);
                  }}
                  onRetry={handleRetryCurrentChapter}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="app-stage app-stage--setup">
          <section className="control-row">
            <div className="control-col">
              <DownloadForm
                values={input}
                hasApi={Boolean(api)}
                isRunning={state.status === "running"}
                isPreviewing={state.previewStatus === "previewing"}
                canStart={baseStartValidation.ok}
                canDownloadAll={baseStartValidation.ok}
                canDownloadSelected={baseStartValidation.ok && state.selectedChapterUrls.length > 0}
                canPreview={previewValidation.ok}
                selectedChapterCount={state.selectedChapterUrls.length}
                previewMaxChapters={previewMaxChapters}
                previewImagesPerChapter={previewImagesPerChapter}
                previewValidationErrors={previewValidation.ok ? [] : previewValidation.errors}
                validationErrors={hasTriedStart ? baseStartValidation.errors : []}
                onChange={updateInput}
                onChangePreviewMaxChapters={setPreviewMaxChapters}
                onChangePreviewImagesPerChapter={setPreviewImagesPerChapter}
                onStartPreview={handleStartPreview}
                onStopPreview={handleStopPreview}
                onDownloadAll={handleDownloadAll}
                onDownloadSelected={handleDownloadSelected}
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
                 chapterActionDisabled={state.chapterDetailStatus === "loading"}
                 onToggleChapter={(chapterUrl) => dispatch({ type: "toggleChapterSelection", chapterUrl })}
                 onSelectChapter={(chapterUrl) => {
                   void handleLoadChapter(chapterUrl);
                }}
              />
            </div>

            <div className="reader-grid-col reader-grid-col--reader">
              <ReaderPanel
                isReaderStage={false}
                previewStatus={state.previewStatus}
                activeChapter={activeChapter}
                chapterDetailStatus={state.chapterDetailStatus}
                chapterDetail={state.chapterDetail}
                chapterDetailError={state.chapterDetailError}
                previewError={state.previewError}
                previousChapter={previousChapter}
                nextChapter={nextChapter}
                scrollContainerRef={readerScrollContainerRef}
                onReaderScroll={handleReaderScroll}
                readerZoom={state.readerZoom}
                onReaderZoomChange={(zoom) => dispatch({ type: "setReaderZoom", zoom })}
                onBackToSetup={handleReturnToSetup}
                onStopPreview={handleStopPreview}
                canStopPreview={state.previewStatus === "previewing"}
                navigationDisabled={state.chapterDetailStatus === "loading"}
                onOpenPreviousChapter={() => {
                  void handleLoadAdjacentChapter(previousChapter?.chapterUrl ?? null);
                }}
                onOpenNextChapter={() => {
                  void handleLoadAdjacentChapter(nextChapter?.chapterUrl ?? null);
                }}
                onRetry={handleRetryCurrentChapter}
              />
            </div>
          </section>
        </div>
      )}

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
