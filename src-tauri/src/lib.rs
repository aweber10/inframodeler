use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
    AppHandle, Emitter, Manager,
};
use tauri_plugin_fs::FsExt;

const FILE_SUFFIX: &str = ".imod.json";
const IMPORT_SUFFIXES: &[&str] = &[FILE_SUFFIX, ".puml", ".plantuml", ".pu"];
const RECOVERY_FILE: &str = "recovery.json";

struct InitialPath(Mutex<Option<String>>);

#[tauri::command]
fn take_initial_path(state: tauri::State<'_, InitialPath>) -> Option<String> {
    state.0.lock().ok()?.take()
}

#[tauri::command]
fn allow_diagram_path(app: AppHandle, path: String) -> Result<(), String> {
    if !IMPORT_SUFFIXES.iter().any(|suffix| path.ends_with(suffix)) {
        return Err("Ungültige Dateiendung".into());
    }
    app.fs_scope()
        .allow_file(path)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn read_recovery(app: AppHandle) -> Result<Option<String>, String> {
    let path = recovery_path(&app)?;
    match fs::read_to_string(path) {
        Ok(contents) => Ok(Some(contents)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn write_recovery(app: AppHandle, contents: String) -> Result<(), String> {
    let path = recovery_path(&app)?;
    let directory = path.parent().ok_or("Ungültiger Recovery-Pfad")?;
    fs::create_dir_all(directory).map_err(|error| error.to_string())?;
    let temporary = path.with_extension("tmp");
    fs::write(&temporary, contents).map_err(|error| error.to_string())?;
    fs::rename(temporary, path).map_err(|error| error.to_string())
}

#[tauri::command]
fn remove_recovery(app: AppHandle) -> Result<(), String> {
    let path = recovery_path(&app)?;
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.to_string()),
    }
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
            allow_diagram_path,
            read_recovery,
            write_recovery,
            remove_recovery
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
        .item(&MenuItemBuilder::with_id("exportSvg", "Als SVG exportieren …").build(app)?)
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
        "exportSvg" => Some("exportSvg"),
        _ => None,
    }
}

fn diagram_path(args: &[String], cwd: &Path) -> Option<PathBuf> {
    args.iter().skip(1).find_map(|argument| {
        if !IMPORT_SUFFIXES
            .iter()
            .any(|suffix| argument.ends_with(suffix))
        {
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

fn recovery_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join(RECOVERY_FILE))
        .map_err(|error| error.to_string())
}
