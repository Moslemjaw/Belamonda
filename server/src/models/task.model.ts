import type { TaskPriority, TaskStatus } from "@belamonda/shared";
import mongoose, { Schema } from "mongoose";

export type Department = "admin" | "cs" | "finance" | "clinic";

const TaskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    priority: { type: String, enum: ["red", "yellow", "green"] satisfies TaskPriority[], required: true },
    assignedDepartments: { type: [String], default: [], index: true },
    dueDate: { type: Date, required: true, index: true },
    status: { type: String, enum: ["todo", "in_progress", "completed", "archived"] satisfies TaskStatus[], default: "todo", index: true },
    attachmentRef: { type: String },
    createdBy: { type: String, required: true, index: true }
  },
  { timestamps: true }
);

TaskSchema.index({ createdAt: -1 });

export const TaskModel = mongoose.models.Task ?? mongoose.model("Task", TaskSchema);

const TaskUpdateSchema = new Schema(
  {
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    updatedBy: { type: String, required: true },
    statusChange: { type: String, enum: ["todo", "in_progress", "completed", "archived"] satisfies TaskStatus[] },
    notes: { type: String }
  },
  { timestamps: true }
);

TaskUpdateSchema.index({ taskId: 1, createdAt: -1 });

export const TaskUpdateModel =
  mongoose.models.TaskUpdate ?? mongoose.model("TaskUpdate", TaskUpdateSchema);

