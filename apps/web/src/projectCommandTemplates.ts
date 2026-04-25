import type {
  ProjectCommandTemplate,
  ProviderInteractionMode,
  ProviderKind,
  RuntimeMode,
} from "@draft/contracts";

export interface ProjectCommandTemplateOverrides {
  readonly provider?: ProviderKind;
  readonly model?: string;
  readonly runtimeMode?: RuntimeMode;
  readonly interactionMode?: ProviderInteractionMode;
}

export interface ExpandedProjectCommandTemplate {
  readonly template: ProjectCommandTemplate;
  readonly text: string;
  readonly sendImmediately: boolean;
  readonly overrides: ProjectCommandTemplateOverrides;
}

function splitCommandArguments(argumentsText: string): ReadonlyArray<string> {
  const trimmed = argumentsText.trim();
  if (trimmed.length === 0) {
    return [];
  }
  return trimmed.split(/\s+/g);
}

function replaceAllPlaceholder(text: string, placeholder: string, value: string): string {
  return text.split(placeholder).join(value);
}

export function resolveProjectCommandTemplate(
  templates: ReadonlyArray<ProjectCommandTemplate>,
  command: string,
): ProjectCommandTemplate | null {
  const normalizedCommand = command.trim().toLowerCase();
  if (normalizedCommand.length === 0) {
    return null;
  }
  return (
    templates.find((template) => template.name.trim().toLowerCase() === normalizedCommand) ?? null
  );
}

export function expandProjectCommandTemplate(input: {
  template: ProjectCommandTemplate;
  argumentsText: string;
}): ExpandedProjectCommandTemplate {
  const positionalArguments = splitCommandArguments(input.argumentsText);
  let text = replaceAllPlaceholder(
    input.template.template,
    "$ARGUMENTS",
    input.argumentsText.trim(),
  );
  for (let index = 0; index < 9; index += 1) {
    const placeholder = `$${index + 1}`;
    text = replaceAllPlaceholder(text, placeholder, positionalArguments[index] ?? "");
  }
  return {
    template: input.template,
    text,
    sendImmediately: input.template.sendImmediately === true,
    overrides: {
      ...(input.template.provider ? { provider: input.template.provider } : {}),
      ...(input.template.model ? { model: input.template.model } : {}),
      ...(input.template.runtimeMode ? { runtimeMode: input.template.runtimeMode } : {}),
      ...(input.template.interactionMode
        ? { interactionMode: input.template.interactionMode }
        : {}),
    },
  };
}
