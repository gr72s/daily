mod window;
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, Modifiers, ShortcutState};

#[tauri::command]
fn ensure_widget_window(app: tauri::AppHandle) -> Result<(), String> {
    window::ensure_widget_window(&app)
}

#[tauri::command]
fn focus_main_window(app: tauri::AppHandle) -> Result<(), String> {
    window::focus_main_window(&app)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            #[cfg(desktop)]
            {
                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_shortcuts(["ctrl+shift+l"])?
                        .with_handler(|app, shortcut, event| {
                            if event.state == ShortcutState::Pressed
                                && shortcut.matches(
                                    Modifiers::CONTROL | Modifiers::SHIFT,
                                    Code::KeyL,
                                )
                            {
                                if let Some(widget_window) = app.get_webview_window("widget") {
                                    let _ = widget_window.emit("widget-toggle-lock-shortcut", ());
                                } else {
                                    let _ = app.emit("widget-toggle-lock-shortcut", ());
                                }
                            }
                        })
                        .build(),
                )?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![ensure_widget_window, focus_main_window])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
