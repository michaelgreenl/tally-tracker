import { spawn } from "node:child_process";
import { access, open, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tool } from "@opencode-ai/plugin";
import {
    DEFAULT_AGENT_SERVER_URL,
    buildRunPayload,
    extractAgentServerUrl,
    readAssistantIDs,
    resolveRunContext,
    resolveAssistantID,
    summarizeRunResult,
} from "./execute-graph-lib.ts";

const DEV_STATE_FILE = ".langgraph-dev.json";
const HEALTHCHECK_PATH = "/ok";
const HEALTHCHECK_TIMEOUT_MS = 1000;
const PROCESS_SHUTDOWN_POLL_INTERVAL_MS = 100;
const PROCESS_SHUTDOWN_TIMEOUT_MS = 2000;
const STARTUP_POLL_INTERVAL_MS = 250;
const STARTUP_TIMEOUT_MS = 15000;
const WORKFLOW_NAME_PATTERN = /^[A-Za-z0-9._-]+$/;
const LANGGRAPH_DEV_COMMAND = [
    "npx",
    "--yes",
    "@langchain/langgraph-cli",
    "dev",
    "--no-browser",
] as const;
const WORKFLOW_RUNTIME_INSTALL_COMMAND = [
    "npm",
    "install",
    "--ignore-scripts",
    "--no-package-lock",
    "--no-save",
    "--omit=dev",
] as const;

type ToolContext = {
    readonly directory?: string;
    readonly sessionID?: string;
    readonly worktree?: string;
};

type DevServerState = {
    readonly apiUrl: string;
    readonly logPath: string;
    readonly pid: number;
};

const exists = async (path: string): Promise<boolean> => {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
};

const sleep = async (milliseconds: number): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, milliseconds));
};

const isProcessAlive = (pid: number): boolean => {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
};

const isMissingProcessError = (error: unknown): boolean => {
    return typeof error === "object" && error !== null && "code" in error && error.code === "ESRCH";
};

const logDevServerEvent = async (logPath: string, message: string): Promise<void> => {
    await writeFile(logPath, `\n[${new Date().toISOString()}] ${message}\n`, {
        flag: "a",
    }).catch(() => undefined);
};

const isAgentServerReachable = async (apiUrl: string): Promise<boolean> => {
    try {
        const response = await fetch(`${apiUrl}${HEALTHCHECK_PATH}`, {
            signal: AbortSignal.timeout(HEALTHCHECK_TIMEOUT_MS),
        });

        return response.ok;
    } catch {
        return false;
    }
};

const waitForProcessExit = async (pid: number, timeoutMs: number): Promise<boolean> => {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
        if (!isProcessAlive(pid)) {
            return true;
        }

        await sleep(PROCESS_SHUTDOWN_POLL_INTERVAL_MS);
    }

    return !isProcessAlive(pid);
};

const signalProcess = (pid: number, signal: NodeJS.Signals): void => {
    const targets = process.platform === "win32" ? [pid] : [-pid, pid];
    let lastError: unknown;

    for (const target of targets) {
        try {
            process.kill(target, signal);
        } catch (error) {
            if (!isMissingProcessError(error)) {
                lastError = error;
            }
        }
    }

    if (lastError && isProcessAlive(pid)) {
        throw lastError;
    }
};

const stopDevServerProcess = async (pid: number): Promise<void> => {
    if (!isProcessAlive(pid)) {
        return;
    }

    try {
        signalProcess(pid, "SIGTERM");
    } catch {
        // Best-effort shutdown can continue to the exit wait and fallback kill.
    }

    if (await waitForProcessExit(pid, PROCESS_SHUTDOWN_TIMEOUT_MS)) {
        return;
    }

    try {
        signalProcess(pid, "SIGKILL");
    } catch {
        // Best-effort fallback; exit probing below decides whether cleanup succeeded.
    }

    await waitForProcessExit(pid, PROCESS_SHUTDOWN_TIMEOUT_MS);
};

const clearDevServerState = async (statePath: string): Promise<void> => {
    await rm(statePath, {
        force: true,
    }).catch(() => undefined);
};

const discardDevServer = async (
    statePath: string,
    server: Pick<DevServerState, "pid" | "logPath">,
    reason: string,
): Promise<void> => {
    await logDevServerEvent(server.logPath, reason);
    await stopDevServerProcess(server.pid);
    await clearDevServerState(statePath);
};

const waitForExit = async (child: ReturnType<typeof spawn>, task: string): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
        child.once("error", reject);
        child.once("exit", (code, signal) => {
            if (code === 0) {
                resolve();
                return;
            }

            reject(
                new Error(
                    `${task} exited with code ${code ?? "null"} and signal ${signal ?? "none"}.`,
                ),
            );
        });
    });
};

const resolveWorkflowLocation = async (
    workflow: string,
    context: ToolContext,
): Promise<{ projectRoot: string; workflowRoot: string }> => {
    const candidateRoots = [context.directory, context.worktree]
        .filter(
            (candidate): candidate is string =>
                typeof candidate === "string" && candidate.length > 0,
        )
        .map((candidate) => resolve(candidate));

    if (candidateRoots.length === 0) {
        throw new Error(
            `Unable to resolve a target project for workflow \`${workflow}\`: tool context did not provide a directory or worktree.`,
        );
    }

    const searchedWorkflowRoots: string[] = [];
    const visitedRoots = new Set<string>();

    for (const candidateRoot of candidateRoots) {
        let currentRoot = candidateRoot;

        while (!visitedRoots.has(currentRoot)) {
            visitedRoots.add(currentRoot);

            const workflowRoot = join(currentRoot, ".mawm", "graphs", workflow);
            searchedWorkflowRoots.push(workflowRoot);

            if (await exists(workflowRoot)) {
                return {
                    projectRoot: currentRoot,
                    workflowRoot,
                };
            }

            const parentRoot = dirname(currentRoot);

            if (parentRoot === currentRoot) {
                break;
            }

            currentRoot = parentRoot;
        }
    }

    throw new Error(
        `Installed workflow not found for \`${workflow}\`. Searched:\n${searchedWorkflowRoots.join("\n")}`,
    );
};

const waitForStartup = async (
    child: ReturnType<typeof spawn>,
    logPath: string,
): Promise<string> => {
    let startupError: Error | undefined;

    const handleError = (error: Error): void => {
        startupError = error;
    };

    const handleExit = (code: number | null, signal: NodeJS.Signals | null): void => {
        startupError = new Error(
            `LangGraph exited during startup (code: ${code ?? "null"}, signal: ${signal ?? "none"}).`,
        );
    };

    child.on("error", handleError);
    child.on("exit", handleExit);

    try {
        const startedAt = Date.now();
        let detectedUrl = "";

        while (Date.now() - startedAt < STARTUP_TIMEOUT_MS) {
            if (startupError) {
                throw startupError;
            }

            const logOutput = await readFile(logPath, "utf8").catch(() => "");
            detectedUrl = extractAgentServerUrl(logOutput, "");

            if (detectedUrl.length > 0 && (await isAgentServerReachable(detectedUrl))) {
                return detectedUrl;
            }

            await sleep(STARTUP_POLL_INTERVAL_MS);
        }

        if (startupError) {
            throw startupError;
        }

        const fallbackUrl = detectedUrl || DEFAULT_AGENT_SERVER_URL;

        if (await isAgentServerReachable(fallbackUrl)) {
            return fallbackUrl;
        }

        throw new Error(
            `LangGraph did not become reachable at ${fallbackUrl}${HEALTHCHECK_PATH} during startup.`,
        );
    } finally {
        child.off("error", handleError);
        child.off("exit", handleExit);
    }
};

const formatStartupError = async (
    workflow: string,
    logPath: string,
    error: unknown,
): Promise<Error> => {
    const message = error instanceof Error ? error.message : String(error);
    const logOutput = await readFile(logPath, "utf8").catch(() => "");
    const logPreview = logOutput.trim().slice(-4000);
    const logDetails = logPreview ? `\n\nRecent log output:\n${logPreview}` : "";

    return new Error(
        `Failed to start workflow \`${workflow}\`: ${message}\nLog: ${logPath}${logDetails}`,
    );
};

const ensureWorkflowRuntime = async (
    workflow: string,
    workflowRoot: string,
    logPath: string,
): Promise<void> => {
    const packageJsonPath = join(workflowRoot, "package.json");
    const runtimePath = join(workflowRoot, "node_modules", "@langchain", "langgraph");

    if (!(await exists(packageJsonPath)) || (await exists(runtimePath))) {
        return;
    }

    const logFile = await open(logPath, "a");

    try {
        await logFile.write(
            `\n[${new Date().toISOString()}] Installing workflow runtime dependencies for ${workflow} with ${WORKFLOW_RUNTIME_INSTALL_COMMAND.join(" ")}\n`,
        );

        const child = spawn(
            WORKFLOW_RUNTIME_INSTALL_COMMAND[0],
            WORKFLOW_RUNTIME_INSTALL_COMMAND.slice(1),
            {
                cwd: workflowRoot,
                stdio: ["ignore", logFile.fd, logFile.fd],
            },
        );

        await waitForExit(child, "Workflow runtime install");
    } finally {
        await logFile.close();
    }
};

const readDevServerState = async (statePath: string): Promise<DevServerState | undefined> => {
    if (!(await exists(statePath))) {
        return undefined;
    }

    const raw = JSON.parse(await readFile(statePath, "utf8")) as unknown;

    if (
        typeof raw !== "object" ||
        raw === null ||
        typeof raw.pid !== "number" ||
        typeof raw.apiUrl !== "string" ||
        typeof raw.logPath !== "string"
    ) {
        return undefined;
    }

    return raw as DevServerState;
};

const writeDevServerState = async (statePath: string, state: DevServerState): Promise<void> => {
    await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);
};

const ensureLangGraphServer = async (
    workflow: string,
    workflowRoot: string,
): Promise<DevServerState> => {
    const logPath = join(workflowRoot, ".langgraph-dev.log");
    const statePath = join(workflowRoot, DEV_STATE_FILE);
    const existing = await readDevServerState(statePath);

    if (existing) {
        if (isProcessAlive(existing.pid)) {
            if (await isAgentServerReachable(existing.apiUrl)) {
                return existing;
            }

            await discardDevServer(
                statePath,
                existing,
                `Discarding stale LangGraph dev server at ${existing.apiUrl}: ${HEALTHCHECK_PATH} is unreachable.`,
            );
        } else {
            await clearDevServerState(statePath);
        }
    }

    try {
        await ensureWorkflowRuntime(workflow, workflowRoot, logPath);
    } catch (error) {
        throw await formatStartupError(workflow, logPath, error);
    }

    const logFile = await open(logPath, "a");

    try {
        await logFile.write(
            `\n[${new Date().toISOString()}] Starting workflow ${workflow} with ${LANGGRAPH_DEV_COMMAND.join(" ")}\n`,
        );

        const child = spawn(LANGGRAPH_DEV_COMMAND[0], LANGGRAPH_DEV_COMMAND.slice(1), {
            cwd: workflowRoot,
            detached: true,
            stdio: ["ignore", logFile.fd, logFile.fd],
        });

        if (child.pid === undefined) {
            throw new Error("LangGraph process did not report a PID.");
        }

        let apiUrl = DEFAULT_AGENT_SERVER_URL;

        try {
            apiUrl = await waitForStartup(child, logPath);
        } catch (error) {
            await discardDevServer(
                statePath,
                {
                    logPath,
                    pid: child.pid,
                },
                `Stopping LangGraph dev server after startup failure for ${workflow}.`,
            );
            throw await formatStartupError(workflow, logPath, error);
        }

        child.unref();

        const state = {
            apiUrl,
            logPath,
            pid: child.pid,
        } satisfies DevServerState;
        await writeDevServerState(statePath, state);

        return state;
    } finally {
        await logFile.close();
    }
};

const request = async <T>(apiUrl: string, path: string, init: RequestInit): Promise<T> => {
    const response = await fetch(`${apiUrl}${path}`, {
        ...init,
        headers: {
            "content-type": "application/json",
            ...(init.headers ?? {}),
        },
    });

    if (!response.ok) {
        const errorText = await response.text();

        throw new Error(
            `LangGraph API request failed (${response.status} ${response.statusText}) for ${path}: ${errorText}`,
        );
    }

    if (response.status === 202 || response.status === 204) {
        return undefined as T;
    }

    return (await response.json()) as T;
};

const createThread = async (apiUrl: string): Promise<string> => {
    const thread = await request<{ thread_id?: string }>(apiUrl, "/threads", {
        body: JSON.stringify({}),
        method: "POST",
    });

    if (typeof thread.thread_id !== "string" || thread.thread_id.length === 0) {
        throw new Error("LangGraph thread creation did not return a thread_id.");
    }

    return thread.thread_id;
};

/** Execute or resume an installed workflow through the local LangGraph server. */
export default tool({
    description:
        "Executes or resumes an installed workflow from <target-project>/.mawm/graphs/<workflow> through the local LangGraph Agent Server.",
    args: {
        workflow: tool.schema
            .string()
            .describe("Installed workflow name under <target-project>/.mawm/graphs"),
        input: tool.schema
            .record(tool.schema.string(), tool.schema.unknown())
            .optional()
            .describe("Optional graph input payload"),
        context: tool.schema
            .record(tool.schema.string(), tool.schema.unknown())
            .optional()
            .describe("Optional LangGraph runtime context payload"),
        threadID: tool.schema.string().optional().describe("Existing thread id to reuse"),
        resume: tool.schema.unknown().optional().describe("Resume payload for interrupts"),
        assistantID: tool.schema
            .string()
            .optional()
            .describe("Assistant id from langgraph.json graphs"),
    },
    async execute(
        { workflow, input, context: runContext, threadID, resume, assistantID },
        context,
    ) {
        if (!WORKFLOW_NAME_PATTERN.test(workflow)) {
            throw new Error(
                `Invalid workflow name: ${workflow}. Expected letters, numbers, dots, underscores, or dashes.`,
            );
        }

        if (typeof resume !== "undefined" && !threadID) {
            throw new Error("The resume argument requires an existing threadID.");
        }

        const { workflowRoot } = await resolveWorkflowLocation(workflow, context);
        const workflowMetadataPath = join(workflowRoot, "mawm.json");
        const langgraphConfigPath = join(workflowRoot, "langgraph.json");
        const logPath = join(workflowRoot, ".langgraph-dev.log");

        if (!(await exists(workflowMetadataPath))) {
            throw new Error(`Missing workflow metadata: ${workflowMetadataPath}`);
        }

        if (!(await exists(langgraphConfigPath))) {
            throw new Error(`Missing LangGraph config: ${langgraphConfigPath}`);
        }

        let resolvedAssistantID = assistantID;
        let resolvedThreadID = threadID;
        const resolvedContext = resolveRunContext(runContext, context);

        try {
            const langgraphConfig = await readFile(langgraphConfigPath, "utf8");
            resolvedAssistantID = resolveAssistantID(
                readAssistantIDs(langgraphConfig),
                assistantID,
            );

            const server = await ensureLangGraphServer(workflow, workflowRoot);
            resolvedThreadID = threadID ?? (await createThread(server.apiUrl));
            const output = await request<Record<string, unknown>>(
                server.apiUrl,
                `/threads/${resolvedThreadID}/runs/wait`,
                {
                    body: JSON.stringify({
                        assistant_id: resolvedAssistantID,
                        ...buildRunPayload({
                            context: resolvedContext,
                            input,
                            resume,
                        }),
                    }),
                    method: "POST",
                },
            );
            const result = summarizeRunResult(output);

            return JSON.stringify(
                {
                    assistantID: resolvedAssistantID,
                    interrupt: result.interrupt,
                    logPath: server.logPath,
                    output,
                    runSpecPath: result.runSpecPath,
                    status: result.status,
                    summary: result.summary,
                    threadID: resolvedThreadID,
                    workflowRoot,
                },
                null,
                2,
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);

            return JSON.stringify(
                {
                    assistantID: resolvedAssistantID,
                    logPath,
                    status: "failed",
                    summary: message,
                    threadID: resolvedThreadID,
                    workflowRoot,
                },
                null,
                2,
            );
        }
    },
});
