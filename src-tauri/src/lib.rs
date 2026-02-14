mod window;

use std::{
    fs,
    fs::OpenOptions,
    io::Write,
    path::{Path, PathBuf},
    sync::atomic::{AtomicBool, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager, Runtime,
};
use tauri_plugin_global_shortcut::{Code, Modifiers, ShortcutState};

const TRAY_ID: &str = "daily-tray";
const TRAY_MENU_OPEN_MAIN: &str = "tray-open-main";
const TRAY_MENU_TOGGLE_WIDGET_VISIBILITY: &str = "tray-toggle-widget-visibility";
const TRAY_MENU_TOGGLE_WIDGET_LOCK: &str = "tray-toggle-widget-lock";
const TRAY_MENU_EXIT: &str = "tray-exit";
const EVENT_WIDGET_SET_LOCK: &str = "widget-set-lock-state";
const EVENT_WIDGET_SET_VISIBILITY: &str = "widget-set-visibility-state";
const PROJECT_ROOT_DIR_NAME: &str = ".daily";
const PROJECT_DATA_DIR_NAME: &str = "data";
const PROJECT_LOGS_DIR_NAME: &str = "logs";
const PROJECT_BACKUP_DIR_NAME: &str = "backup";
const DATA_FILE_NAME: &str = "data.json";
const CONFIG_FILE_NAME: &str = "config.json";
const LOG_FILE_NAME: &str = "events.jsonl";
const CONFIG_SCHEMA_VERSION: u32 = 1;
#[cfg(windows)]
const WIN_UNREGISTER_CLASS_ERROR_TOKEN: &str =
    "Failed to unregister class Chrome_WidgetWin_0. Error = 1412";

#[derive(Default)]
struct ExitState(AtomicBool);

#[derive(Default)]
struct WidgetLockState(AtomicBool);

#[derive(Default)]
struct WidgetVisibilityState(AtomicBool);

struct ProjectDirectories {
    root: PathBuf,
    data: PathBuf,
    logs: PathBuf,
    backup: PathBuf,
}

#[allow(dead_code)]
fn tray_toggle_lock_label(locked: bool) -> &'static str {
    if locked {
        "解锁 Widget"
    } else {
        "锁定 Widget"
    }
}

#[allow(dead_code)]
fn build_tray_menu<R: Runtime>(
    app: &tauri::AppHandle<R>,
    widget_locked: bool,
) -> tauri::Result<Menu<R>> {
    let tray_open_item = MenuItem::with_id(
        app,
        TRAY_MENU_OPEN_MAIN,
        "打开标准窗口",
        true,
        None::<&str>,
    )?;
    let tray_toggle_lock_item = MenuItem::with_id(
        app,
        TRAY_MENU_TOGGLE_WIDGET_LOCK,
        tray_toggle_lock_label(widget_locked),
        true,
        None::<&str>,
    )?;
    let tray_exit_item = MenuItem::with_id(app, TRAY_MENU_EXIT, "退出应用", true, None::<&str>)?;

    Menu::with_items(
        app,
        &[&tray_open_item, &tray_toggle_lock_item, &tray_exit_item],
    )
}

#[allow(dead_code)]
fn refresh_tray_menu<R: Runtime>(app: &tauri::AppHandle<R>, widget_locked: bool) {
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        return;
    };

    if let Ok(tray_menu) = build_tray_menu(app, widget_locked) {
        let _ = tray.set_menu(Some(tray_menu));
    }
}

#[allow(dead_code)]
fn toggle_widget_lock<R: Runtime>(app: &tauri::AppHandle<R>) {
    let Some(widget_lock_state) = app.try_state::<WidgetLockState>() else {
        return;
    };

    let next_locked = !widget_lock_state.0.load(Ordering::SeqCst);
    widget_lock_state.0.store(next_locked, Ordering::SeqCst);
    refresh_tray_menu(app, next_locked);
    let _ = app.emit(EVENT_WIDGET_SET_LOCK, next_locked);
    log_project_event(
        app,
        "info",
        "widget.lock.toggled",
        "Widget lock state changed.",
        Some(serde_json::json!({ "locked": next_locked })),
    );
}

fn tray_toggle_lock_label_v2(locked: bool) -> &'static str {
    if locked {
        "Unlock Widget"
    } else {
        "Lock Widget"
    }
}

fn tray_toggle_visibility_label_v2(visible: bool) -> &'static str {
    if visible {
        "Hide Widget"
    } else {
        "Show Widget"
    }
}

fn build_tray_menu_v2<R: Runtime>(app: &tauri::AppHandle<R>, widget_locked: bool, widget_visible: bool) -> tauri::Result<Menu<R>> {
    let tray_open_item = MenuItem::with_id(app, TRAY_MENU_OPEN_MAIN, "Open Main Window", true, None::<&str>)?;
    let tray_toggle_visibility_item = MenuItem::with_id(
        app,
        TRAY_MENU_TOGGLE_WIDGET_VISIBILITY,
        tray_toggle_visibility_label_v2(widget_visible),
        true,
        None::<&str>,
    )?;
    let tray_toggle_lock_item = MenuItem::with_id(
        app,
        TRAY_MENU_TOGGLE_WIDGET_LOCK,
        tray_toggle_lock_label_v2(widget_locked),
        true,
        None::<&str>,
    )?;
    let tray_exit_item = MenuItem::with_id(app, TRAY_MENU_EXIT, "Exit", true, None::<&str>)?;

    Menu::with_items(app, &[&tray_open_item, &tray_toggle_visibility_item, &tray_toggle_lock_item, &tray_exit_item])
}

fn refresh_tray_menu_v2<R: Runtime>(app: &tauri::AppHandle<R>) {
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        return;
    };

    let widget_locked = app
        .try_state::<WidgetLockState>()
        .map(|state| state.0.load(Ordering::SeqCst))
        .unwrap_or(false);
    let widget_visible = app
        .try_state::<WidgetVisibilityState>()
        .map(|state| state.0.load(Ordering::SeqCst))
        .unwrap_or(false);

    if let Ok(tray_menu) = build_tray_menu_v2(app, widget_locked, widget_visible) {
        let _ = tray.set_menu(Some(tray_menu));
    }
}

fn resolve_app_config_file_path<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    let directories = ensure_project_directories(app)?;
    Ok(directories.data.join(CONFIG_FILE_NAME))
}

fn read_app_config_file(path: &Path) -> Result<Option<serde_json::Value>, String> {
    if !path.exists() {
        return Ok(None);
    }

    let raw = fs::read_to_string(path).map_err(|error| format!("failed to read app config file: {error}"))?;
    let config = serde_json::from_str::<serde_json::Value>(&raw)
        .map_err(|error| format!("failed to parse app config file: {error}"))?;

    Ok(Some(config))
}

fn write_app_config_file(path: &Path, config: &serde_json::Value) -> Result<(), String> {
    if let Some(parent_dir) = path.parent() {
        ensure_directory_exists(parent_dir)?;
    }

    let temp_path = path.with_extension("json.tmp");
    let serialized =
        serde_json::to_string_pretty(config).map_err(|error| format!("failed to serialize app config: {error}"))?;

    fs::write(&temp_path, serialized).map_err(|error| format!("failed to write app config temp file: {error}"))?;

    if path.exists() {
        fs::remove_file(path).map_err(|error| format!("failed to replace app config file: {error}"))?;
    }

    fs::rename(&temp_path, path).map_err(|error| format!("failed to finalize app config file: {error}"))?;

    Ok(())
}

fn persist_widget_visibility_v2<R: Runtime>(app: &tauri::AppHandle<R>, visible: bool) -> Result<(), String> {
    let config_file_path = resolve_app_config_file_path(app)?;
    let mut next_config = read_app_config_file(&config_file_path)?.unwrap_or_else(|| serde_json::json!({}));

    if !next_config.is_object() {
        next_config = serde_json::json!({});
    }

    if let Some(config_object) = next_config.as_object_mut() {
        config_object.insert("schemaVersion".to_string(), serde_json::json!(CONFIG_SCHEMA_VERSION));
        config_object.insert("widgetVisible".to_string(), serde_json::json!(visible));
    }

    write_app_config_file(&config_file_path, &next_config)
}

fn toggle_widget_visibility_v2<R: Runtime>(app: &tauri::AppHandle<R>) {
    let Some(widget_visibility_state) = app.try_state::<WidgetVisibilityState>() else {
        return;
    };

    let next_visible = !widget_visibility_state.0.load(Ordering::SeqCst);
    widget_visibility_state.0.store(next_visible, Ordering::SeqCst);

    let _ = persist_widget_visibility_v2(app, next_visible);
    refresh_tray_menu_v2(app);
    let _ = app.emit(EVENT_WIDGET_SET_VISIBILITY, next_visible);
    log_project_event(
        app,
        "info",
        "widget.visibility.toggled",
        "Widget visibility changed.",
        Some(serde_json::json!({ "visible": next_visible })),
    );
}

fn toggle_widget_lock_v2<R: Runtime>(app: &tauri::AppHandle<R>) {
    let Some(widget_lock_state) = app.try_state::<WidgetLockState>() else {
        return;
    };

    let next_locked = !widget_lock_state.0.load(Ordering::SeqCst);
    widget_lock_state.0.store(next_locked, Ordering::SeqCst);
    refresh_tray_menu_v2(app);
    let _ = app.emit(EVENT_WIDGET_SET_LOCK, next_locked);
    log_project_event(
        app,
        "info",
        "widget.lock.toggled",
        "Widget lock state changed.",
        Some(serde_json::json!({ "locked": next_locked })),
    );
}

#[cfg(windows)]
fn is_ignorable_shutdown_error(error: &tauri::Error) -> bool {
    error.to_string().contains(WIN_UNREGISTER_CLASS_ERROR_TOKEN)
}

#[cfg(not(windows))]
fn is_ignorable_shutdown_error(_error: &tauri::Error) -> bool {
    false
}

fn ensure_directory_exists(path: &Path) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|error| format!("failed to create directory `{}`: {error}", path.display()))
}

fn resolve_project_root_dir<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    let home_dir = app
        .path()
        .home_dir()
        .map_err(|error| format!("failed to resolve user home directory: {error}"))?;
    Ok(home_dir.join(PROJECT_ROOT_DIR_NAME))
}

fn resolve_project_directories<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<ProjectDirectories, String> {
    let root = resolve_project_root_dir(app)?;
    Ok(ProjectDirectories {
        data: root.join(PROJECT_DATA_DIR_NAME),
        logs: root.join(PROJECT_LOGS_DIR_NAME),
        backup: root.join(PROJECT_BACKUP_DIR_NAME),
        root,
    })
}

fn ensure_project_directories<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<ProjectDirectories, String> {
    let directories = resolve_project_directories(app)?;
    ensure_directory_exists(&directories.root)?;
    ensure_directory_exists(&directories.data)?;
    ensure_directory_exists(&directories.logs)?;
    ensure_directory_exists(&directories.backup)?;
    Ok(directories)
}

fn resolve_app_data_file_path<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    let directories = ensure_project_directories(app)?;
    Ok(directories.data.join(DATA_FILE_NAME))
}

fn resolve_project_log_file_path<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    let directories = ensure_project_directories(app)?;
    Ok(directories.logs.join(LOG_FILE_NAME))
}

fn now_unix_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

fn create_log_entry(
    level: &str,
    event: &str,
    message: &str,
    data: Option<serde_json::Value>,
) -> serde_json::Value {
    serde_json::json!({
        "timestamp": now_unix_millis(),
        "level": level,
        "event": event,
        "message": message,
        "data": data
    })
}

fn append_jsonl(path: &Path, line: &serde_json::Value) -> Result<(), String> {
    if let Some(parent_dir) = path.parent() {
        ensure_directory_exists(parent_dir)?;
    }

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|error| format!("failed to open log file `{}`: {error}", path.display()))?;

    let serialized = serde_json::to_string(line).map_err(|error| format!("failed to serialize log line: {error}"))?;
    writeln!(file, "{serialized}")
        .map_err(|error| format!("failed to append log line `{}`: {error}", path.display()))?;

    Ok(())
}

fn log_project_event<R: Runtime>(
    app: &tauri::AppHandle<R>,
    level: &str,
    event: &str,
    message: &str,
    data: Option<serde_json::Value>,
) {
    let Ok(log_file_path) = resolve_project_log_file_path(app) else {
        return;
    };
    let _ = append_jsonl(&log_file_path, &create_log_entry(level, event, message, data));
}

fn read_app_data_file(path: &Path) -> Result<Option<serde_json::Value>, String> {
    if !path.exists() {
        return Ok(None);
    }

    let raw = fs::read_to_string(path).map_err(|error| format!("failed to read app data file: {error}"))?;
    let data = serde_json::from_str::<serde_json::Value>(&raw)
        .map_err(|error| format!("failed to parse app data file: {error}"))?;

    Ok(Some(data))
}

fn write_app_data_file(path: &Path, data: &serde_json::Value) -> Result<(), String> {
    if let Some(parent_dir) = path.parent() {
        ensure_directory_exists(parent_dir)?;
    }

    let temp_path = path.with_extension("json.tmp");
    let serialized =
        serde_json::to_string_pretty(data).map_err(|error| format!("failed to serialize app data: {error}"))?;

    fs::write(&temp_path, serialized).map_err(|error| format!("failed to write app data temp file: {error}"))?;

    if path.exists() {
        fs::remove_file(path).map_err(|error| format!("failed to replace app data file: {error}"))?;
    }

    fs::rename(&temp_path, path).map_err(|error| format!("failed to finalize app data file: {error}"))?;

    Ok(())
}

#[tauri::command]
fn ensure_widget_window(app: tauri::AppHandle) -> Result<(), String> {
    window::ensure_widget_window(&app)
}

#[tauri::command]
fn focus_main_window(app: tauri::AppHandle) -> Result<(), String> {
    window::focus_main_window(&app)
}

#[tauri::command]
fn sync_widget_locked_state(app: tauri::AppHandle, locked: bool) -> Result<(), String> {
    let Some(widget_lock_state) = app.try_state::<WidgetLockState>() else {
        return Err("Widget lock state is not initialized.".to_string());
    };

    widget_lock_state.0.store(locked, Ordering::SeqCst);
    refresh_tray_menu_v2(&app);
    Ok(())
}

#[tauri::command]
fn sync_widget_visibility_state(app: tauri::AppHandle, visible: bool) -> Result<(), String> {
    let Some(widget_visibility_state) = app.try_state::<WidgetVisibilityState>() else {
        return Err("Widget visibility state is not initialized.".to_string());
    };

    widget_visibility_state.0.store(visible, Ordering::SeqCst);
    persist_widget_visibility_v2(&app, visible)?;
    refresh_tray_menu_v2(&app);
    Ok(())
}

#[tauri::command]
fn load_app_data(app: tauri::AppHandle) -> Result<Option<serde_json::Value>, String> {
    let app_data_path = resolve_app_data_file_path(&app)?;
    match read_app_data_file(&app_data_path) {
        Ok(data) => {
            log_project_event(
                &app,
                "info",
                "data.load.success",
                "Loaded data.json successfully.",
                Some(serde_json::json!({
                    "path": app_data_path.display().to_string(),
                    "has_data": data.is_some()
                })),
            );
            Ok(data)
        }
        Err(error) => {
            log_project_event(
                &app,
                "error",
                "data.load.failure",
                "Failed to load data.json.",
                Some(serde_json::json!({
                    "path": app_data_path.display().to_string(),
                    "error": error
                })),
            );
            Err(error)
        }
    }
}

#[tauri::command]
fn save_app_data(app: tauri::AppHandle, data: serde_json::Value) -> Result<(), String> {
    let app_data_path = resolve_app_data_file_path(&app)?;
    match write_app_data_file(&app_data_path, &data) {
        Ok(()) => {
            log_project_event(
                &app,
                "info",
                "data.save.success",
                "Saved data.json successfully.",
                Some(serde_json::json!({
                    "path": app_data_path.display().to_string()
                })),
            );
            Ok(())
        }
        Err(error) => {
            log_project_event(
                &app,
                "error",
                "data.save.failure",
                "Failed to save data.json.",
                Some(serde_json::json!({
                    "path": app_data_path.display().to_string(),
                    "error": error
                })),
            );
            Err(error)
        }
    }
}

#[tauri::command]
fn load_app_config(app: tauri::AppHandle) -> Result<Option<serde_json::Value>, String> {
    let app_config_path = resolve_app_config_file_path(&app)?;
    match read_app_config_file(&app_config_path) {
        Ok(config) => {
            log_project_event(
                &app,
                "info",
                "config.load.success",
                "Loaded config.json successfully.",
                Some(serde_json::json!({
                    "path": app_config_path.display().to_string(),
                    "has_data": config.is_some()
                })),
            );
            Ok(config)
        }
        Err(error) => {
            log_project_event(
                &app,
                "error",
                "config.load.failure",
                "Failed to load config.json.",
                Some(serde_json::json!({
                    "path": app_config_path.display().to_string(),
                    "error": error
                })),
            );
            Err(error)
        }
    }
}

#[tauri::command]
fn save_app_config(app: tauri::AppHandle, config: serde_json::Value) -> Result<(), String> {
    let app_config_path = resolve_app_config_file_path(&app)?;
    match write_app_config_file(&app_config_path, &config) {
        Ok(()) => {
            log_project_event(
                &app,
                "info",
                "config.save.success",
                "Saved config.json successfully.",
                Some(serde_json::json!({
                    "path": app_config_path.display().to_string()
                })),
            );
            Ok(())
        }
        Err(error) => {
            log_project_event(
                &app,
                "error",
                "config.save.failure",
                "Failed to save config.json.",
                Some(serde_json::json!({
                    "path": app_config_path.display().to_string(),
                    "error": error
                })),
            );
            Err(error)
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let result = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }

            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let is_exiting = window
                    .app_handle()
                    .try_state::<ExitState>()
                    .map(|state| state.0.load(Ordering::SeqCst))
                    .unwrap_or(false);
                if is_exiting {
                    return;
                }

                api.prevent_close();
                let _ = window.minimize();
            }
        })
        .on_menu_event(|app, event| match event.id().as_ref() {
            TRAY_MENU_OPEN_MAIN => {
                if let Some(main_window) = app.get_webview_window("main") {
                    let _ = main_window.show();
                    let _ = main_window.unminimize();
                    let _ = main_window.set_focus();
                }
                log_project_event(
                    app,
                    "info",
                    "tray.open_main",
                    "Tray menu requested opening main window.",
                    None,
                );
            }
            TRAY_MENU_TOGGLE_WIDGET_LOCK => {
                toggle_widget_lock_v2(app);
                log_project_event(
                    app,
                    "info",
                    "tray.toggle_widget_lock",
                    "Tray menu requested toggling widget lock.",
                    None,
                );
            }
            TRAY_MENU_TOGGLE_WIDGET_VISIBILITY => {
                toggle_widget_visibility_v2(app);
                log_project_event(
                    app,
                    "info",
                    "tray.toggle_widget_visibility",
                    "Tray menu requested toggling widget visibility.",
                    None,
                );
            }
            TRAY_MENU_EXIT => {
                if let Some(exit_state) = app.try_state::<ExitState>() {
                    exit_state.0.store(true, Ordering::SeqCst);
                }

                log_project_event(
                    app,
                    "info",
                    "tray.exit",
                    "Tray menu requested app exit.",
                    None,
                );
                app.exit(0);
            }
            _ => {}
        })
        .setup(|app| {
            let directories = ensure_project_directories(&app.handle())?;
            println!("[daily] project data root: {}", directories.root.display());
            println!("[daily] data file path: {}", directories.data.join(DATA_FILE_NAME).display());
            println!("[daily] config file path: {}", directories.data.join(CONFIG_FILE_NAME).display());
            log_project_event(
                &app.handle(),
                "info",
                "app.startup",
                "Application startup completed and directories ensured.",
                Some(serde_json::json!({
                    "root": directories.root.display().to_string(),
                    "data_dir": directories.data.display().to_string(),
                    "logs_dir": directories.logs.display().to_string(),
                    "backup_dir": directories.backup.display().to_string(),
                })),
            );

            #[cfg(desktop)]
            {
                app.manage(ExitState::default());
                app.manage(WidgetLockState::default());
                let initial_widget_visible = read_app_config_file(&directories.data.join(CONFIG_FILE_NAME))
                    .ok()
                    .flatten()
                    .and_then(|config| config.get("widgetVisible").and_then(serde_json::Value::as_bool))
                    .unwrap_or(false);
                app.manage(WidgetVisibilityState(AtomicBool::new(initial_widget_visible)));

                let widget_locked = app
                    .try_state::<WidgetLockState>()
                    .map(|state| state.0.load(Ordering::SeqCst))
                    .unwrap_or(false);
                let widget_visible = app
                    .try_state::<WidgetVisibilityState>()
                    .map(|state| state.0.load(Ordering::SeqCst))
                    .unwrap_or(false);
                let tray_menu = build_tray_menu_v2(&app.handle(), widget_locked, widget_visible)?;

                let mut tray_builder = TrayIconBuilder::with_id(TRAY_ID)
                    .menu(&tray_menu)
                    .show_menu_on_left_click(false)
                    .tooltip("daily");

                if let Some(default_icon) = app.default_window_icon().cloned() {
                    tray_builder = tray_builder.icon(default_icon);
                }

                tray_builder.build(app)?;

                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_shortcuts(["ctrl+shift+l"])?
                        .with_handler(|app, shortcut, event| {
                            if event.state == ShortcutState::Pressed
                                && shortcut
                                    .matches(Modifiers::CONTROL | Modifiers::SHIFT, Code::KeyL)
                            {
                                toggle_widget_lock_v2(app);
                                log_project_event(
                                    app,
                                    "info",
                                    "shortcut.toggle_widget_lock",
                                    "Global shortcut requested widget lock toggle.",
                                    Some(serde_json::json!({
                                        "shortcut": "Ctrl+Shift+L"
                                    })),
                                );
                            }
                        })
                        .build(),
                )?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ensure_widget_window,
            focus_main_window,
            sync_widget_locked_state,
            sync_widget_visibility_state,
            load_app_data,
            save_app_data,
            load_app_config,
            save_app_config
        ])
        .run(tauri::generate_context!());

    if let Err(error) = result {
        if is_ignorable_shutdown_error(&error) {
            eprintln!("[exit] ignored known Windows shutdown error: {error}");
            return;
        }

        panic!("error while running tauri application: {error}");
    }
}

#[cfg(test)]
mod tests {
    use super::{
        append_jsonl, create_log_entry, ensure_directory_exists, read_app_config_file, read_app_data_file,
        write_app_config_file, write_app_data_file,
    };
    use serde_json::json;
    use std::{fs, path::PathBuf};

    fn make_temp_path(temp_dir: &tempfile::TempDir, path: &str) -> PathBuf {
        temp_dir.path().join(path)
    }

    #[test]
    fn ensure_directory_creates_missing_path() {
        let temp_dir = tempfile::tempdir().expect("create temp dir");
        let missing = make_temp_path(&temp_dir, "a/b/c");

        assert!(!missing.exists());
        ensure_directory_exists(&missing).expect("directory should be created");
        assert!(missing.exists());
        assert!(missing.is_dir());
    }

    #[test]
    fn read_returns_none_when_file_missing() {
        let temp_dir = tempfile::tempdir().expect("create temp dir");
        let data_file_path = make_temp_path(&temp_dir, "data.json");

        let loaded = read_app_data_file(&data_file_path).expect("read should succeed");
        assert!(loaded.is_none());
    }

    #[test]
    fn read_config_returns_none_when_file_missing() {
        let temp_dir = tempfile::tempdir().expect("create temp dir");
        let config_file_path = make_temp_path(&temp_dir, "config.json");

        let loaded = read_app_config_file(&config_file_path).expect("read should succeed");
        assert!(loaded.is_none());
    }

    #[test]
    fn write_then_read_roundtrip_json() {
        let temp_dir = tempfile::tempdir().expect("create temp dir");
        let data_file_path = make_temp_path(&temp_dir, "nested/data.json");
        let expected = json!({
            "schemaVersion": 1,
            "tasks": [{"id": "t-1", "title": "demo"}],
            "globals": [],
            "logs": []
        });

        write_app_data_file(&data_file_path, &expected).expect("write should succeed");
        let loaded = read_app_data_file(&data_file_path)
            .expect("read should succeed")
            .expect("file should exist");

        assert_eq!(loaded, expected);
        assert!(!data_file_path.with_extension("json.tmp").exists());
    }

    #[test]
    fn write_then_read_roundtrip_config_json() {
        let temp_dir = tempfile::tempdir().expect("create temp dir");
        let config_file_path = make_temp_path(&temp_dir, "nested/config.json");
        let expected = json!({
            "schemaVersion": 1,
            "widgetVisible": true
        });

        write_app_config_file(&config_file_path, &expected).expect("write should succeed");
        let loaded = read_app_config_file(&config_file_path)
            .expect("read should succeed")
            .expect("file should exist");

        assert_eq!(loaded, expected);
        assert!(!config_file_path.with_extension("json.tmp").exists());
    }

    #[test]
    fn write_overwrites_existing_json_content() {
        let temp_dir = tempfile::tempdir().expect("create temp dir");
        let data_file_path = make_temp_path(&temp_dir, "data.json");

        write_app_data_file(&data_file_path, &json!({"value": 1})).expect("first write should succeed");
        write_app_data_file(&data_file_path, &json!({"value": 2})).expect("second write should succeed");

        let loaded = read_app_data_file(&data_file_path)
            .expect("read should succeed")
            .expect("file should exist");

        assert_eq!(loaded, json!({"value": 2}));
    }

    #[test]
    fn read_invalid_json_returns_parse_error() {
        let temp_dir = tempfile::tempdir().expect("create temp dir");
        let data_file_path = make_temp_path(&temp_dir, "data.json");
        fs::write(&data_file_path, "{invalid json").expect("write invalid file");

        let error = read_app_data_file(&data_file_path).expect_err("should fail parse");
        assert!(error.contains("failed to parse app data file"));
    }

    #[test]
    fn append_jsonl_creates_log_file_and_writes_single_line() {
        let temp_dir = tempfile::tempdir().expect("create temp dir");
        let log_file_path = make_temp_path(&temp_dir, "logs/events.jsonl");
        let line = json!({ "event": "startup", "ok": true });

        append_jsonl(&log_file_path, &line).expect("append should succeed");
        let content = fs::read_to_string(&log_file_path).expect("log file should exist");
        let parsed: serde_json::Value = serde_json::from_str(content.trim_end()).expect("line should be valid json");

        assert_eq!(parsed["event"], "startup");
        assert_eq!(parsed["ok"], true);
    }

    #[test]
    fn append_jsonl_appends_multiple_lines() {
        let temp_dir = tempfile::tempdir().expect("create temp dir");
        let log_file_path = make_temp_path(&temp_dir, "logs/events.jsonl");

        append_jsonl(&log_file_path, &json!({ "index": 1 })).expect("first append should succeed");
        append_jsonl(&log_file_path, &json!({ "index": 2 })).expect("second append should succeed");

        let content = fs::read_to_string(&log_file_path).expect("log file should exist");
        let lines: Vec<&str> = content.lines().collect();
        assert_eq!(lines.len(), 2);

        let first: serde_json::Value = serde_json::from_str(lines[0]).expect("first line should be valid");
        let second: serde_json::Value = serde_json::from_str(lines[1]).expect("second line should be valid");
        assert_eq!(first["index"], 1);
        assert_eq!(second["index"], 2);
    }

    #[test]
    fn create_log_entry_contains_required_fields() {
        let entry = create_log_entry(
            "info",
            "data.save.success",
            "Saved data.json successfully.",
            Some(json!({ "path": "/tmp/data.json" })),
        );

        assert_eq!(entry["level"], "info");
        assert_eq!(entry["event"], "data.save.success");
        assert_eq!(entry["message"], "Saved data.json successfully.");
        assert_eq!(entry["data"]["path"], "/tmp/data.json");
        assert!(entry["timestamp"].is_number());
    }
}
