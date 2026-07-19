# InfraModeler

A specialized editor for deployment and infrastructure diagrams: network zones, servers, runtimes, software modules, databases, ESB, firewalls.

Generic drawing tools treat such diagrams as shapes and lines - consistency is manual labor. InfraModeler knows the diagram type and actively guides you: one click on a module creates the database along with a labeled JDBC connection, containers grow automatically, and invalid constructs cannot be drawn in the first place. Expressive, consistent diagrams emerge as a by-product of simply using the tool.

## Building the application

Requirements: Node.js 18.18 or newer, npm, Rust and the platform-specific Tauri prerequisites.

```sh
npm install
npm run dev
npm run tauri dev
```

Create a macOS application bundle with:

```sh
npm run tauri build -- --bundles app
```

Run checks with `npm run lint`, `npm test`, `npm run test:e2e`, `npm run build`, and `cargo check --manifest-path src-tauri/Cargo.toml`.

## Project documents

- [Requirements document](req/anforderungsdokument-inframodeler.md) (German)
- [Technical concept](req/technisches-konzept-inframodeler.md) (German)
