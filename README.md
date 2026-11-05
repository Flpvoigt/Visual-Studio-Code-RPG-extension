# Code Gremlin

A chaotic little creature that lives in your VS Code status bar and reacts to your code quality in real time.

## Features

- **Status bar pet** — mood (🐣 😾 🐛 💀 💤) driven by live diagnostics in your active file
- **Error jingle** — a descending beep when you save with errors
- **Victory jingle** — an ascending beep the moment you clear all errors
- **Roasts** — random sarcastic PT-BR comments when you save broken code (toggle: `codeGremlin.roastEnabled`)
- **Praise** — occasional compliments when your file is clean
- **Fake achievements** — milestone popups for errors fixed in a day
- **Idle mode** — the gremlin falls asleep (💤) after inactivity, wakes up when you're back
- **Daily report** — `Code Gremlin: Relatório do Dia` command shows saves / errors fixed / virtual coffees

## Settings

| Setting | Default | Description |
|---|---|---|
| `codeGremlin.soundEnabled` | `true` | Play beep effects on errors/wins |
| `codeGremlin.roastEnabled` | `true` | Show sarcastic messages on broken saves |
| `codeGremlin.idleMinutes` | `5` | Minutes of inactivity before the gremlin sleeps |

## Install (local dev)

1. Open this folder in VS Code
2. Press `F5` to launch an Extension Development Host
3. Open any file with errors and save it

## Publish

```
npm install -g @vscode/vsce
vsce package
vsce publish
```
