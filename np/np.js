const FETCH_URL = "https://tuna.lab.shyrlox.com";
const FETCH_INTERVAL_MS = 800; // Menos de 1s para mejor respuesta
const PROGRESS_UPDATE_MS = 100;

let currentSongSignature = "";
let interpolationData = {
    baseProgress: 0,
    baseTimestamp: 0,
    duration: 0,
    isPlaying: false,
    lastPlaybackTime: "",
    source: "unknown"
};

function updateStatus(message) {
    document.getElementById('status-indicator').textContent = message;
}

function msToTime(ms) {
    if (!ms || ms <= 0) return "0:00";
    let totalSeconds = Math.floor(ms / 1000);
    let minutes = Math.floor(totalSeconds / 60);
    let seconds = totalSeconds % 60;
    return minutes + ":" + String(seconds).padStart(2, "0");
}

function timeStringToMs(timeString) {
    if (!timeString || timeString === "n/a") return 0;
    const [hours, minutes, seconds] = timeString.split(':').map(Number);
    return (hours * 3600 + minutes * 60 + seconds) * 1000;
}

function getCurrentTimeMS() {
    const now = new Date();
    return timeStringToMs(now.toTimeString().split(' ')[0]);
}

function calculateExactProgress(data) {
    // Si no hay playback_time válido, usar progress del JSON directamente
    if (!data.playback_time || data.playback_time === "n/a") {
        return data.progress || 0;
    }
    
    try {
        const playbackTimeMs = timeStringToMs(data.playback_time);
        const currentTimeMs = getCurrentTimeMS();
        
        let elapsedMs = currentTimeMs - playbackTimeMs;
        
        // Manejar cambio de medianoche
        if (elapsedMs < 0) {
            elapsedMs += 24 * 3600 * 1000;
        }
        
        const exactProgress = (data.progress || 0) + elapsedMs;
        return Math.min(exactProgress, data.duration || 0);
        
    } catch (error) {
        return data.progress || 0;
    }
}

function updateLocalProgress() {
    if (!interpolationData.isPlaying || interpolationData.duration <= 0) {
        return;
    }
    
    const now = Date.now();
    const elapsed = now - interpolationData.baseTimestamp;
    const estimatedProgress = interpolationData.baseProgress + elapsed;
    const safeProgress = Math.min(estimatedProgress, interpolationData.duration);
    
    document.getElementById("time-passed").textContent = msToTime(safeProgress);
    document.getElementById("progress").style.width = (safeProgress / interpolationData.duration * 100) + "%";
}

async function fetchNowPlaying() {
    try {
        const response = await fetch(FETCH_URL + '?' + Date.now());
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const data = await response.json();
        
        // Detectar fuente (Spotify o WMC)
        const source = data.context ? "spotify" : "wmc";
        return { data, source };
        
    } catch (error) {
        return { error: error.message };
    }
}

function getSongSignature(data) {
    // Crear firma más robusta que funcione para ambas fuentes
    return `${data.title || ""}|${data.artists?.join(",") || data.album_artist || ""}|${data.album || ""}|${data.duration || 0}`;
}

function shouldUpdateImages(data, newSignature) {
    // Actualizar imágenes si cambió la canción O si la fuente cambió de WMC a Spotify (mejor calidad)
    if (newSignature !== currentSongSignature) return true;
    
    // Si tenemos cover_path de Spotify (mejor calidad) y antes no lo teníamos
    const hasGoodCover = data.cover_path && data.cover_path !== "n/a" && !data.cover_path.includes('localhost');
    const previouslyHadBadCover = interpolationData.source === "wmc";
    
    return hasGoodCover && previouslyHadBadCover;
}

function applyMarquee(containerId, text) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const inner = container.querySelector('.text-inner');
  if (!inner) return;
  
  inner.textContent = text || '';
  
  // Si el texto es más ancho que el contenedor, aplicamos marquee
  if (inner.scrollWidth > container.clientWidth) {
    inner.classList.add('marquee');
    // Velocidad dinámica: cuanto más largo, más lento (o más rápido, ajusta el divisor)
    const duration = Math.max(4, inner.scrollWidth / 50);
    inner.style.animationDuration = duration + 's';
  } else {
    inner.classList.remove('marquee');
    inner.style.animationDuration = '';
  }
}

function updateUI(result) {
    if (result.error) {
        updateStatus("❌ Error: " + result.error);
        return;
    }
    
    const { data, source } = result;
    
    const newSignature = getSongSignature(data);
    const songChanged = newSignature !== currentSongSignature;
    const wasPlaying = interpolationData.isPlaying;
    const nowPlaying = data.status === "playing";
    
    // Actualizar texto básico
    applyMarquee('title', data.title || 'No song');
    document.getElementById("artist").textContent = "by " + (data.artists?.join(", ") || data.album_artist || "Unknown");
    document.getElementById("album").textContent = data.album || "";
    document.getElementById("length").textContent = msToTime(data.duration);
    
    // Calcular progreso exacto (maneja ambos casos: con y sin playback_time)
    const exactProgress = calculateExactProgress(data);
    
    // Actualizar datos de interpolación
    interpolationData = {
        baseProgress: exactProgress,
        baseTimestamp: Date.now(),
        duration: data.duration || 0,
        isPlaying: nowPlaying,
        lastPlaybackTime: data.playback_time || "",
        source: source
    };
    
    // Actualizar UI inmediatamente
    document.getElementById("time-passed").textContent = msToTime(exactProgress);
    document.getElementById("progress").style.width = (data.duration > 0 ? 
        (exactProgress / data.duration * 100) : 0) + "%";
    
    // Actualizar estado
    if (nowPlaying) {
        updateStatus(`▶️ ${source.toUpperCase()} - ${msToTime(exactProgress)}/${msToTime(data.duration)}`);
    } else {
        updateStatus(`⏸️ ${source.toUpperCase()} - Pausado`);
    }
    
    // Actualizar imágenes si es necesario
    if (shouldUpdateImages(data, newSignature)) {
        currentSongSignature = newSignature;
        // Preferir cover_path de Spotify, fallback a cover_url
        let coverUrl = data.cover_path && data.cover_path !== "n/a" ? data.cover_path : data.cover_url;
        if (coverUrl && coverUrl !== "n/a") {
            const timestamp = Date.now();
            const uniqueCoverUrl = `${coverUrl}?t=${timestamp}`;
            
            document.getElementById("cover").style.backgroundImage = `url("${uniqueCoverUrl}")`;
            document.getElementById("background").style.backgroundImage = `url("${uniqueCoverUrl}")`;
        }
    }
}

async function updateNowPlaying() {
    const result = await fetchNowPlaying();
    updateUI(result);
}
// Inicialización
updateNowPlaying();
setInterval(updateNowPlaying, FETCH_INTERVAL_MS);
setInterval(updateLocalProgress, PROGRESS_UPDATE_MS);

// Recuperación automática de errores
setInterval(() => {
    if (interpolationData.source === "unknown" || document.getElementById("title").textContent === "No song") {
        updateStatus("🔃 Reconectando...");
        updateNowPlaying();
    }
}, 5000);
