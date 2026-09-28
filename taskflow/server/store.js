// Tiny JSON-file persistence layer. Swap this module for Mongoose models to move to MongoDB.
const fs = require("fs");
module.exports = function createStore(file) {
  let db = { users: [], tasks: [], nextId: 1 };
  if (fs.existsSync(file)) db = JSON.parse(fs.readFileSync(file, "utf8"));
  return {
    db,
    save: () => fs.writeFileSync(file, JSON.stringify(db, null, 2)),
    id: () => db.nextId++,
  };
};
