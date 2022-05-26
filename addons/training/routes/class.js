const _ = require('lodash');
const express = require('express');
const router = express.Router();
let Tomaho;
process.nextTick(() => Tomaho = require('../../tomaho'));

router.post('/api/findClassByIds',
    (req, res) => {
        let { body } = req, { ClassClass } = Tomaho;
        try {
            if (!body || !body.payload) {
                throw ClassClass.responseWithCode(1, "Request thiếu payload", {})
            }
            ClassClass.findClassByIds(body.payload).then((result) => { res.json(result) })
        } catch (error) {
            res.json(ClassClass.responseWithCatch(error, "[System Error] Lỗi tại function findClassByIds", {}))
        }
    }
)

router.post('/api/createClass',
    (req, res) => {
        let { body } = req, { ClassClass } = Tomaho;
        try {
            if (!body || !body.payload) {
                throw ClassClass.responseWithCode(1, "Request thiếu payload", {})
            }
            ClassClass.createClass(body.payload).then((result) => { res.json(result) })
        } catch (error) {
            res.json(ClassClass.responseWithCatch(error, "[System Error] Lỗi tại function createClass", {}))
        }
    }
)
module.exports = router;