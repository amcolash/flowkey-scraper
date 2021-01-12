const builder = require('xmlbuilder');

// Code based off of https://github.com/PekkaAstala/music-automaton

function buildPartlist(id, name) {
  return {
    'score-part': {
      '@id': id,
      'part-name': {
        '#text': name,
      },
    },
  };
}

function noteToMusicXMLObject(note, continuesChord, staff) {
  const obj = {};

  if (note.rest) {
    obj['rest'] = {};
  } else {
    if (continuesChord) {
      obj['chord'] = {};
    }

    const step = note.name.replace('♭', '').replace('♯', '');
    const flat = note.name.indexOf('♭') !== -1;
    const sharp = note.name.indexOf('♯') !== -1;

    if (note.duration.tieStop || note.duration.tieStart) {
      obj['tie'] = [];
      if (note.duration.tieStop) obj['tie'].push({ '@type': 'stop' });
      if (note.duration.tieStart) obj['tie'].push({ '@type': 'start' });
    }

    obj['pitch'] = {
      step: { '#text': step },
      alter: sharp ? 1 : flat ? -1 : 0,
      octave: { '#text': note.octave },
    };

    if (note.duration.beam) obj['beam'] = { '@bumber': 1, '#text': note.duration.beam };

    if (sharp || flat) obj['accidental'] = sharp ? 'sharp' : flat ? 'flat' : '';
  }

  let duration = 16;
  let durationName = note.duration.duration;

  switch (durationName) {
    case 'sixteenth':
      duration = 1;
      durationName = '16th';
      break;
    case 'eighth':
      duration = 2;
      break;
    case 'quarter':
      duration = 4;
      break;
    case 'half':
      duration = 8;
      break;
    case 'whole':
      duration = 16;
      break;
  }

  if (note.duration.dot) {
    obj['dot'] = {};
    duration += duration / 2;
  }

  obj['duration'] = duration;
  obj['type'] = durationName;
  obj['staff'] = staff;

  return obj;
}

function addMeasure(parent, model) {
  // if (model.number > 1) return;

  const measure = parent.ele({ measure: { '@number': model.number } });
  if (model.number === 1) {
    measure.ele({
      attributes: {
        // divisions: { '#text': '1' },
        // key: {
        //   fifths: { '#text': model.fifths },
        // },
        time: {
          beats: { '#text': model.timeSig.top },
          'beat-type': { '#text': model.timeSig.bottom },
        },
        staves: 2,
        clef: [
          {
            '@number': 1,
            sign: { '#text': 'G' },
            line: { '#text': '2' },
          },
          {
            '@number': 2,
            sign: { '#text': 'F' },
            line: { '#text': '4' },
          },
        ],
      },
    });
  }

  model.staffs.forEach((staff, i) => {
    let duration = 0;

    staff.forEach((noteCluster) => {
      noteCluster.forEach((n, j) => {
        const note = noteToMusicXMLObject(n, j > 0, i + 1);
        measure.ele({ note });
        duration += note.duration;
      });
    });

    // if (i === 0) measure.ele({ backup: { duration: { '#text': 16 } } });
    if (i === 0) measure.ele({ backup: { duration: { '#text': duration } } });
  });
}

function toXml(measures, metaData) {
  const root = builder.create(
    { 'score-partwise': { '@version': 3.1 } },
    { version: '1.0', encoding: 'UTF-8', standalone: 'no' },
    {
      pubID: '-//Recordare//DTD MusicXML 3.1 Partwise//EN',
      sysID: 'http://www.musicxml.org/dtds/partwise.dtd',
    }
  );
  root.ele({ work: { 'work-title': metaData.title } });
  root.ele({ identification: { creator: { '@type': 'composer', '#text': metaData.artist } } });
  root.ele({ 'part-list': buildPartlist('P1', '') });
  const part = root.ele({ part: { '@id': 'P1' } });

  measures.forEach((m, i) => {
    addMeasure(part, {
      number: i + 1,
      staffs: m.staffs,
      timeSig: metaData.timeSig,
    });
  });

  return root.end({ pretty: true });
}

module.exports = toXml;
