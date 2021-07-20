const { ipcRenderer } = require('electron');

window.sendMessage = (data) => ipcRenderer.sendToHost('data', data);

window.addButton = function () {
  const buttons = document.getElementById('mic-and-settings');

  const existing = document.getElementById('flowkeyScrape');
  if (existing) existing.remove();

  if (buttons) {
    const button = document.createElement('button');
    button.id = 'flowkeyScrape';
    button.onclick = () => {
      const urlParams = new URLSearchParams(window.location.search);
      window.sendMessage({
        images: Array.from(document.querySelectorAll('#sheet img')).map((i) => i.src.replace('/150', '/300')),
        id: window.location.pathname.replace('/player/', ''),
        title: urlParams.get('title'),
        artist: urlParams.get('artist'),
      });
    };

    const icon =
      '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-download"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>';
    button.innerHTML = icon;
    button.style.color = 'white';
    button.style.background = 'none';
    button.style.marginLeft = '10px';
    button.style.marginTop = '6px';
    button.style.border = 'none';
    button.style.zIndex = 1;

    buttons.appendChild(button);
  } else {
    // } else if (document.getElementsByClassName('load-progress').length) {
    setTimeout(addButton, 250);
  }
};
