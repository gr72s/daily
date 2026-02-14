mod window;

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager, Runtime,
};
use tauri_plugin_global_shortcut::{Code, Modifiers, ShortcutState};

const TRAY_ID: &str = "daily-tray";
const TRAY_MENU_OPEN_MAIN: &str = "tray-open-main";
const TRAY_MENU_TOGGLE_WIDGET_LOCK: &str = "tray-toggle-widget-lock";
const TRAY_MENU_EXIT: &str = "tray-exit";
const EVENT_WIDGET_SET_LOCK: &str = "widget-set-lock-state";
#[cfg(windows)]
const WIN_UNREGISTER_CLASS_ERROR_TOKEN: &str =
    "Failed to unregister class Chrome_WidgetWin_0. Error = 1412";

#[derive(Default)]
struct ExitState(AtomicBool);

#[derive(Default)]
struct WidgetLockState(AtomicBool);

fn tray_toggle_lock_label(locked: bool) -> &'static str {
    if locked {
        "解锁 Widget"
    } else {
        "锁定 Widget"
    }
}

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

fn refresh_tray_menu<R: Runtime>(app: &tauri::AppHandle<R>, widget_locked: bool) {
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        return;
    };

    if let Ok(tray_menu) = build_tray_menu(app, widget_locked) {
        let _ = tray.set_menu(Some(tray_menu));
    }
}

fn toggle_widget_lock<R: Runtime>(app: &tauri::AppHandle<R>) {
    let Some(widget_lock_state) = app.try_state::<WidgetLockState>() else {
        return;
    };

    let next_locked = !widget_lock_state.0.load(Ordering::SeqCst);
    widget_lock_state.0.store(next_locked, Ordering::SeqCst);
    refresh_tray_menu(app, next_locked);
    let _ = app.emit(EVENT_WIDGET_SET_LOCK, next_locked);
}

#[cfg(windows)]
fn is_ignorable_shutdown_error(error: &tauri::Error) -> bool {
    error.to_string().contains(WIN_UNREGISTER_CLASS_ERROR_TOKEN)
}

#[cfg(not(windows))]
fn is_ignorable_shutdown_error(_error: &tauri::Error) -> bool {
    false
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
    refresh_tray_menu(&app, locked);
    Ok(())
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
            }
            TRAY_MENU_TOGGLE_WIDGET_LOCK => {
                toggle_widget_lock(app);
            }
            TRAY_MENU_EXIT => {
                if let Some(exit_state) = app.try_state::<ExitState>() {
                    exit_state.0.store(true, Ordering::SeqCst);
                }

                app.exit(0);
            }
            _ => {}
        })
        .setup(|app| {
            #[cfg(desktop)]
            {
                app.manage(ExitState::default());
                app.manage(WidgetLockState::default());

                let widget_locked = app
                    .try_state::<WidgetLockState>()
                    .map(|state| state.0.load(Ordering::SeqCst))
                    .unwrap_or(false);
                let tray_menu = build_tray_menu(&app.handle(), widget_locked)?;

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
                                toggle_widget_lock(app);
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
            sync_widget_locked_state
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
