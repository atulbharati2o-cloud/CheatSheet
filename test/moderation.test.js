// Runnable check for the admin-approval filter. Run: node test/moderation.test.js
const assert = require('assert');
process.env.NODE_ENV = 'test'; // don't start the HTTP listener
const { publicView } = require('../server');

const raw = {
    resources: [
        { title: 'OS', category: 'Core', links: [
            { id: 'a', label: 'live', pending: false },
            { id: 'b', label: 'waiting', pending: true }
        ]},
        { title: 'NEW', category: 'Core', links: [ { id: 'c', label: 'only pending', pending: true } ] }
    ],
    campusDocs: [ { id: 'd1', pending: true }, { id: 'd2' } ],
    announcements: [ { id: 'x1', pending: true }, { id: 'x2', pending: false } ]
};

const pub = publicView(raw);

assert.deepStrictEqual(pub.resources.map(g => g.title), ['OS'], 'group with only pending links is dropped');
assert.deepStrictEqual(pub.resources[0].links.map(l => l.id), ['a'], 'pending link hidden from public');
assert.deepStrictEqual(pub.campusDocs.map(d => d.id), ['d2'], 'pending campus doc hidden');
assert.deepStrictEqual(pub.announcements.map(a => a.id), ['x2'], 'pending announcement hidden');

console.log('ok');
process.exit(0);
