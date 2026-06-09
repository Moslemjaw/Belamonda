import type { TaskPriority, TaskStatus } from "@belamonda/shared";

export type Department = "admin" | "cs" | "finance" | "clinic";

export type TaskRecord = {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority; // red|yellow|green
  assignedDepartments: Department[];
  dueDate: string; // ISO
  status: TaskStatus; // todo|in_progress|completed|archived
  attachmentRef?: string;
  createdBy: string; // admin user id
  createdAt: string;
};

export type TaskUpdate = {
  id: string;
  taskId: string;
  updatedBy: string;
  statusChange?: TaskStatus;
  notes?: string;
  updatedAt: string;
};

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

const tasks = new Map<string, TaskRecord>();
const updatesByTask = new Map<string, TaskUpdate[]>();

export const tasksStore = {
  create(input: Omit<TaskRecord, "id" | "createdAt" | "status">) {
    const id = randomId("task");
    const rec: TaskRecord = { ...input, id, createdAt: nowIso(), status: "todo" };
    tasks.set(id, rec);
    updatesByTask.set(id, []);
    return rec;
  },

  listAll() {
    return Array.from(tasks.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  get(taskId: string) {
    return tasks.get(taskId) ?? null;
  },

  listForDepartment(dept: Department) {
    return this.listAll().filter((t) => t.assignedDepartments.includes(dept));
  },

  listTodaysForDepartment(dept: Department) {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return this.listForDepartment(dept).filter((t) => {
      const due = new Date(t.dueDate);
      return due >= start && due < end && t.status !== "archived";
    });
  },

  updateAdmin(taskId: string, patch: Partial<Omit<TaskRecord, "id" | "createdAt" | "createdBy">>) {
    const t = tasks.get(taskId);
    if (!t) return null;
    const updated: TaskRecord = { ...t, ...patch };
    tasks.set(taskId, updated);
    return updated;
  },

  addUpdate(taskId: string, input: Omit<TaskUpdate, "id" | "updatedAt" | "taskId">) {
    const task = tasks.get(taskId);
    if (!task) return null;
    const upd: TaskUpdate = { id: randomId("tupd"), taskId, updatedAt: nowIso(), ...input };
    const list = updatesByTask.get(taskId) ?? [];
    list.unshift(upd);
    updatesByTask.set(taskId, list);

    if (input.statusChange) {
      task.status = input.statusChange;
      tasks.set(taskId, task);
    }

    return upd;
  },

  getUpdates(taskId: string) {
    return updatesByTask.get(taskId) ?? [];
  }
};

