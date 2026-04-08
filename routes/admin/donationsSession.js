const express = require('express');
const router = express.Router();
const donationsStore = require('../../utils/donationsStore');

router.get('/donations-session', (req, res) => {
  try {
    res.json(donationsStore.getSessionDonationsReport());
  } catch (e) {
    console.error('donations-session:', e);
    res.status(500).json({ message: 'Server error', donations: [], totals: {}, count: 0 });
  }
});

module.exports = router;
