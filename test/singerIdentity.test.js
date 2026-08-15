const test = require('node:test');
const assert = require('node:assert/strict');

const { getSingerSongRound } = require('../utils/singerIdentity');

function song(id, singer, position, createdAt) {
  return {
    id,
    user_name: singer,
    device_id: `device-${singer}`,
    position,
    created_at: createdAt,
  };
}

test('ordnet Wünsche desselben Sängers in Anmelderunden ein', () => {
  const firstA = song(1, 'A', 1, '2026-08-15 00:00:00');
  const secondA = song(2, 'A', 2, '2026-08-15 00:01:00');
  const firstB = song(3, 'B', 3, '2026-08-15 00:02:00');
  const playlist = [firstA, secondA, firstB];

  assert.equal(getSingerSongRound(playlist, firstA), 1);
  assert.equal(getSingerSongRound(playlist, secondA), 2);
  assert.equal(getSingerSongRound(playlist, firstB), 1);
  assert.ok(
    getSingerSongRound(playlist, secondA) > getSingerSongRound(playlist, firstB),
    'B1 darf A2 überholen'
  );
  assert.ok(
    getSingerSongRound(playlist, firstA) <= getSingerSongRound(playlist, firstB),
    'B1 darf A1 nicht überholen'
  );
});

test('behält die Anmelderunde auch nach Positionsänderungen bei', () => {
  const firstA = song(1, 'A', 2, '2026-08-15 00:00:00');
  const secondA = song(2, 'A', 3, '2026-08-15 00:01:00');
  const firstB = song(3, 'B', 1, '2026-08-15 00:02:00');
  const playlist = [firstB, firstA, secondA];

  assert.equal(getSingerSongRound(playlist, firstA), 1);
  assert.equal(getSingerSongRound(playlist, secondA), 2);
  assert.equal(getSingerSongRound(playlist, firstB), 1);
});

test('verwendet bei gleichem Zeitstempel die Song-ID als Reihenfolge', () => {
  const firstA = song(10, 'A', 2, '2026-08-15 00:00:00');
  const secondA = song(11, 'A', 1, '2026-08-15 00:00:00');
  const playlist = [secondA, firstA];

  assert.equal(getSingerSongRound(playlist, firstA), 1);
  assert.equal(getSingerSongRound(playlist, secondA), 2);
});
