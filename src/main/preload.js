const { ipcRenderer } = require('electron');

window.sendMessage = (data) => ipcRenderer.sendToHost('data', data);

window.addButton = function () {
  const buttons = document.getElementById('mic-and-settings');

  if (buttons) {
    const button = document.createElement('button');
    button.innerText = 'Scrape!';
    button.onclick = () => {
      const urlParams = new URLSearchParams(window.location.search);
      window.sendMessage({
        images: Array.from(document.querySelectorAll('#sheet img')).map((i) => i.src.replace('/150', '/300')),
        id: window.location.pathname.replace('/player/', ''),
        title: urlParams.get('title'),
        artist: urlParams.get('artist'),
      });
    };
    buttons.appendChild(button);
  } else if (document.getElementsByClassName('load-progress').length) {
    setTimeout(addButton, 250);
  }
};
