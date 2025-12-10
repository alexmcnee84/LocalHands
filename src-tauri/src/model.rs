use llama_cpp::{LlamaModel, LlamaParams, SessionParams};
use once_cell::sync::OnceCell;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use std::fs;

static MODEL_STATE: OnceCell<RwLock<ModelState>> = OnceCell::new();

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub name: String,
    pub path: String,
    pub size_bytes: u64,
    pub size_display: String,
    pub quantization: Option<String>,
    pub loaded: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadingProgress {
    pub progress: f32,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferenceResult {
    pub text: String,
    pub tokens_generated: usize,
}

struct ModelState {
    model: Option<Arc<LlamaModel>>,
    info: Option<ModelInfo>,
    loading: bool,
    progress: f32,
}

impl Default for ModelState {
    fn default() -> Self {
        Self {
            model: None,
            info: None,
            loading: false,
            progress: 0.0,
        }
    }
}

fn get_model_state() -> &'static RwLock<ModelState> {
    MODEL_STATE.get_or_init(|| RwLock::new(ModelState::default()))
}

fn format_size(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;

    if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.2} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.2} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} bytes", bytes)
    }
}

fn detect_quantization(filename: &str) -> Option<String> {
    let lower = filename.to_lowercase();
    let quant_types = [
        "q2_k", "q3_k_s", "q3_k_m", "q3_k_l", "q4_0", "q4_1", "q4_k_s", "q4_k_m",
        "q5_0", "q5_1", "q5_k_s", "q5_k_m", "q6_k", "q8_0", "f16", "f32",
        "iq1_s", "iq1_m", "iq2_xxs", "iq2_xs", "iq2_s", "iq2_m", "iq3_xxs", "iq3_xs", "iq3_s", "iq4_xs", "iq4_nl",
    ];
    
    for quant in quant_types {
        if lower.contains(quant) {
            return Some(quant.to_uppercase());
        }
    }
    None
}

pub fn validate_gguf_file(path: &str) -> Result<ModelInfo, String> {
    let path_buf = PathBuf::from(path);
    
    if !path_buf.exists() {
        return Err("File does not exist".to_string());
    }
    
    if path_buf.extension().map(|e| e.to_str().unwrap_or("")) != Some("gguf") {
        return Err("File is not a GGUF file".to_string());
    }
    
    let metadata = fs::metadata(&path_buf)
        .map_err(|e| format!("Failed to read file metadata: {}", e))?;
    
    let size_bytes = metadata.len();
    let filename = path_buf.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();
    
    let file = fs::File::open(&path_buf)
        .map_err(|e| format!("Failed to open file: {}", e))?;
    
    let mut reader = std::io::BufReader::new(file);
    let mut magic = [0u8; 4];
    std::io::Read::read_exact(&mut reader, &mut magic)
        .map_err(|e| format!("Failed to read file header: {}", e))?;
    
    if &magic != b"GGUF" {
        return Err("Invalid GGUF file: magic number mismatch".to_string());
    }
    
    Ok(ModelInfo {
        name: filename.clone(),
        path: path.to_string(),
        size_bytes,
        size_display: format_size(size_bytes),
        quantization: detect_quantization(&filename),
        loaded: false,
    })
}

pub fn load_model(path: &str) -> Result<ModelInfo, String> {
    let mut info = validate_gguf_file(path)?;
    
    {
        let mut state = get_model_state().write();
        if state.loading {
            return Err("Another model is currently loading".to_string());
        }
        state.loading = true;
        state.progress = 0.0;
    }
    
    {
        let mut state = get_model_state().write();
        state.progress = 0.1;
    }
    
    let params = LlamaParams::default();
    
    let model = LlamaModel::load_from_file(path, params)
        .map_err(|e| {
            let mut state = get_model_state().write();
            state.loading = false;
            format!("Failed to load model: {}", e)
        })?;
    
    {
        let mut state = get_model_state().write();
        state.progress = 0.9;
    }
    
    info.loaded = true;
    
    {
        let mut state = get_model_state().write();
        state.model = Some(Arc::new(model));
        state.info = Some(info.clone());
        state.loading = false;
        state.progress = 1.0;
    }
    
    Ok(info)
}

pub fn unload_model() -> Result<(), String> {
    let mut state = get_model_state().write();
    
    if state.model.is_none() {
        return Err("No model is currently loaded".to_string());
    }
    
    state.model = None;
    state.info = None;
    state.progress = 0.0;
    
    Ok(())
}

pub fn get_model_info() -> Option<ModelInfo> {
    let state = get_model_state().read();
    state.info.clone()
}

pub fn get_loading_progress() -> LoadingProgress {
    let state = get_model_state().read();
    LoadingProgress {
        progress: state.progress,
        status: if state.loading {
            "Loading model...".to_string()
        } else if state.model.is_some() {
            "Model loaded".to_string()
        } else {
            "No model loaded".to_string()
        },
    }
}

pub fn is_model_loaded() -> bool {
    let state = get_model_state().read();
    state.model.is_some()
}

pub fn generate_response(prompt: &str, max_tokens: u32) -> Result<InferenceResult, String> {
    let state = get_model_state().read();
    
    let model = state.model.as_ref()
        .ok_or("No model loaded")?;
    
    let session_params = SessionParams::default();
    let mut session = model.create_session(session_params)
        .map_err(|e| format!("Failed to create session: {}", e))?;
    
    session.advance_context(prompt)
        .map_err(|e| format!("Failed to process prompt: {}", e))?;
    
    let completions = session.start_completing()
        .map_err(|e| format!("Failed to start completion: {}", e))?;
    
    let mut output_text = String::new();
    let mut tokens_generated = 0usize;
    
    for piece in completions.into_strings().take(max_tokens as usize) {
        output_text.push_str(&piece);
        tokens_generated += 1;
    }
    
    Ok(InferenceResult {
        text: output_text,
        tokens_generated,
    })
}
