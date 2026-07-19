use std::{
    path::{Path, PathBuf},
    sync::Mutex,
};

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
    AppHandle, Emitter, Manager,
};
use tauri_plugin_fs::FsExt;

const FILE_SUFFIX: &str = ".imod.json";

struct InitialPath(Mutex<Option<String>>);

#[tauri::command]
fn take_initial_path(state: tauri::State<'_, InitialPath>) -> Option<String> {
    state.0.lock().ok()?.take()
}

#[tauri::command]
fn allow_diagram_path(app: AppHandle, path: String) -> Result<(), String> {
    if !path.ends_with(FILE_SUFFIX) {
        return Err("Ungültige Dateiendung".into());
    }
    app.fs_scope()
        .allow_file(path)
        .map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let initial_path = std::env::current_dir().ok().and_then(|cwd| {
        let args: Vec<String> = std::env::args().collect();
        diagram_path(&args, &cwd).and_then(|path| path.to_str().map(str::to_owned))
    });
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            if let Some(path) = diagram_path(&args, Path::new(&cwd)) {
                emit_open_path(app, path);
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }));
    }

    builder
        .manage(InitialPath(Mutex::new(initial_path)))
        .invoke_handler(tauri::generate_handler![
            take_initial_path,
            allow_diagram_path
        ])
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            app.set_menu(build_menu(app.handle())?)?;
            app.on_menu_event(|app, event| {
                if let Some(action) = menu_action(event.id().as_ref()) {
                    let _ = app.emit("app-action", action);
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running InfraModeler");
}

fn build_menu(app: &AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    let app_menu = SubmenuBuilder::new(app, "InfraModeler")
        .about(None)
        .separator()
        .quit()
        .build()?;

    let file = SubmenuBuilder::new(app, "Ablage")
        .item(
            &MenuItemBuilder::with_id("new", "Neu")
                .accelerator("CmdOrCtrl+N")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("open", "Öffnen …")
                .accelerator("CmdOrCtrl+O")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("save", "Speichern")
                .accelerator("CmdOrCtrl+S")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("saveAs", "Speichern unter …")
                .accelerator("CmdOrCtrl+Shift+S")
                .build(app)?,
        )
        .separator()
        .item(&MenuItemBuilder::with_id("example", "Beispieldiagramm öffnen").build(app)?)
        .build()?;

    let edit = SubmenuBuilder::new(app, "Bearbeiten")
        .item(
            &MenuItemBuilder::with_id("undo", "Rückgängig")
                .accelerator("CmdOrCtrl+Z")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("redo", "Wiederholen")
                .accelerator("CmdOrCtrl+Shift+Z")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("cut", "Ausschneiden")
                .accelerator("CmdOrCtrl+X")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("copy", "Kopieren")
                .accelerator("CmdOrCtrl+C")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("paste", "Einfügen")
                .accelerator("CmdOrCtrl+V")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("delete", "Löschen")
                .accelerator("Backspace")
                .build(app)?,
        )
        .build()?;

    let view = SubmenuBuilder::new(app, "Darstellung")
        .item(&MenuItemBuilder::with_id("fitViewport", "Diagramm einpassen").build(app)?)
        .build()?;

    let help = SubmenuBuilder::new(app, "Hilfe")
        .item(&PredefinedMenuItem::about(
            app,
            Some("Über InfraModeler"),
            None,
        )?)
        .build()?;

    MenuBuilder::new(app)
        .items(&[&app_menu, &file, &edit, &view, &help])
        .build()
}

fn menu_action(id: &str) -> Option<&'static str> {
    match id {
        "new" => Some("new"),
        "open" => Some("open"),
        "save" => Some("save"),
        "saveAs" => Some("saveAs"),
        "example" => Some("example"),
        "undo" => Some("undo"),
        "redo" => Some("redo"),
        "cut" => Some("cut"),
        "copy" => Some("copy"),
        "paste" => Some("paste"),
        "delete" => Some("delete"),
        "fitViewport" => Some("fitViewport"),
        _ => None,
    }
}

fn diagram_path(args: &[String], cwd: &Path) -> Option<PathBuf> {
    args.iter().skip(1).find_map(|argument| {
        if !argument.ends_with(FILE_SUFFIX) {
            return None;
        }
        let path = PathBuf::from(argument);
        Some(if path.is_absolute() {
            path
        } else {
            cwd.join(path)
        })
    })
}

fn emit_open_path(app: &AppHandle, path: PathBuf) {
    if let Some(path) = path.to_str() {
        let _ = app.emit("open-path", path);
    }
}
