const mongoose = require('mongoose');

const scoreSchema = new mongoose.Schema({
    playerName: { type: String, required: true, default: 'Anonymous' },
    kills: { type: Number, default: 0 },
    deaths: { type: Number, default: 0 }
});

module.exports = mongoose.model('Score', scoreSchema);
