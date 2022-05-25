const _ = require('lodash');
const express = require('express');
const router = express.Router();
let Tomaho;
process.nextTick(() => Tomaho = require('../../tomaho'));


router.post('/api/createStudent',
	(req, res) => {
		let { body } = req, { Student } = Tomaho;
		try {
			if (!body || !body.payload) {
				throw TomUser.responseWithCode(1, "Request thiếu payload", {})
			}
			Student.createStudent(body.payload).then((result) => { res.json(result) })
		} catch (error) {
			res.json(Student.responseWithCatch(error, "[System Error] Lỗi tại function createStudent", {}))
		}
	}
)

module.exports = router;
