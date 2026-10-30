use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::Deserialize;
use tauri::{
  menu::{Menu, MenuItem, PredefinedMenuItem},
  tray::TrayIconBuilder,
  AppHandle, Emitter, Manager, RunEvent, WindowEvent, Wry,
};
use tauri_plugin_notification::NotificationExt;

const TRAY_ID: &str = "main";

/// 画面側（src/lib/tauri.ts）から送られてくるポモドーロの状態
#[derive(Deserialize, Clone, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
struct PomodoroStatus {
  /// "work" | "short" | "long"
  mode: String,
  running: bool,
  /// まだ一度も開始していない
  idle: bool,
  /// running 中の終了予定時刻（エポックミリ秒）
  ends_at: Option<f64>,
  /// 停止中の残り時間（ミリ秒）
  remaining_ms: f64,
  task_title: Option<String>,
}

#[derive(Default)]
struct TrayState {
  status: Mutex<PomodoroStatus>,
  /// 最後にメニューバーへ出した文字。同じなら更新しない
  last_title: Mutex<String>,
  /// 通知済みの終了時刻。同じ区間で二重に通知しない
  notified_end: Mutex<Option<f64>>,
}

struct TrayMenuItems {
  toggle: MenuItem<Wry>,
  task: MenuItem<Wry>,
}

fn now_ms() -> f64 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|d| d.as_millis() as f64)
    .unwrap_or(0.0)
}

fn format_ms(ms: f64) -> String {
  let total = (ms.max(0.0) / 1000.0).ceil() as u64;
  format!("{:02}:{:02}", total / 60, total % 60)
}

fn remaining(status: &PomodoroStatus) -> f64 {
  match (status.running, status.ends_at) {
    (true, Some(ends_at)) => (ends_at - now_ms()).max(0.0),
    _ => status.remaining_ms,
  }
}

fn tray_title(status: &PomodoroStatus) -> String {
  let icon = if status.mode == "work" { "🍅" } else { "☕" };
  if status.idle {
    icon.to_string()
  } else if status.running {
    format!("{icon} {}", format_ms(remaining(status)))
  } else {
    format!("⏸ {}", format_ms(remaining(status)))
  }
}

/// メニューバーの表示を今の状態に合わせる。画面が隠れていても動くよう Rust 側で時間を数える
fn refresh(app: &AppHandle) {
  let state = app.state::<TrayState>();
  let status = state.status.lock().unwrap().clone();

  let title = tray_title(&status);
  let mut last = state.last_title.lock().unwrap();
  if *last != title {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
      let _ = tray.set_title(Some(&title));
    }
    *last = title;
  }

  if let Some(ends_at) = status.ends_at {
    let mut notified = state.notified_end.lock().unwrap();
    if status.running && now_ms() >= ends_at && *notified != Some(ends_at) {
      *notified = Some(ends_at);
      let (title, body) = if status.mode == "work" {
        ("作業が終わりました", "お疲れさまです。休憩しましょう。")
      } else {
        ("休憩が終わりました", "次の作業を始めましょう。")
      };
      let _ = app.notification().builder().title(title).body(body).show();
    }
  }
}

#[tauri::command]
fn pomodoro_sync(app: AppHandle, status: PomodoroStatus) {
  if let Some(items) = app.try_state::<TrayMenuItems>() {
    let label = if status.running {
      "一時停止"
    } else if status.idle {
      "開始"
    } else {
      "再開"
    };
    let _ = items.toggle.set_text(label);
    let task = status.task_title.as_deref().unwrap_or("タスク未選択");
    let _ = items.task.set_text(task);
  }
  *app.state::<TrayState>().status.lock().unwrap() = status;
  refresh(&app);
}

fn show_main_window(app: &AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
  }
}

fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
  let task = MenuItem::with_id(app, "task", "タスク未選択", false, None::<&str>)?;
  let toggle = MenuItem::with_id(app, "toggle", "開始", true, None::<&str>)?;
  let skip = MenuItem::with_id(app, "skip", "スキップ", true, None::<&str>)?;
  let reset = MenuItem::with_id(app, "reset", "リセット", true, None::<&str>)?;
  let show = MenuItem::with_id(app, "show", "ウィンドウを開く", true, None::<&str>)?;
  let quit = MenuItem::with_id(app, "quit", "終了", true, None::<&str>)?;
  let menu = Menu::with_items(
    app,
    &[
      &task,
      &PredefinedMenuItem::separator(app)?,
      &toggle,
      &skip,
      &reset,
      &PredefinedMenuItem::separator(app)?,
      &show,
      &quit,
    ],
  )?;

  TrayIconBuilder::with_id(TRAY_ID)
    .title("🍅")
    .tooltip("Task Management")
    .menu(&menu)
    .show_menu_on_left_click(true)
    .on_menu_event(|app, event| match event.id().as_ref() {
      // タイマーの状態は画面側が持っているので、操作は画面側に任せる
      action @ ("toggle" | "skip" | "reset") => {
        let _ = app.emit("tray-action", action);
      }
      "show" => show_main_window(app),
      "quit" => app.exit(0),
      _ => {}
    })
    .build(app)?;

  app.manage(TrayMenuItems { toggle, task });
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_notification::init())
    .manage(TrayState::default())
    .invoke_handler(tauri::generate_handler![pomodoro_sync])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      setup_tray(app.handle())?;

      let handle = app.handle().clone();
      std::thread::spawn(move || loop {
        refresh(&handle);
        std::thread::sleep(Duration::from_millis(500));
      });
      Ok(())
    })
    // ウィンドウを閉じても終了せず隠すだけにして、タイマーとメニューバーを動かし続ける
    .on_window_event(|window, event| {
      if let WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        let _ = window.hide();
      }
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(|app, event| {
      // Dock のアイコンをクリックしたら隠したウィンドウを出す
      #[cfg(target_os = "macos")]
      if let RunEvent::Reopen { .. } = event {
        show_main_window(app);
      }
      #[cfg(not(target_os = "macos"))]
      let _ = (app, event);
    });
}
