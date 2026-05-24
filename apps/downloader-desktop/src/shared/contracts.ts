export type TaskStatus = "idle" | "running" | "done" | "failed";

export interface TaskState {
  status: TaskStatus;
}

export interface StartInput {
  url: string;
  outputDir: string;
  concurrency: number;
  retries: number;
}

export interface StartInputValidationResult {
  ok: boolean;
  errors: string[];
}

export function buildInitialTaskState(): TaskState {
  return { status: "idle" };
}
