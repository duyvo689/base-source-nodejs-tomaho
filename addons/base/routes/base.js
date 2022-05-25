const express = require('express');
const router = express.Router();


router.get('/checkhealth', (request, response, next) => {
    response.send('OK LA');
})

module.exports = router;