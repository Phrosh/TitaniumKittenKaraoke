const db = require('../config/database');

class User {
  static generateDeviceId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 3; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  static create(name, deviceId = null) {
    return new Promise((resolve, reject) => {
      const id = deviceId || this.generateDeviceId();
      
      db.run(
        'INSERT INTO users (device_id, name) VALUES (?, ?)',
        [id, name],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, device_id: id, name });
          }
        }
      );
    });
  }

  static findByDeviceId(deviceId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM users WHERE device_id = ?',
        [deviceId],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM users WHERE id = ?',
        [id],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });
  }

  static getAll() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM users ORDER BY created_at DESC', (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }
}

module.exports = User;