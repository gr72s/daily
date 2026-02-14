use tauri::{
    webview::PageLoadEvent, AppHandle, Manager, WebviewUrl, WebviewWindowBuilder,
};

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
