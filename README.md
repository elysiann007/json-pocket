# JSON Pocket

Compare two JSON files locally, without dependencies or uploads. Useful for configuration changes, API-response fixtures and review notes.

## Quick start

Requires Node.js 22 or newer. No npm install is needed.

```sh
git clone https://github.com/elysiann007/json-pocket.git
cd json-pocket
node src/cli.js examples/before.json examples/after.json
node src/cli.js examples/before.json examples/after.json --json
```

Exit codes: **0** for equal values, **1** for differences (including truncated output), **2** for invalid input or I/O errors. A difference exit code is expected and can be used in scripts.

## Behavior

- Object key order is ignored; array order matters.
- Added, removed and changed values include JSON Pointer paths. The empty path identifies the root. Tilde and slash tokens follow [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901).
- Use `--max-changes N` (1–1000) to bound reported changes. `truncated: true` means additional differences exist.
- Files stay on the computer and are never rewritten. Output can contain values from your files; share it intentionally.
- This is a change report, not an executable JSON Patch. Array additions/removals are not instructions to apply in sequence.

## Limits and number semantics

Each UTF-8 file is limited to 4 MiB; a BOM is accepted. Inputs are limited to 128 nesting levels and 100000 nodes each. Unsafe integers and non-finite numbers are rejected; store large identifiers as strings. Other numbers follow JavaScript JSON parsing precision, and duplicate object names follow JSON.parse's last-value behavior.

## Development

```sh
npm test
```

CI tests Node.js 22/24 on Windows and Linux. No runtime dependencies, accounts, API keys, telemetry or network calls are used by the CLI.

## Türkçe

İki JSON dosyasının farklarını internet kullanmadan gösterir. `--json` makine tarafından okunabilir çıktı üretir. Fark bulunduğunda çıkış kodunun 1 olması normaldir; dosyalar değiştirilmez.

MIT licensed. Developed with OpenAI Codex assistance. This project does not guarantee any GitHub profile achievement.
