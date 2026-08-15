const test = require('node:test');
const assert = require('node:assert/strict');

const {
  estimateWaitForSong,
  estimateQueueForDevice,
} = require('../utils/queueEstimate');

function song(id, deviceId, position, durationSeconds = 180) {
  return {
    id,
    device_id: deviceId,
    artist: `Artist ${id}`,
    title: `Song ${id}`,
    position,
    duration_seconds: durationSeconds,
  };
}

test('blendet einen abgeschlossenen letzten Wunsch aus', () => {
  const current = song(1, 'abc', 1);

  assert.deepEqual(
    estimateQueueForDevice([current], current, 'abc', 0),
    []
  );
});

test('zeigt nach dem abgeschlossenen Song den nächsten eigenen Wunsch', () => {
  const current = song(1, 'abc', 1);
  const otherSinger = song(2, 'xyz', 2);
  const nextOwnSong = song(3, 'abc', 3);
  const playlist = [current, otherSinger, nextOwnSong];

  const result = estimateQueueForDevice(playlist, current, 'abc', 0);

  assert.equal(result.length, 1);
  assert.equal(result[0].id, nextOwnSong.id);
  assert.equal(result[0].status, 'queued');
  assert.equal(result[0].songsBefore, 1);
  assert.equal(
    result[0].estimatedWaitSeconds,
    otherSinger.duration_seconds + 30
  );
});

test('zählt den laufenden Song weiterhin als Song davor', () => {
  const current = song(1, 'xyz', 1);
  const target = song(2, 'abc', 2);

  const result = estimateWaitForSong([current, target], current, target.id, 45);

  assert.equal(result.status, 'queued');
  assert.equal(result.songsBefore, 1);
  assert.equal(result.estimatedWaitSeconds, 75);
});
