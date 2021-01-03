const { assert } = require('console');
const fs = require('fs');
const path = require('path');
const parseSong = require('../src/parse');

async function runTest(input, expected) {
  return new Promise(async (resolve, reject) => {
    console.log('Testing', input, '\n');

    const song = JSON.parse(fs.readFileSync(path.join(__dirname, `input/${input}`))).data.song;
    const expectedValue = fs.readFileSync(path.join(__dirname, `expected/${expected}`)).toString();
    const result = await parseSong(song, path.join(__dirname, 'result.xml'));

    const passed = result === expectedValue;
    assert(passed, `${input} test failed`);

    if (passed) console.log('\n', input, 'passed\n');

    if (passed) resolve();
    else reject();
  });
}

async function runAll() {
  await runTest('test1.json', 'test1.xml');
  await runTest('test2.json', 'test2.xml');
}

runAll();
