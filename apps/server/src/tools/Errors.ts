import { Schema } from "effect";

export class ToolHarnessValidationError extends Schema.TaggedErrorClass<ToolHarnessValidationError>()(
  "ToolHarnessValidationError",
  {
    operation: Schema.String,
    issue: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {
  override get message(): string {
    return `Tool harness validation failed in ${this.operation}: ${this.issue}`;
  }
}

export class ToolNotFoundError extends Schema.TaggedErrorClass<ToolNotFoundError>()(
  "ToolNotFoundError",
  {
    toolName: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {
  override get message(): string {
    return `Tool '${this.toolName}' is not registered`;
  }
}

export class ToolExecutionError extends Schema.TaggedErrorClass<ToolExecutionError>()(
  "ToolExecutionError",
  {
    toolName: Schema.String,
    detail: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {
  override get message(): string {
    return `Tool execution failed for '${this.toolName}': ${this.detail}`;
  }
}

export class ToolRunNotFoundError extends Schema.TaggedErrorClass<ToolRunNotFoundError>()(
  "ToolRunNotFoundError",
  {
    runId: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {
  override get message(): string {
    return `Tool run '${this.runId}' was not found`;
  }
}

export type ToolHarnessError =
  | ToolHarnessValidationError
  | ToolNotFoundError
  | ToolExecutionError
  | ToolRunNotFoundError;
