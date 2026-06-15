import { spawn } from "node:child_process";
import { access, mkdir, open, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { join, relative } from "node:path";
import { tool } from "@opencode-ai/plugin";
import {
    DEFAULT_AGENT_SERVER_URL,
    buildRunPayload,
    extractAgentServerUrl,
    normalizeLangGraphConfig,
    readAssistantIDs,
    resolveAssistantID,
    resolveGlobalWorkflowRoot,
    resolveProjectRoot,
    resolveRunContext,
    resolveWorkflowRuntimeDir,
    summarizeRunResult,
    type RunToolContext,
} from "./execute-graph-lib.ts";

const DEV_STATE_FILE = ".langgraph-dev.json";
const GITIGNORE_FILE = ".gitignore";
const HEALTHCHECK_PATH = "/ok";
const HEALTHCHECK_TIMEOUT_MS = 1000;
const PROCESS_SHUTDOWN_POLL_INTERVAL_MS = 100;
const PROCESS_SHUTDOWN_TIMEOUT_MS = 2000;
const RUNTIME_CONFIG_FILE = "langgraph.runtime.json";
const RUNTIME_GITIGNORE = "*";
const STARTUP_POLL_INTERVAL_MS = 250;
const STARTUP_TIMEOUT_MS = 15000;
const WORKFLOW_NAME_PATTERN = /^[A-Za-z0-9._-]+$/;
const LANGGRAPH_DEV_COMMAND = ["npx", "--yes", "@langchain/langgraph-cli", "dev"] as const;
const WORKFLOW_RUNTIME_INSTALL_COMMAND = [
    "npm",
    "install",
    "--ignore-scripts",
    "--no-package-lock",
    "--no-save",
    "--omit=dev",
] as const;

type WorkflowLocation = {
    readonly langgraphConfigPath: string;
    readonly logPath: string;
    readonly runtimeConfigPath: string;
    readonly runtimeDir: string;
    readonly workflowMetadataPath: string;
    readonly workflowRoot: string;
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
    context: RunToolContext,
): Promise<WorkflowLocation> => {
    let projectRoot = "";

    try {
        projectRoot = resolveProjectRoot(context);
    } catch {
        throw new Error(
            `Unable to resolve a target project for workflow \`${workflow}\`: tool context did not provide a usable worktree or directory.`,
        );
    }

    const info = await stat(projectRoot).catch(() => undefined);

    if (!info?.isDirectory()) {
        throw new Error(
            `Unable to resolve a target project for workflow \`${workflow}\`: ${projectRoot} is not a directory.`,
        );
    }

    const workflowRoot = resolveGlobalWorkflowRoot(process.env, workflow);
    const runtimeDir = resolveWorkflowRuntimeDir(projectRoot, workflow);

    return {
        langgraphConfigPath: join(workflowRoot, "langgraph.json"),
        logPath: join(runtimeDir, ".langgraph-dev.log"),
        runtimeConfigPath: join(runtimeDir, RUNTIME_CONFIG_FILE),
        runtimeDir,
        workflowMetadataPath: join(workflowRoot, "mawm.json"),
        workflowRoot,
    };
};

const prepareRuntimeDir = async (
    langgraphConfigPath: string,
    runtimeConfigPath: string,
    runtimeDir: string,
    workflowRoot: string,
): Promise<string> => {
    await mkdir(runtimeDir, {
        recursive: true,
    });
    await writeFile(join(runtimeDir, GITIGNORE_FILE), RUNTIME_GITIGNORE);

    const langgraphConfig = await readFile(langgraphConfigPath, "utf8");
    const runtimeConfig = normalizeLangGraphConfig(langgraphConfig, workflowRoot);

    if (
        typeof runtimeConfig.graphs === "object" &&
        runtimeConfig.graphs !== null &&
        !Array.isArray(runtimeConfig.graphs)
    ) {
        // LangGraph preloads the first graph with path.join(cwd, file), so
        // graph specs must stay relative when the config lives in runtimeDir.
        const rebase = (value: string): string => {
            const index = value.lastIndexOf(":");

            if (index <= 1 || index === value.length - 1) {
                return relative(runtimeDir, value);
            }

            const suffix = value.slice(index + 1);

            if (suffix.includes("/") || suffix.includes("\\")) {
                return relative(runtimeDir, value);
            }

            return `${relative(runtimeDir, value.slice(0, index))}:${suffix}`;
        };
        const next: Record<string, unknown> = {};

        for (const [id, value] of Object.entries(runtimeConfig.graphs)) {
            if (typeof value === "string") {
                next[id] = rebase(value);
                continue;
            }

            if (
                typeof value === "object" &&
                value !== null &&
                !Array.isArray(value) &&
                typeof value.path === "string"
            ) {
                next[id] = {
                    ...value,
                    path: rebase(value.path),
                };
                continue;
            }

            next[id] = value;
        }

        runtimeConfig.graphs = next;
    }

    await writeFile(runtimeConfigPath, `${JSON.stringify(runtimeConfig, null, 2)}\n`);

    return langgraphConfig;
};

const agentUrl = (port: number): string => {
    const url = new URL(DEFAULT_AGENT_SERVER_URL);
    url.port = String(port);

    return url.origin;
};

const freePort = async (): Promise<number> => {
    const server = createServer();
    server.unref();

    return await new Promise<number>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();

            if (!address || typeof address === "string") {
                server.close((error) => {
                    reject(error ?? new Error("Unable to determine a free port for LangGraph."));
                });
                return;
            }

            server.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve(address.port);
            });
        });
    });
};

const waitForStartup = async (
    child: ReturnType<typeof spawn>,
    fallbackUrl: string,
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
    runtimeConfigPath: string,
    runtimeDir: string,
    workflow: string,
    workflowRoot: string,
): Promise<DevServerState> => {
    const logPath = join(runtimeDir, ".langgraph-dev.log");
    const statePath = join(runtimeDir, DEV_STATE_FILE);
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

    const port = await freePort();
    const apiUrl = agentUrl(port);
    const command = [
        ...LANGGRAPH_DEV_COMMAND,
        "--config",
        runtimeConfigPath,
        "--port",
        String(port),
        "--no-browser",
        "--no-reload",
    ];
    const logFile = await open(logPath, "a");

    try {
        await logFile.write(
            `\n[${new Date().toISOString()}] Starting workflow ${workflow} with ${command.join(" ")}\n`,
        );

        const child = spawn(command[0], command.slice(1), {
            cwd: workflowRoot,
            detached: true,
            stdio: ["ignore", logFile.fd, logFile.fd],
        });

        if (child.pid === undefined) {
            throw new Error("LangGraph process did not report a PID.");
        }

        let serverUrl = apiUrl;

        try {
            serverUrl = await waitForStartup(child, apiUrl, logPath);
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
            apiUrl: serverUrl,
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

/** Execute or resume a globally installed workflow through the local LangGraph server. */
export default tool({
    description:
        "Executes or resumes a globally installed workflow from ~/.config/mawm/<workflow> with project-local runtime state under <target-project>/.mawm/logs/<workflow> through the local LangGraph Agent Server.",
    args: {
        workflow: tool.schema
            .string()
            .describe("Globally installed workflow name under ~/.config/mawm"),
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

        const location = await resolveWorkflowLocation(workflow, context);
        let resolvedAssistantID = assistantID;
        let resolvedThreadID = threadID;
        const resolvedContext = resolveRunContext(runContext, context);

        try {
            if (!(await exists(location.workflowRoot))) {
                throw new Error(
                    `Installed global workflow not found for \`${workflow}\`: ${location.workflowRoot}`,
                );
            }

            if (!(await exists(location.workflowMetadataPath))) {
                throw new Error(`Missing workflow metadata: ${location.workflowMetadataPath}`);
            }

            if (!(await exists(location.langgraphConfigPath))) {
                throw new Error(`Missing LangGraph config: ${location.langgraphConfigPath}`);
            }

            const langgraphConfig = await prepareRuntimeDir(
                location.langgraphConfigPath,
                location.runtimeConfigPath,
                location.runtimeDir,
                location.workflowRoot,
            );
            resolvedAssistantID = resolveAssistantID(
                readAssistantIDs(langgraphConfig),
                assistantID,
            );

            const server = await ensureLangGraphServer(
                location.runtimeConfigPath,
                location.runtimeDir,
                workflow,
                location.workflowRoot,
            );
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
                    workflowRoot: location.workflowRoot,
                },
                null,
                2,
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);

            return JSON.stringify(
                {
                    assistantID: resolvedAssistantID,
                    logPath: location.logPath,
                    status: "failed",
                    summary: message,
                    threadID: resolvedThreadID,
                    workflowRoot: location.workflowRoot,
                },
                null,
                2,
            );
        }
    },
});
