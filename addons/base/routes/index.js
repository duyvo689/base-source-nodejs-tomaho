const express = require('express');
const router = express.Router();

const Base = require('./base');

router.use('/', Base);

module.exports = router;