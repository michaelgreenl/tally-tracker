/** Default local LangGraph dev server URL. */
export const DEFAULT_AGENT_SERVER_URL = "http://localhost:2024";

type RecordValue = Record<string, unknown>;

/** Input payload used when creating or resuming a workflow run. */
export interface RunPayloadInput {
    readonly context?: RecordValue;
    readonly input?: RecordValue;
    readonly resume?: unknown;
}

/** Tool runtime context passed in by OpenCode. */
export interface RunToolContext {
    readonly directory?: string;
    readonly sessionID?: string;
    readonly worktree?: string;
}

/** Normalized workflow run result returned to the caller. */
export interface RunSummary {
    readonly interrupt?: unknown;
    readonly runSpecPath?: string;
    readonly status: "completed" | "interrupted" | "failed";
    readonly summary: string;
}

const isRecord = (value: unknown): value is RecordValue => {
    return typeof value === "object" && value !== null && !Array.isArray(value);
};

const text = (value: unknown): string | undefined => {
    if (typeof value !== "string") {
        return undefined;
    }

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : undefined;
};

/** Read the assistant ids declared in a LangGraph config file. */
export const readAssistantIDs = (langgraphConfigText: string): string[] => {
    const parsed = JSON.parse(langgraphConfigText) as unknown;

    if (!isRecord(parsed) || !isRecord(parsed.graphs)) {
        throw new Error("langgraph.json must define a `graphs` object.");
    }

    const assistantIDs = Object.keys(parsed.graphs);

    if (assistantIDs.length === 0) {
        throw new Error("langgraph.json does not define any graph assistants.");
    }

    return assistantIDs;
};

/** Resolve the assistant id to use for the workflow run. */
export const resolveAssistantID = (
    assistantIDs: readonly string[],
    providedAssistantID?: string,
): string => {
    if (providedAssistantID) {
        return providedAssistantID;
    }

    if (assistantIDs.length === 1) {
        const assistantID = assistantIDs[0];

        if (!assistantID) {
            throw new Error("langgraph.json did not provide a usable assistant id.");
        }

        return assistantID;
    }

    throw new Error(
        "Multiple assistants are defined in langgraph.json. Pass assistantID explicitly.",
    );
};

/** Extract the LangGraph API URL from dev-server log output. */
export const extractAgentServerUrl = (
    logOutput: string,
    fallback = DEFAULT_AGENT_SERVER_URL,
): string => {
    const matches = [...logOutput.matchAll(/https?:\/\/[\w.:_-]+/g)];
    const lastMatch = matches.at(-1)?.[0];

    return lastMatch ?? fallback;
};

/** Build the LangGraph run payload for a new run or resume command. */
export const buildRunPayload = ({ context, input, resume }: RunPayloadInput) => {
    if (typeof resume !== "undefined") {
        return {
            command: {
                resume,
            },
            ...(typeof context === "undefined" ? {} : { context }),
            input: null,
        };
    }

    return {
        ...(typeof context === "undefined" ? {} : { context }),
        ...(typeof input === "undefined" ? {} : { input }),
    };
};

/** Merge OpenCode tool context into the workflow runtime context payload. */
export const resolveRunContext = (
    context: RecordValue | undefined,
    toolContext: RunToolContext,
): RecordValue | undefined => {
    const merged = {
        ...(context ?? {}),
    };
    const targetRepoPath = text(toolContext.worktree) ?? text(toolContext.directory);
    const parentSessionID = text(toolContext.sessionID);

    if (targetRepoPath && !text(merged.targetRepoPath)) {
        merged.targetRepoPath = targetRepoPath;
    }

    if (parentSessionID && !text(merged.parentSessionID)) {
        merged.parentSessionID = parentSessionID;
    }

    return Object.keys(merged).length > 0 ? merged : undefined;
};

/** Normalize a LangGraph run response into a concise status summary. */
export const summarizeRunResult = (values: unknown): RunSummary => {
    if (!isRecord(values)) {
        return {
            status: "completed",
            summary: "Workflow completed.",
        };
    }

    const runSpecPath = text(values.runSpecPath);
    const summary = text(values.summary);
    const implementationSummary = text(values.implementationSummary);
    const planningSummary = text(values.planningSummary);
    const finalStatus = text(values.finalStatus);
    const interrupts = Array.isArray(values.__interrupt__) ? values.__interrupt__ : undefined;
    const interruptValue = isRecord(interrupts?.[0]) ? interrupts[0].value : undefined;
    const interruptSummary = isRecord(interruptValue) ? text(interruptValue.summary) : undefined;

    if (interrupts && interrupts.length > 0) {
        return {
            interrupt: interruptValue,
            runSpecPath,
            status: "interrupted",
            summary:
                interruptSummary ??
                summary ??
                implementationSummary ??
                planningSummary ??
                "Workflow interrupted.",
        };
    }

    if (isRecord(values.__error__)) {
        return {
            runSpecPath,
            status: "failed",
            summary:
                text(values.__error__.message) ??
                text(values.__error__.error) ??
                "Workflow failed.",
        };
    }

    return {
        runSpecPath,
        status: finalStatus === "completed" ? "completed" : "completed",
        summary: summary ?? implementationSummary ?? planningSummary ?? "Workflow completed.",
    };
};
