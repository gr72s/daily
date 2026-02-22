use tauri::{
    webview::PageLoadEvent, AppHandle, Manager, WebviewUrl, WebviewWindowBuilder,
};

const WIDGET_BASE_WINDOW_WIDTH: f64 = 360.0;
const WIDGET_BASE_WINDOW_HEIGHT: f64 = 760.0;
const WIDGET_MIN_SCALE_PERCENT: u16 = 70;
const WIDGET_MAX_SCALE_PERCENT: u16 = 300;

fn resolve_widget_url(app: &AppHandle) -> WebviewUrl {
    if let Some(main_window) = app.get_webview_window("main") {
        if let Ok(mut current_url) = main_window.url() {
            current_url.set_query(Some("mode=widget"));

            if current_url.scheme() == "http" || current_url.scheme() == "https" {
                return WebviewUrl::External(current_url);
            }

            return WebviewUrl::CustomProtocol(current_url);
        }
    }

    WebviewUrl::App("index.html".into())
}

fn normalize_widget_scale_percent(scale_percent: u16) -> u16 {
    scale_percent.clamp(WIDGET_MIN_SCALE_PERCENT, WIDGET_MAX_SCALE_PERCENT)
}

fn resolve_widget_window_logical_size(scale_percent: u16) -> (i32, i32) {
    let normalized_scale = f64::from(normalize_widget_scale_percent(scale_percent)) / 100.0;
    (
        (WIDGET_BASE_WINDOW_WIDTH * normalized_scale).round() as i32,
        (WIDGET_BASE_WINDOW_HEIGHT * normalized_scale).round() as i32,
    )
}

#[cfg(windows)]
fn set_widget_bounds_windows(
    widget_window: &tauri::WebviewWindow,
    scale_factor: f64,
    x: i32,
    y: i32,
    width: i32,
    height: i32,
) -> Result<(), String> {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        SetWindowPos, SWP_NOACTIVATE, SWP_NOOWNERZORDER, SWP_NOZORDER,
    };

    let next_physical_position = tauri::LogicalPosition::new(f64::from(x), f64::from(y))
        .to_physical::<i32>(scale_factor);
    let next_physical_size = tauri::LogicalSize::new(f64::from(width), f64::from(height))
        .to_physical::<u32>(scale_factor);
    let next_physical_width = i32::try_from(next_physical_size.width)
        .map_err(|_| "widget width overflow while converting to physical pixels.".to_string())?;
    let next_physical_height = i32::try_from(next_physical_size.height)
        .map_err(|_| "widget height overflow while converting to physical pixels.".to_string())?;

    let hwnd = widget_window.hwnd().map_err(|error| error.to_string())?;
    let succeeded = unsafe {
        SetWindowPos(
            hwnd.0 as *mut std::ffi::c_void,
            std::ptr::null_mut(),
            next_physical_position.x,
            next_physical_position.y,
            next_physical_width,
            next_physical_height,
            SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_NOZORDER,
        )
    };

    if succeeded == 0 {
        return Err("SetWindowPos failed while resizing widget window.".to_string());
    }

    Ok(())
}

#[cfg(not(windows))]
fn set_widget_bounds_windows(
    widget_window: &tauri::WebviewWindow,
    _scale_factor: f64,
    x: i32,
    y: i32,
    width: i32,
    height: i32,
) -> Result<(), String> {
    widget_window
        .set_size(tauri::LogicalSize::new(f64::from(width), f64::from(height)))
        .map_err(|error| error.to_string())?;
    widget_window
        .set_position(tauri::LogicalPosition::new(f64::from(x), f64::from(y)))
        .map_err(|error| error.to_string())?;

    Ok(())
}

pub fn resize_widget_window_atomic(app: &AppHandle, scale_percent: u16) -> Result<(), String> {
    let app_handle = app.clone();
    let normalized_scale_percent = normalize_widget_scale_percent(scale_percent);
    let (sender, receiver) = std::sync::mpsc::channel::<Result<(), String>>();

    app.run_on_main_thread(move || {
        let result = (|| -> Result<(), String> {
            let Some(widget_window) = app_handle.get_webview_window("widget") else {
                return Ok(());
            };

            let scale_factor = widget_window.scale_factor().map_err(|error| error.to_string())?;
            let current_outer_position = widget_window
                .outer_position()
                .map_err(|error| error.to_string())?;
            let current_outer_size = widget_window
                .outer_size()
                .map_err(|error| error.to_string())?;
            let current_logical_position = current_outer_position.to_logical::<f64>(scale_factor);
            let current_logical_size = current_outer_size.to_logical::<f64>(scale_factor);
            let anchored_right = current_logical_position.x + current_logical_size.width;
            let (next_logical_width, next_logical_height) =
                resolve_widget_window_logical_size(normalized_scale_percent);
            let next_logical_x = (anchored_right - f64::from(next_logical_width)).round() as i32;
            let next_logical_y = current_logical_position.y.round() as i32;

            set_widget_bounds_windows(
                &widget_window,
                scale_factor,
                next_logical_x,
                next_logical_y,
                next_logical_width,
                next_logical_height,
            )?;
            Ok(())
        })();

        let _ = sender.send(result);
    })
    .map_err(|error| error.to_string())?;

    receiver
        .recv()
        .map_err(|error| format!("failed to receive widget resize result: {error}"))?
}

pub fn ensure_widget_window(app: &AppHandle) -> Result<(), String> {
    let app_handle = app.clone();
    let (sender, receiver) = std::sync::mpsc::channel::<Result<(), String>>();

    app.run_on_main_thread(move || {
        let result = (|| -> Result<(), String> {
            if let Some(existing) = app_handle.get_webview_window("widget") {
                println!("[widget] existing window found, destroying before recreate");
                let _ = existing.destroy();
            }

            let widget_url = resolve_widget_url(&app_handle);
            println!("[widget] resolved url: {widget_url}");
            println!("[widget] creating window...");

            let widget_window = WebviewWindowBuilder::new(&app_handle, "widget", widget_url)
                .title("Daily Widget")
                .inner_size(360.0, 760.0)
                .initialization_script("window.__DAILY_MODE__ = 'widget';")
                .transparent(false)
                .decorations(true)
                .resizable(true)
                .always_on_top(false)
                .focused(true)
                .skip_taskbar(false)
                .on_page_load(|_window, payload| match payload.event() {
                    PageLoadEvent::Started => {
                        println!("[widget] load started: {}", payload.url());
                    }
                    PageLoadEvent::Finished => {
                        println!("[widget] load finished: {}", payload.url());
                    }
                })
                .build()
                .map_err(|error| error.to_string())?;

            println!("[widget] window created");
            let _ = widget_window.show();
            Ok(())
        })();

        let _ = sender.send(result);
    })
    .map_err(|error| error.to_string())?;

    receiver
        .recv()
        .map_err(|error| format!("failed to receive widget creation result: {error}"))?
}

pub fn focus_main_window(app: &AppHandle) -> Result<(), String> {
    let Some(window) = app.get_webview_window("main") else {
        return Err("Main window is not available.".to_string());
    };

    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;

    Ok(())
}
