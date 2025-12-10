mod model;

use model::{ModelInfo, LoadingProgress, InferenceResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use directories::ProjectDirs;
use std::fs;
use std::env;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub last_model_path: Option<String>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            last_model_path: None,
        }
    }
}

fn get_config_path() -> Option<PathBuf> {
    ProjectDirs::from("com", "localhands", "LocalHands")
        .map(|dirs| dirs.config_dir().join("config.json"))
}

fn load_config() -> AppConfig {
    get_config_path()
        .and_then(|path| fs::read_to_string(&path).ok())
        .and_then(|content| serde_json::from_str(&content).ok())
        .unwrap_or_default()
}

fn save_config(config: &AppConfig) -> Result<(), String> {
    let path = get_config_path()
        .ok_or("Failed to get config path")?;
    
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }
    
    let content = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write config: {}", e))?;
    
    Ok(())
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn validate_gguf(path: String) -> Result<ModelInfo, String> {
    model::validate_gguf_file(&path)
}

#[tauri::command]
fn load_model(path: String) -> Result<ModelInfo, String> {
    let result = model::load_model(&path)?;
    
    let mut config = load_config();
    config.last_model_path = Some(path);
    let _ = save_config(&config);
    
    Ok(result)
}

#[tauri::command]
fn unload_model() -> Result<(), String> {
    model::unload_model()
}

#[tauri::command]
fn get_model_info() -> Option<ModelInfo> {
    model::get_model_info()
}

#[tauri::command]
fn get_loading_progress() -> LoadingProgress {
    model::get_loading_progress()
}

#[tauri::command]
fn is_model_loaded() -> bool {
    model::is_model_loaded()
}

#[tauri::command]
fn get_last_model_path() -> Option<String> {
    load_config().last_model_path
}

#[tauri::command]
fn generate_response(prompt: String, max_tokens: Option<u32>) -> Result<InferenceResult, String> {
    let max = max_tokens.unwrap_or(512);
    model::generate_response(&prompt, max)
}

fn get_workspace_dir() -> Result<PathBuf, String> {
    let dirs = ProjectDirs::from("com", "localhands", "LocalHands")
        .ok_or("Failed to get project directories")?;
    let workspace = dirs.data_dir().join("workspace");
    fs::create_dir_all(&workspace)
        .map_err(|e| format!("Failed to create workspace directory: {}", e))?;
    Ok(workspace)
}

#[tauri::command]
fn upload_file_to_workspace(file_name: String, file_data: Vec<u8>) -> Result<String, String> {
    let workspace = get_workspace_dir()?;
    let file_path = workspace.join(&file_name);
    
    fs::write(&file_path, &file_data)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    
    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
fn get_workspace_files() -> Result<Vec<String>, String> {
    let workspace = get_workspace_dir()?;
    
    let files: Vec<String> = fs::read_dir(&workspace)
        .map_err(|e| format!("Failed to read workspace: {}", e))?
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.path().is_file())
        .map(|entry| entry.file_name().to_string_lossy().to_string())
        .collect();
    
    Ok(files)
}

#[tauri::command]
fn set_ollama_model_path(path: String) -> Result<(), String> {
    env::set_var("OLLAMA_MODEL_PATH", &path);
    
    let mut config = load_config();
    config.last_model_path = Some(path);
    save_config(&config)?;
    
    Ok(())
}

#[tauri::command]
fn get_ollama_model_path() -> Option<String> {
    env::var("OLLAMA_MODEL_PATH").ok()
        .or_else(|| load_config().last_model_path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            validate_gguf,
            load_model,
            unload_model,
            get_model_info,
            get_loading_progress,
            is_model_loaded,
            get_last_model_path,
            generate_response,
            upload_file_to_workspace,
            get_workspace_files,
            set_ollama_model_path,
            get_ollama_model_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
