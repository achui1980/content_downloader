export type AppStatus = "idle" | "running" | "done" | "error" | "stopped";
export type PreviewStatus = "idle" | "previewing" | "ready" | "failed";

export interface PreviewChapter {
  index: number;
  totalChapters: number;
  chapterTitle: string;
  chapterUrl: string;
  images: string[];
}

export interface AppState {
  status: AppStatus;
  taskId: string | null;
  progressIndex: number;
  progressTotal: number;
  logs: string[];
  resultMessage: string | null;
  previewStatus: PreviewStatus;
  previewTaskId: string | null;
  previewChapters: PreviewChapter[];
  activeChapterUrl: string | null;
  selectedChapterUrls: string[];
  previewError: string | null;
}

export type AppAction =
  | { type: "started"; taskId: string }
  | { type: "done"; message?: string }
  | { type: "error"; message: string }
  | { type: "stopped"; message?: string }
  | {
      type: "status";
      taskId: string;
      state: "starting" | "running" | "done" | "failed" | "stopped";
      message?: string;
    }
  | { type: "progress"; taskId: string; index: number; totalChapters: number; status: "started" | "done" }
  | { type: "log"; taskId: string; source: "stdout" | "stderr"; line: string }
  | { type: "previewStarted"; taskId: string }
  | {
      type: "previewStatus";
      taskId: string;
      state: "starting" | "running" | "done" | "failed" | "stopped";
      message?: string;
    }
  | {
      type: "previewChapter";
      taskId: string;
      index: number;
      totalChapters: number;
      chapterTitle: string;
      chapterUrl: string;
      images: string[];
    }
  | { type: "previewLog"; taskId: string; source: "stdout" | "stderr"; line: string }
  | { type: "clientLog"; line: string }
  | { type: "setActiveChapter"; chapterUrl: string }
  | { type: "toggleChapterSelection"; chapterUrl: string }
  | { type: "previewClientError"; message: string };

function matchesTask(stateTaskId: string | null, eventTaskId: string): boolean {
  return !!stateTaskId && stateTaskId === eventTaskId;
}

export function createInitialAppState(): AppState {
  return {
    status: "idle",
    taskId: null,
    progressIndex: 0,
    progressTotal: 0,
    logs: [],
    resultMessage: null,
    previewStatus: "idle",
    previewTaskId: null,
    previewChapters: [],
    activeChapterUrl: null,
    selectedChapterUrls: [],
    previewError: null
  };
}

export function reduceAppState(state: AppState, action: AppAction): AppState {
  if (action.type === "previewStarted") {
    return {
      ...state,
      previewStatus: "previewing",
      previewTaskId: action.taskId,
      previewChapters: [],
      activeChapterUrl: null,
      selectedChapterUrls: [],
      previewError: null
    };
  }

  if (action.type === "previewChapter") {
    if (state.status === "running") {
      return state;
    }

    if (!matchesTask(state.previewTaskId, action.taskId)) {
      return state;
    }

    const chapter: PreviewChapter = {
      index: action.index,
      totalChapters: action.totalChapters,
      chapterTitle: action.chapterTitle,
      chapterUrl: action.chapterUrl,
      images: action.images.filter((image) => image.trim().length > 0)
    };
    const existingIndex = state.previewChapters.findIndex((item) => item.chapterUrl === action.chapterUrl);
    const nextChapters =
      existingIndex === -1
        ? [...state.previewChapters, chapter]
        : state.previewChapters.map((item, index) => (index === existingIndex ? chapter : item));
    nextChapters.sort((a, b) => a.index - b.index);

    const selectedSet = new Set(state.selectedChapterUrls);
    selectedSet.add(action.chapterUrl);

    return {
      ...state,
      previewChapters: nextChapters,
      activeChapterUrl: state.activeChapterUrl ?? action.chapterUrl,
      selectedChapterUrls: nextChapters.map((item) => item.chapterUrl).filter((url) => selectedSet.has(url))
    };
  }

  if (action.type === "previewStatus") {
    if (!matchesTask(state.previewTaskId, action.taskId)) {
      return state;
    }

    if (action.state === "starting" || action.state === "running") {
      return {
        ...state,
        previewStatus: "previewing",
        previewError: null
      };
    }

    if (action.state === "done") {
      return {
        ...state,
        previewStatus: "ready",
        previewError: null
      };
    }

    if (action.state === "failed") {
      return {
        ...state,
        previewStatus: "failed",
        previewError: action.message ?? "Preview failed"
      };
    }

    return {
      ...state,
      previewStatus: state.previewChapters.length > 0 ? "ready" : "idle",
      previewError: null
    };
  }

  if (action.type === "previewLog") {
    if (!matchesTask(state.previewTaskId, action.taskId)) {
      return state;
    }

    return {
      ...state,
      logs: [...state.logs, `[preview:${action.source}] ${action.line}`]
    };
  }

  if (action.type === "clientLog") {
    return {
      ...state,
      logs: [...state.logs, `[ui] ${action.line}`]
    };
  }

  if (action.type === "setActiveChapter") {
    const exists = state.previewChapters.some((chapter) => chapter.chapterUrl === action.chapterUrl);
    if (!exists) {
      return state;
    }
    return {
      ...state,
      activeChapterUrl: action.chapterUrl
    };
  }

  if (action.type === "toggleChapterSelection") {
    if (state.status === "running") {
      return state;
    }
    const exists = state.previewChapters.some((chapter) => chapter.chapterUrl === action.chapterUrl);
    if (!exists) {
      return state;
    }

    const selectedSet = new Set(state.selectedChapterUrls);
    if (selectedSet.has(action.chapterUrl)) {
      selectedSet.delete(action.chapterUrl);
    } else {
      selectedSet.add(action.chapterUrl);
    }

    return {
      ...state,
      selectedChapterUrls: state.previewChapters.map((chapter) => chapter.chapterUrl).filter((url) => selectedSet.has(url))
    };
  }

  if (action.type === "previewClientError") {
    return {
      ...state,
      previewStatus: "failed",
      previewError: action.message
    };
  }

  if (action.type === "started") {
    if (state.previewStatus === "previewing") {
      return state;
    }

    return {
      ...state,
      status: "running",
      taskId: action.taskId,
      progressIndex: 0,
      progressTotal: 0,
      logs: [],
      resultMessage: null
    };
  }

  if (action.type === "progress") {
    if (!matchesTask(state.taskId, action.taskId)) {
      return state;
    }
    const nextState: AppState = {
      ...state,
      progressIndex: action.index,
      progressTotal: action.totalChapters
    };

    if (action.status === "done" && action.index >= action.totalChapters && action.totalChapters > 0) {
      return {
        ...nextState,
        status: "done",
        resultMessage: "Download completed"
      };
    }

    return nextState;
  }

  if (action.type === "status") {
    if (!matchesTask(state.taskId, action.taskId)) {
      return state;
    }

    if (action.state === "starting" || action.state === "running") {
      return {
        ...state,
        status: "running"
      };
    }

    if (action.state === "done") {
      return {
        ...state,
        status: "done",
        resultMessage: action.message ?? "Download completed"
      };
    }

    if (action.state === "failed") {
      return {
        ...state,
        status: "error",
        resultMessage: action.message ?? "Download failed"
      };
    }

    return {
      ...state,
      status: "stopped",
      resultMessage: action.message ?? "Download stopped"
    };
  }

  if (action.type === "log") {
    if (!matchesTask(state.taskId, action.taskId)) {
      return state;
    }

    return {
      ...state,
      logs: [...state.logs, `[${action.source}] ${action.line}`]
    };
  }

  if (action.type === "done") {
    return {
      ...state,
      status: "done",
      resultMessage: action.message ?? "Download completed"
    };
  }

  if (action.type === "error") {
    return {
      ...state,
      status: "error",
      resultMessage: action.message
    };
  }

  if (action.type === "stopped") {
    return {
      ...state,
      status: "stopped",
      resultMessage: action.message ?? "Download stopped"
    };
  }

  return state;
}
