import { homedir } from "node:os";
import { join, resolve } from "node:path";

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

const pathString = (value: unknown, key: string): string => {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new Error(`Unsupported LangGraph config at \`${key}\`: expected a string path.`);
    }

    return value;
};

const modulePath = (value: string, root: string): string => {
    const index = value.lastIndexOf(":");

    if (index <= 1 || index === value.length - 1) {
        return resolve(root, value);
    }

    const suffix = value.slice(index + 1);

    if (suffix.includes("/") || suffix.includes("\\")) {
        return resolve(root, value);
    }

    return `${resolve(root, value.slice(0, index))}:${suffix}`;
};

/**
 * Resolve the current user's home directory from an environment object.
 * Mirrors the standalone-tool precedence used by MAWM runtime code.
 */
export const resolveHomeDirectory = (env: NodeJS.ProcessEnv): string => {
    const home = env["HOME"];

    if (home) {
        return home;
    }

    const userProfile = env["USERPROFILE"];

    if (userProfile) {
        return userProfile;
    }

    const homeDrive = env["HOMEDRIVE"];
    const homePath = env["HOMEPATH"];

    if (homeDrive && homePath) {
        return `${homeDrive}${homePath}`;
    }

    return homedir();
};

/** Resolve the globally installed workflow root under the MAWM config directory. */
export const resolveGlobalWorkflowRoot = (env: NodeJS.ProcessEnv, workflow: string): string => {
    return join(resolveHomeDirectory(env), ".config", "mawm", workflow);
};

/** Resolve the target project root from tool context, preferring worktree over directory. */
export const resolveProjectRoot = (context: RunToolContext): string => {
    const root = text(context.worktree) ?? text(context.directory);

    if (!root) {
        throw new Error("Unable to resolve a target project path from tool context.");
    }

    return resolve(root);
};

/** Resolve the per-project runtime directory for a workflow execution. */
export const resolveWorkflowRuntimeDir = (projectRoot: string, workflow: string): string => {
    return join(resolve(projectRoot), ".mawm", "logs", workflow);
};

/**
 * Normalize supported LangGraph config paths so project-local runtime config
 * can run from the global workflow install directory.
 */
export const normalizeLangGraphConfig = (
    langgraphConfigText: string,
    workflowRoot: string,
): RecordValue => {
    const parsed = JSON.parse(langgraphConfigText) as unknown;

    if (!isRecord(parsed)) {
        throw new Error("langgraph.json must define a JSON object.");
    }

    const normalized = {
        ...parsed,
    } satisfies RecordValue;

    if (typeof parsed.env !== "undefined") {
        normalized.env = resolve(workflowRoot, pathString(parsed.env, "env"));
    }

    if (typeof parsed.graphs !== "undefined") {
        if (!isRecord(parsed.graphs)) {
            throw new Error("langgraph.json must define a `graphs` object.");
        }

        const graphs: RecordValue = {};

        for (const [id, value] of Object.entries(parsed.graphs)) {
            if (typeof value === "string") {
                graphs[id] = modulePath(value, workflowRoot);
                continue;
            }

            if (!isRecord(value) || !Object.hasOwn(value, "path")) {
                throw new Error(
                    `Unsupported LangGraph config at \`graphs.${id}\`: expected a string path or an object with a string \`path\`.`,
                );
            }

            graphs[id] = {
                ...value,
                path: modulePath(pathString(value.path, `graphs.${id}.path`), workflowRoot),
            };
        }

        normalized.graphs = graphs;
    }

    if (typeof parsed.auth !== "undefined") {
        if (!isRecord(parsed.auth)) {
            throw new Error(
                "Unsupported LangGraph config at `auth`: expected an object with a string `path`.",
            );
        }

        normalized.auth = Object.hasOwn(parsed.auth, "path")
            ? {
                  ...parsed.auth,
                  path: modulePath(pathString(parsed.auth.path, "auth.path"), workflowRoot),
              }
            : parsed.auth;
    }

    if (typeof parsed.http !== "undefined") {
        if (!isRecord(parsed.http)) {
            throw new Error(
                "Unsupported LangGraph config at `http`: expected an object with a string `app`.",
            );
        }

        normalized.http = Object.hasOwn(parsed.http, "app")
            ? {
                  ...parsed.http,
                  app: modulePath(pathString(parsed.http.app, "http.app"), workflowRoot),
              }
            : parsed.http;
    }

    if (typeof parsed.ui !== "undefined") {
        if (!isRecord(parsed.ui)) {
            throw new Error(
                "Unsupported LangGraph config at `ui`: expected an object of string paths.",
            );
        }

        const ui: RecordValue = {};

        for (const [id, value] of Object.entries(parsed.ui)) {
            ui[id] = modulePath(pathString(value, `ui.${id}`), workflowRoot);
        }

        normalized.ui = ui;
    }

    return normalized;
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
    const matches = [...logOutput.matchAll(/http:\/\/(?:localhost|127\.0\.0\.1):\d+/g)];
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
        input: input ?? {},
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
        status: "completed",
        summary: summary ?? implementationSummary ?? planningSummary ?? "Workflow completed.",
    };
};
