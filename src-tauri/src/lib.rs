mod window;

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
        .invoke_handler(tauri::generate_handler![ensure_widget_window, focus_main_window])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
