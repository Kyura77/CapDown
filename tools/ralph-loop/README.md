# CapDown Ralph Loop

This folder stores all persistent data for the Ralph loop harness:

- `config.example.json`: sample config
- `prompts/`: prompt templates
- `state/`: current loop state
- `logs/`: iteration logs

Usage flow:
1. Copy `config.example.json` to a local config file.
2. Choose an agent preset (`codex` or `gemini`) or set `CAPDOWN_RALPH_AGENT_CMD`.
3. Run `npm run ralph:dry-run`.
4. Inspect the generated state and logs.

## Manual flow

### Dry-run

```powershell
npm run ralph:dry-run
```

### Live run

Use a preset directly:

```powershell
npm run ralph:run:codex
```

or:

```powershell
npm run ralph:run:gemini
```

Or set a custom command template:

```powershell
$env:CAPDOWN_RALPH_AGENT_CMD='codex exec --prompt-file "{{PROMPT_FILE}}"'
```

Then run:

```powershell
npm run ralph:run
```

### Expected outputs

- `tools/ralph-loop/state/current-run.json`
- `tools/ralph-loop/logs/iteration-N.log`
- `tools/ralph-loop/state/iteration-prompt.md`

## Agent presets

- `codex`: `codex exec --prompt-file <prompt-file>`
- `gemini`: `gemini -p <prompt contents> --yolo --skip-trust`

For Gemini on Windows, the runner reads the prompt file and passes its contents to `gemini -p`. This version of Gemini CLI does not expose a native `--prompt-file` flag.
