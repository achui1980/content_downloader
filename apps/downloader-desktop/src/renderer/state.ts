export type AppStatus = "idle" | "running" | "done" | "error" | "stopped";

export interface AppState {
  status: AppStatus;
  taskId: string | null;
  progressIndex: number;
  progressTotal: number;
  logs: string[];
  resultMessage: string | null;
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
  | { type: "log"; taskId: string; source: "stdout" | "stderr"; line: string };

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
    resultMessage: null
  };
}

export function reduceAppState(state: AppState, action: AppAction): AppState {
  if (action.type === "started") {
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
