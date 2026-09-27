import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DATA_CREDITS } from './dataCredits.js';

test('every credit carries a unique key and some markup to render', () => {
  const keys = DATA_CREDITS.map((entry) => entry.key);
  assert.equal(
    new Set(keys).size,
    keys.length,
    'a duplicate key would silently shadow one provider’s credit',
  );
  for (const entry of DATA_CREDITS) {
    assert.ok(entry.key, 'a credit without a key cannot be registered');
    assert.ok(
      entry.html && entry.html.trim().length > 0,
      `credit ${entry.key} has nothing to show`,
    );
  }
});

test('adsbdb is credited and carries its published route-data restriction', () => {
  const credit = DATA_CREDITS.find((entry) => entry.key === 'adsbdb');
  assert.ok(
    credit,
    'adsbdb supplies aircraft type and routes and must be credited',
  );
  // adsbdb publishes this restriction for its route data. Pin the provider's
  // credits and restriction here so a later edit cannot silently remove them.
  assert.match(credit.html, /David Taylor, Edinburgh/);
  assert.match(credit.html, /Jim Mason, Glasgow/);
  assert.match(
    credit.html,
    /may not be\s+copied, published, or incorporated into other databases/,
  );
  assert.match(credit.html, /explicit permission of David J Taylor, Edinburgh/);
  assert.match(credit.html, /PlaneBase/);
  assert.match(credit.html, /Guillaume Michel/);
  assert.match(credit.html, /href="https:\/\/www\.adsbdb\.com"/);
});

test('OpenStreetMap has one generic data credit with separate tile and names distributors', () => {
  const osm = DATA_CREDITS.filter((entry) =>
    entry.html.includes('openstreetmap.org/copyright'),
  );
  assert.equal(osm.length, 1);
  assert.equal(osm[0].key, 'openstreetmap');
  assert.match(osm[0].html, /Map and place data/);
  assert.match(osm[0].html, /© OpenStreetMap contributors/);
  assert.match(
    DATA_CREDITS.find((entry) => entry.key === 'openfreemap').html,
    /Vector tiles:/,
  );
  assert.match(
    DATA_CREDITS.find((entry) => entry.key === 'overture-military-names').html,
    /Overture Maps Foundation/,
  );
});

test('OSM map introduction is shared across layers for the entire viewer session', async (t) => {
  const { showOsmCredit } = await import('./dataCredits.js');
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const visible = new Set();
  let renders = 0;
  const viewer = {
    creditDisplay: {
      addStaticCredit: (c) => visible.add(c),
      removeStaticCredit: (c) => visible.delete(c),
    },
    scene: { requestRender: () => renders++ },
  };
  assert.equal(showOsmCredit(viewer), true);
  assert.equal(showOsmCredit(viewer), false);
  assert.equal(visible.size, 1);
  const [credit] = visible;
  assert.equal(credit.showOnScreen, true);
  assert.match(credit.html, /OpenStreetMap contributors/);
  assert.match(credit.html, /OpenMapTiles/);
  t.mock.timers.tick(5000);
  assert.equal(visible.size, 0);
  assert.equal(
    showOsmCredit(viewer),
    false,
    'another layer never repeats the session introduction',
  );
  assert.equal(renders, 2);
});
