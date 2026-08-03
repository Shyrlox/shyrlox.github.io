// ============================================================
// np.js - Now Playing Viewer para Tuna (Spotify / WMC)
// Compatible con HTTP y HTTPS (usar HTTP para evitar mixed content)
// ============================================================

// ------------------- CONSTANTES ------------------------------
const FETCH_URL = "https://tuna.lab.shyrlox.com/";   // Cambiar según tu endpoint
const FETCH_INTERVAL_MS = 800;    // Cada cuánto se consulta el servidor
const PROGRESS_UPDATE_MS = 100;   // Suavizado de la barra

// ------------------- ESTADO GLOBAL ---------------------------
let currentSongSignature = "";
let interpolationData = {
    baseProgress: 0,
    baseTimestamp: 0,
    duration: 0,
    isPlaying: false,
    lastPlaybackTime: "",
    source: "unknown"
};

// ------------------- FUNCIONES AUXILIARES --------------------
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

// ------------------- MARQUEE CONTINUO (LOOP) -----------------
function applyMarquee(containerId, text) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const inner = container.querySelector('.text-inner');
    if (!inner) return;

    // Si el texto es largo, lo duplicamos para que el loop sea continuo
    const threshold = 20; // caracteres
    if (text && text.length > threshold) {
        inner.textContent = text + '  ' + text;
    } else {
        inner.textContent = text || '';
    }

    // Medir el ancho real del texto (con una sola copia)
    const measure = document.createElement('span');
    measure.style.cssText = 'visibility:hidden; white-space:nowrap; position:absolute;';
    measure.textContent = text || '';
    document.body.appendChild(measure);
    const textWidth = measure.offsetWidth;
    document.body.removeChild(measure);

    // Si el texto supera el ancho del contenedor, activamos el marquee
    if (textWidth > container.clientWidth) {
        inner.classList.add('marquee');
        // Duración proporcional: más largo = más lento (velocidad constante ~40px/s)
        const duration = Math.max(6, textWidth / 40);
        inner.style.animationDuration = duration + 's';
    } else {
        inner.classList.remove('marquee');
        inner.style.animationDuration = '';
        // Restauramos el texto sin duplicar
        inner.textContent = text || '';
    }
}

// ------------------- INTERPOLACIÓN DE PROGRESO ---------------
function updateLocalProgress() {
    if (!interpolationData.isPlaying || interpolationData.duration <= 0) {
        return;
    }
    const now = Date.now();
    const elapsed = now - interpolationData.baseTimestamp;
    const estimated = interpolationData.baseProgress + elapsed;
    const safe = Math.min(estimated, interpolationData.duration);
    document.getElementById("time-passed").textContent = msToTime(safe);
    document.getElementById("progress").style.width = (safe / interpolationData.duration * 100) + "%";
}

// ------------------- FETCH Y ACTUALIZACIÓN UI -----------------
async function fetchNowPlaying() {
    try {
        const response = await fetch(FETCH_URL + '?' + Date.now());
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const data = await response.json();
        const source = data.context ? "spotify" : "wmc";
        return { data, source };
    } catch (error) {
        return { error: error.message };
    }
}

function getSongSignature(data) {
    return `${data.title || ""}|${data.artists?.join(",") || data.album_artist || ""}|${data.album || ""}|${data.duration || 0}`;
}

function shouldUpdateImages(data, newSignature) {
    if (newSignature !== currentSongSignature) return true;
    const hasGoodCover = data.cover_path && data.cover_path !== "n/a" && !data.cover_path.includes('localhost');
    const previouslyHadBadCover = interpolationData.source === "wmc";
    return hasGoodCover && previouslyHadBadCover;
}

function updateUI(result) {
    if (result.error) {
        updateStatus("❌ Error: " + result.error);
        return;
    }

    const { data, source } = result;
    const newSignature = getSongSignature(data);
    const nowPlaying = (data.status === "playing");

    // ----- Textos básicos -----
    document.getElementById("artist").textContent = "by " + (data.artists?.join(", ") || data.album_artist || "Unknown");
    document.getElementById("album").textContent = data.album || "";
    document.getElementById("length").textContent = msToTime(data.duration);

    // ----- Progreso (usamos data.progress directamente, sin playback_time) -----
    const exactProgress = data.progress || 0;

    // Actualizar barra y tiempo
    document.getElementById("time-passed").textContent = msToTime(exactProgress);
    document.getElementById("progress").style.width = (data.duration > 0 ? (exactProgress / data.duration * 100) : 0) + "%";

    // Guardar para interpolación
    interpolationData = {
        baseProgress: exactProgress,
        baseTimestamp: Date.now(),
        duration: data.duration || 0,
        isPlaying: nowPlaying,
        lastPlaybackTime: data.playback_time || "",
        source: source
    };

    // ----- Estado en la esquina -----
    if (nowPlaying) {
        updateStatus(`▶️ ${source.toUpperCase()} - ${msToTime(exactProgress)}/${msToTime(data.duration)}`);
    } else {
        updateStatus(`⏸️ ${source.toUpperCase()} - Pausado`);
    }

    // ----- Título con marquee (loop continuo) -----
    applyMarquee('title', data.title || 'No song');

    // ----- Imágenes (cover y fondo) -----
    if (shouldUpdateImages(data, newSignature)) {
        currentSongSignature = newSignature;
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

// ------------------- INICIALIZACIÓN Y TEMPORIZADORES ---------
document.addEventListener('DOMContentLoaded', function() {
    // Primera carga
    updateNowPlaying();

    // Actualización periódica de datos
    setInterval(updateNowPlaying, FETCH_INTERVAL_MS);

    // Suavizado de la barra (interpolación)
    setInterval(updateLocalProgress, PROGRESS_UPDATE_MS);

    // Recuperación automática si el estado se queda "colgado"
    setInterval(() => {
        if (interpolationData.source === "unknown" || document.getElementById("title").textContent === "No song") {
            updateStatus("🔃 Reconectando...");
            updateNowPlaying();
        }
    }, 5000);
});
