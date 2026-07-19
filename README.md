# InfraModeler

A specialized editor for deployment and infrastructure diagrams: network zones, servers, runtimes, software modules, databases, ESB, firewalls.

Generic drawing tools treat such diagrams as shapes and lines - consistency is manual labor. InfraModeler knows the diagram type and actively guides you: one click on a module creates the database along with a labeled JDBC connection, containers grow automatically, and invalid constructs cannot be drawn in the first place. Expressive, consistent diagrams emerge as a by-product of simply using the tool.

## Development

Requirements: Node.js 18.18 or newer, npm, Rust, and the platform-specific [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/). InfraModeler currently targets macOS 13 or newer for local desktop development.

```sh
npm install
```

Start the editor in a browser:

```sh
npm run dev
```

Start the native Tauri application with hot reload:

```sh
npm run tauri dev
```

## Build

Create the browser production bundle:

```sh
npm run build
```

Create the macOS application bundle:

```sh
npm run tauri build -- --bundles app
```

The generated application is written to `src-tauri/target/release/bundle/macos/InfraModeler.app`.

## Checks

```sh
npm run lint
npm test
npm run test:e2e
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

## Application icons

`design/icon-source.svg` is the editable source and `design/icon-1024.png` is the input for Tauri. Regenerate all platform formats without modifying the design:

```sh
npm run tauri icon design/icon-1024.png
```

## Project documents

- [Requirements document](req/anforderungsdokument-inframodeler.md) (German)
- [Technical concept](req/technisches-konzept-inframodeler.md) (German)
