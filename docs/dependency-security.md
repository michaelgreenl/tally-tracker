# Dependency security

Last checked: 2026-10-01. Run `bun audit` before release. Advisory results can change without a lockfile change.

## Security updates

The lockfile includes fixes for the runtime socket parser, engine, request parser, and URL decoder. It also updates affected build and test dependencies.

Three overrides cross an upstream dependency range:

- `decode-uri-component@0.5.0` replaces a recursive decoder with the upstream security fix. Expo Router still uses CommonJS `query-string@7.1.3`. Its one-line patch reads the new decoder's default export. Remove this patch and override when Expo Router selects a fixed, compatible dependency chain. The route-parameter test covers this module boundary. [Upstream advisory](https://github.com/SamVerschueren/decode-uri-component/security/advisories/GHSA-vcc3-ghjq-m6fr).
- `deepmerge-ts@8.0.2` fixes recursive-object handling. Prisma uses its `deepmerge` export for configuration. Remove the override when Prisma selects version 8 or later. Check Prisma generation and schema validation after updates.
- `image-size@2.0.4` fixes image-parser loops in the older Metro dependency tree. That caller supplies a buffer, which the new API supports. It does not use the removed file-path API. Remove the override when React Native selects a fixed dependency. Check asset parsing and platform exports after updates.

## October audit

The October 1 audit reported five findings: two in `extract-zip`, plus `node-forge`, `basic-ftp`, and `dompurify`.
The latter two have fixes: [basic-ftp 6.2.1](https://github.com/advisories/GHSA-c475-qrg2-pj4r) and [DOMPurify 3.4.16](https://github.com/advisories/GHSA-p98j-92pf-mc4p). Both fixes are installed and locked. The repeated audit reports three high-severity tool advisories below.

## Open tool advisories

`extract-zip@2.0.1` remains through Cypress and the diagram generator's Puppeteer browser installer. These tools extract vendor browser archives. No app or API path uses them to extract user files. This limits exposure; it does not remove the build-machine risk.

The two `extract-zip` high-severity advisories have no published patch:

- [GHSA-jmr9-qjv8-65gv](https://github.com/advisories/GHSA-jmr9-qjv8-65gv).
- [GHSA-7pqw-9j4j-h8q3](https://github.com/advisories/GHSA-7pqw-9j4j-h8q3).

`node-forge@1.4.0` also has an [unpatched signature-verification advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv). It comes through Expo's CLI. Tally's provider-token verification uses `jose`, not `node-forge`. This distinction does not remove the tool risk.

Use official download sources. Do not point these installers at untrusted archives or mirrors. Use isolated CI runners without production secrets. Update the parent tools when they remove or fix this dependency.

The weekly dependency workflow keeps the full audit visible. No advisory is suppressed. A passing application test suite does not make the dependency audit clean.
