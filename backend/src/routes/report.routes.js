const express = require('express');
const router = express.Router();

// Basic route for reports
router.get('/', (req, res) => {
  res.json({ message: 'Reports API endpoint' });
});

module.exports = router;
