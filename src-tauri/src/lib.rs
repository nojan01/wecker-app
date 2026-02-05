use std::process::Command;

/// Verhindert Schlafmodus mit macOS caffeinate
#[tauri::command]
fn prevent_sleep(minutes: u32) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        let seconds = minutes * 60;
        let output = Command::new("caffeinate")
            .args(["-d", "-t", &seconds.to_string()])
            .spawn();
        
        match output {
            Ok(_) => Ok(format!("Schlafmodus für {} Minuten deaktiviert", minutes)),
            Err(e) => Err(format!("Fehler: {}", e))
        }
    }
    
    #[cfg(not(target_os = "macos"))]
    {
        Err("Nur auf macOS unterstützt".to_string())
    }
}

/// Plant ein Systemaufwachen für einen bestimmten Zeitpunkt (erfordert Admin-Rechte)
#[tauri::command]
fn schedule_wake(hour: u8, minute: u8) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        use chrono::{Local, Duration};
        
        let now = Local::now();
        let mut wake_time = now.date_naive().and_hms_opt(hour as u32, minute as u32, 0).unwrap();
        
        // Wenn die Zeit heute schon vorbei ist, für morgen planen
        if wake_time.and_local_timezone(Local).unwrap() <= now {
            wake_time = wake_time + Duration::days(1);
        }
        
        let formatted = wake_time.format("%m/%d/%Y %H:%M:%S").to_string();
        
        // pmset braucht sudo - wir versuchen es trotzdem
        let output = Command::new("pmset")
            .args(["schedule", "wake", &formatted])
            .output();
        
        match output {
            Ok(result) => {
                if result.status.success() {
                    Ok(format!("Aufwachen geplant für {}", formatted))
                } else {
                    Err(format!("pmset Fehler: {:?}", String::from_utf8_lossy(&result.stderr)))
                }
            },
            Err(e) => Err(format!("Fehler: {}", e))
        }
    }
    
    #[cfg(not(target_os = "macos"))]
    {
        Err("Nur auf macOS unterstützt".to_string())
    }
}

/// Prüft ob die App Berechtigung hat, Schlaf zu verhindern
#[tauri::command]
fn check_sleep_permission() -> bool {
    #[cfg(target_os = "macos")]
    {
        // Caffeinate braucht keine besonderen Berechtigungen
        true
    }
    
    #[cfg(not(target_os = "macos"))]
    {
        false
    }
}

/// Weckt den Bildschirm auf (beendet Bildschirmschoner)
#[tauri::command]
fn wake_screen() -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        // caffeinate -u simuliert User-Aktivität und weckt den Bildschirm
        let output = Command::new("caffeinate")
            .args(["-u", "-t", "5"])
            .spawn();
        
        match output {
            Ok(_) => Ok("Bildschirm aufgeweckt".to_string()),
            Err(e) => Err(format!("Fehler: {}", e))
        }
    }
    
    #[cfg(not(target_os = "macos"))]
    {
        Err("Nur auf macOS unterstützt".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .invoke_handler(tauri::generate_handler![
        prevent_sleep,
        schedule_wake,
        check_sleep_permission,
        wake_screen
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
