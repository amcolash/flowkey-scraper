const fs = require('fs');
const path = require('path');
const parseSong = require('./parse');

const song = JSON.parse(fs.readFileSync(process.argv[2]).toString()).data.song;
parseSong(song, path.join(path.dirname(process.argv[2]), `${song.title}.xml`));
