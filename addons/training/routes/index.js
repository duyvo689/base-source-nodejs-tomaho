const express = require('express');
const router = express.Router();

const Student = require('./student')


router.use('/', Student)

module.exports = router;