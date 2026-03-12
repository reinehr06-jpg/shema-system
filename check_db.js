const sqlite3 = require('better-sqlite3');
const db = new sqlite3('shema.db');
try {
    const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='system_logs'");
    const row = stmt.get();
    console.log(row ? 'Table exists' : 'Table missing');
    if (row) {
        const test = db.prepare('SELECT * FROM system_logs').all();
        console.log('Rows:', test.length);
    }
} catch (e) {
    console.error(e);
}
