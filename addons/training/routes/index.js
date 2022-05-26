const express = require('express');
const router = express.Router();

const Student = require('./student');
const ClassClass = require('./class');


router.use('/', Student);
router.use('/', ClassClass);

module.exports = router;