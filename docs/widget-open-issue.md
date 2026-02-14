# Open Widget 问题复盘（原因与修复）

## 现象

- 点击 **Open Widget** 后，`widget` 窗口出现白屏或未响应。
- 关闭按钮点击无反应。
- 标准模式窗口报错：

```text
webview.create_webview_window not allowed.
Permissions associated with this command: core:webview:allow-create-webview-window
```

## 根因

前端改为使用 Tauri JS API `new WebviewWindow(...)` 动态创建 `widget` 窗口后，  
应用能力配置（capability）里没有授予 `create webview window` 权限，导致窗口创建请求被 Tauri ACL 拒绝。

被拒绝后表现为：

- 窗口初始化流程未完成（看起来像白屏/卡死）
- 没有进入预期页面渲染逻辑

## 修复

在 `src-tauri/capabilities/default.json` 中增加权限：

```json
"core:webview:allow-create-webview-window"
```

完整位置（关键片段）：

```json
"permissions": [
  "core:default",
  "core:webview:allow-create-webview-window",
  "opener:default"
]
```

## 结论

该问题本质是 **ACL 权限缺失**，不是前端页面样式或 React 状态导致。  
当使用 `WebviewWindow` 动态创建窗口时，必须同步在 capability 中显式放行对应权限。
