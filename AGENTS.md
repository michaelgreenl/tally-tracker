# AGENTS.md

* Never skip the pre-commit hooks
- Start both of the dev servers before committing. 

## Local resource limits

- Run one CPU-heavy build, export, or test job at a time.
- Use up to two build workers and reuse build caches. Build only the required architecture.
- Use `xcodebuild -jobs 2 ONLY_ACTIVE_ARCH=YES SWIFT_USE_PARALLEL_WHOLE_MODULE_OPTIMIZATION=NO` for native builds. Limit each Swift task with `OTHER_SWIFT_FLAGS='$(inherited) -j1 -num-threads 1'`.
- Limit Metro with `--max-workers 1` and Vitest with `VITEST_MAX_WORKERS=1`.
- Monitor total system CPU during heavy jobs. CPU spikes produce warnings. Stop the job only when CPU stays at or above 98% for longer than 15 seconds.
- Builds and simulator tests do not require separate user approval when these limits are followed.
