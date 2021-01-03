const fs = require('fs');
const path = require('path');
const parseSong = require('./parse');

// Init and parse song
if (process.argv.length < 3) {
  console.error(
    'Argument Error\nUsage:\nnpm start [json file] [OPTIONAL: output directory]\nOR\nnode src/index.js [json file] [OPTIONAL: output directory]'
  );
  return;
}

async function run() {
  console.log('Processing', process.argv[2]);

  const song = JSON.parse(fs.readFileSync(process.argv[2]).toString()).data.song;
  const output = path.join(process.argv[3] || path.dirname(process.argv[2]), `${song.title}.xml`);
  await parseSong(song, output);

  console.log('File saved to', output);
}

run();
