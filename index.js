const fs = require('fs');
const MidiWriter = require('midi-writer-js');

const song = JSON.parse(fs.readFileSync('test.json').toString()).data.song;
parseSong(song);

function lerp(v0, v1, t) {
  return v0 * (1 - t) + v1 * t;
}

function clamp(min, max, value) {
  return Math.max(min, Math.min(max, value));
}

function getDuration(d) {
  let duration = lerp(8, 1, clamp(0, 1, d / 2000));
  if (duration <= 1) duration = 1;
  else if (duration <= 2) duration = 2;
  else if (duration <= 3) duration = 'd2';
  else if (duration <= 4) duration = 4;
  else duration = 8;

  return duration;
}

function parseSong(song) {
  const notes = song.noteEvents;

  let min = 9999999999;

  const leftNotes = [];
  const rightNotes = [];
  notes.forEach((n) => {
    if (n.notesL.length > 0) leftNotes.push({ x: n.x, t: n.t, notesL: n.notesL });
    if (n.notesR.length > 0) rightNotes.push({ x: n.x, t: n.t, notesR: n.notesR });

    min = Math.min(min, n.t);
  });

  for (let i = 0; i < leftNotes.length - 1; i++) {
    leftNotes[i].d = leftNotes[i + 1].t - leftNotes[i].t;
  }
  leftNotes[leftNotes.length - 1].d = song.syncData.t[song.syncData.t.length - 1] - leftNotes[leftNotes.length - 1].t;

  for (let i = 0; i < rightNotes.length - 1; i++) {
    rightNotes[i].d = rightNotes[i + 1].t - rightNotes[i].t;
  }
  rightNotes[rightNotes.length - 1].d = song.syncData.t[song.syncData.t.length - 1] - rightNotes[rightNotes.length - 1].t;

  const rightTrack = new MidiWriter.Track();
  const leftTrack = new MidiWriter.Track();

  rightNotes.forEach((n) => {
    const notes = n.notesR.map((r) => `${r.name.replace('♭', 'b').replace('♯', '#')}${r.octave}`);
    rightTrack.addEvent(new MidiWriter.NoteEvent({ pitch: notes, duration: getDuration(n.d) }));
  });

  leftNotes.forEach((n) => {
    const notes = n.notesL.map((l) => `${l.name.replace('♭', 'b').replace('♯', '#')}${l.octave}`);
    leftTrack.addEvent(new MidiWriter.NoteEvent({ pitch: notes, duration: getDuration(n.d) }));
  });

  const write = new MidiWriter.Writer([rightTrack, leftTrack]);
  write.saveMIDI(song.title);
}
