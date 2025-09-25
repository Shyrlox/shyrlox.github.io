const consoleEl = document.getElementById("console");
const cursor = document.querySelector(".cursor");
const socials = document.getElementById("socials");
let lineIndex = 0, charIndex = 0;

const lines = [
  "> Booting console...",
  "> Loading assets...",
  "> Social links ready??...",
  "> Welcome to Shyrlox' realm..."
];

// Lazy load background
const bgURL = "https://shared.steamstatic.com/community_assets/images/items/230410/446915a2504839a9420061fd029a344f133089ad.jpg";

function loadBackgroundLazy(){
  const img = new Image();
  img.src = bgURL;
  img.onload = () => { 
    document.documentElement.style.setProperty('--bg-image', `url('${bgURL}')`); 
  };
}

// Type animation
function type(){
  if(lineIndex < lines.length){
    if(charIndex < lines[lineIndex].length){
      consoleEl.textContent += lines[lineIndex][charIndex++];
      setTimeout(type, 30);
    } else {
      consoleEl.textContent += "\n";
      charIndex = 0; 
      lineIndex++;
      setTimeout(type, 250);
    }
  } else {
    cursor.style.display = "none"; 
    socials.style.display = "block"; // Cambiado de flex a block
    loadBackgroundLazy();
  }
}

type();

// Press ENTER to skip
document.addEventListener("keydown", e => {
  if(e.key === "Enter"){ 
    cursor.style.display = "none"; 
    socials.style.display = "block"; // Cambiado de flex a block
    loadBackgroundLazy(); 
  }
});

// Newtab
function openInNewTab(url) {
    window.open(url, '_blank');
}

// Modal functions (añade si no existen)
function openModal(url) {
    const modal = document.getElementById('modal');
    const iframe = modal.querySelector('iframe');
    iframe.src = url;
    modal.style.display = 'flex';
}

function closeModal() {
    const modal = document.getElementById('modal');
    const iframe = modal.querySelector('iframe');
    iframe.src = '';
    modal.style.display = 'none';
}