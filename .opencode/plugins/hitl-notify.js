import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * hitl-notify — fires ping-bot.js whenever the orchestrator pauses at a HITL gate.
 *
 * Trigger: session.idle fires when the agent stops and waits for user input,
 * which is exactly when the orchestrator has set status = "paused_hitl".
 */
export const HitlNotifyPlugin = async ({ $, directory }) => {
    return {
        'session.idle': async () => {
            const stateFilePath = findWorkflowState(directory);
            if (!stateFilePath) return;

            let state;
            try {
                state = JSON.parse(readFileSync(stateFilePath, 'utf8'));
            } catch {
                return;
            }

            if (state?.status !== 'paused_hitl') return;

            const initiativeTitle = state.initiative_title ?? 'Initiative';
            const currentStep = state.current_step ?? '';
            const taskTitle = currentStep ? `${initiativeTitle} / ${currentStep}` : initiativeTitle;

            const pingBot = resolve(directory, 'docs/agents/scripts/ping-bot.js');
            await $`node ${pingBot} ${taskTitle}`.nothrow();
        },
    };
};

/**
 * Walk up to 3 levels deep under docs/agents/initiatives/active looking for
 * any workflow-state.json that belongs to the currently active initiative.
 */
function findWorkflowState(directory) {
    const base = resolve(directory, 'docs/agents/initiatives/active');
    try {
        const entries = readdirDeep(base, 3);
        return entries.find((p) => p.endsWith('workflow-state.json')) ?? null;
    } catch {
        return null;
    }
}

function readdirDeep(dir, depth) {
    if (depth === 0) return [];
    const results = [];
    for (const name of readdirSync(dir)) {
        const full = resolve(dir, name);
        if (statSync(full).isDirectory()) {
            results.push(...readdirDeep(full, depth - 1));
        } else {
            results.push(full);
        }
    }
    return results;
}
