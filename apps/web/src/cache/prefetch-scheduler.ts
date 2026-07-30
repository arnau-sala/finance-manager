export type PrefetchTask = {
  id: string;
  group: string;
  priority: number;
  run: () => Promise<unknown>;
  cancel?: () => void | Promise<void>;
};

type QueuedPrefetchTask = PrefetchTask & {
  sequence: number;
};

type ActivePrefetchTask = {
  task: QueuedPrefetchTask;
  interrupted: boolean;
  discarded: boolean;
};

type IdleWindow = Window & {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

const FOREGROUND_PAUSE_MS = 1_500;

class PrefetchScheduler {
  private readonly queuedTasks = new Map<string, QueuedPrefetchTask>();
  private activeTask: ActivePrefetchTask | null = null;
  private idleHandle: number | null = null;
  private idleHandleType: "idle" | "timeout" | null = null;
  private sequence = 0;
  private foregroundUntil = 0;
  private suspended = false;

  schedule(task: PrefetchTask) {
    if (
      this.queuedTasks.has(task.id) ||
      this.activeTask?.task.id === task.id
    ) {
      return;
    }

    this.queuedTasks.set(task.id, {
      ...task,
      sequence: this.sequence
    });
    this.sequence += 1;
    this.scheduleNext();
  }

  prioritizeUserRequest(pauseMs = FOREGROUND_PAUSE_MS) {
    this.foregroundUntil = Math.max(
      this.foregroundUntil,
      Date.now() + pauseMs
    );
    this.cancelScheduledStart();

    if (this.activeTask && !this.activeTask.discarded) {
      this.activeTask.interrupted = true;
      void this.activeTask.task.cancel?.();
    }

    this.scheduleNext();
  }

  cancelGroup(group: string) {
    for (const [id, task] of this.queuedTasks) {
      if (task.group === group) {
        this.queuedTasks.delete(id);
      }
    }

    if (this.activeTask?.task.group === group) {
      this.activeTask.discarded = true;
      void this.activeTask.task.cancel?.();
    }
  }

  setSuspended(suspended: boolean) {
    this.suspended = suspended;

    if (suspended) {
      this.cancelScheduledStart();
      return;
    }

    this.scheduleNext();
  }

  clear() {
    this.queuedTasks.clear();
    this.cancelScheduledStart();

    if (this.activeTask) {
      this.activeTask.discarded = true;
      void this.activeTask.task.cancel?.();
    }
  }

  private scheduleNext() {
    if (
      this.suspended ||
      this.activeTask ||
      this.idleHandle !== null ||
      this.queuedTasks.size === 0
    ) {
      return;
    }

    const waitMs = Math.max(0, this.foregroundUntil - Date.now());

    if (waitMs > 0) {
      this.idleHandleType = "timeout";
      this.idleHandle = window.setTimeout(() => {
        this.idleHandle = null;
        this.idleHandleType = null;
        this.scheduleNext();
      }, waitMs);
      return;
    }

    const idleWindow = window as IdleWindow;

    if (idleWindow.requestIdleCallback) {
      this.idleHandleType = "idle";
      this.idleHandle = idleWindow.requestIdleCallback(
        () => {
          this.idleHandle = null;
          this.idleHandleType = null;
          void this.runNext();
        },
        { timeout: 1_000 }
      );
      return;
    }

    this.idleHandleType = "timeout";
    this.idleHandle = window.setTimeout(() => {
      this.idleHandle = null;
      this.idleHandleType = null;
      void this.runNext();
    }, 50);
  }

  private cancelScheduledStart() {
    if (this.idleHandle === null) {
      return;
    }

    const idleWindow = window as IdleWindow;

    if (
      this.idleHandleType === "idle" &&
      idleWindow.cancelIdleCallback
    ) {
      idleWindow.cancelIdleCallback(this.idleHandle);
    } else {
      window.clearTimeout(this.idleHandle);
    }

    this.idleHandle = null;
    this.idleHandleType = null;
  }

  private async runNext() {
    if (
      this.suspended ||
      this.activeTask ||
      Date.now() < this.foregroundUntil
    ) {
      this.scheduleNext();
      return;
    }

    const task = [...this.queuedTasks.values()].sort(
      (left, right) =>
        left.priority - right.priority ||
        left.sequence - right.sequence
    )[0];

    if (!task) {
      return;
    }

    this.queuedTasks.delete(task.id);
    const activeTask: ActivePrefetchTask = {
      task,
      interrupted: false,
      discarded: false
    };
    this.activeTask = activeTask;

    try {
      await task.run();
    } catch {
      // Prefetch failures fall back to the foreground query when needed.
    } finally {
      if (
        activeTask.interrupted &&
        !activeTask.discarded &&
        !this.queuedTasks.has(task.id)
      ) {
        this.queuedTasks.set(task.id, {
          ...task,
          sequence: this.sequence
        });
        this.sequence += 1;
      }

      if (this.activeTask === activeTask) {
        this.activeTask = null;
      }

      this.scheduleNext();
    }
  }
}

export const prefetchScheduler = new PrefetchScheduler();
