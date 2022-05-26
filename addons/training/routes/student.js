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

router.post('/api/createStudents',
	(req, res) => {
		let { body } = req, { Student } = Tomaho;
		try {
			if (!body || !body.payload) {
				throw TomUser.responseWithCode(1, "Request thiếu payload", {})
			}
			Student.createStudents(body.payload).then((result) => { res.json(result) })
		} catch (error) {
			res.json(Student.responseWithCatch(error, "[System Error] Lỗi tại function createStudents", {}))
		}
	}
)

router.post('/api/findStudentByIds',
	(req, res) => {
		let { body } = req, { Student } = Tomaho;
		try {
			if (!body || !body.payload) {
				throw Student.responseWithCode(1, "Request thiếu payload", {})
			}
			Student.findStudentByIds(body.payload).then((result) => { res.json(result) })
		} catch (error) {
			res.json(Student.responseWithCatch(error, "[System Error] Lỗi tại function findStudentByIds", {}))
		}
	}
)

router.post('/api/updateStudentById',
	(req, res) => {
		let { body } = req, { Student } = Tomaho;
		try {
			if (!body || !body.payload) {
				throw Student.responseWithCode(1, "Request thiếu payload", {})
			}
			Student.updateStudentById(body.payload).then((result) => { res.json(result) })
		} catch (error) {
			res.json(Student.responseWithCatch(error, "[System Error] Lỗi tại function updateStudentById", {}))
		}
	}
)

router.post('/api/deleteStudentById',
	(req, res) => {
		let { body } = req, { Student } = Tomaho;
		try {
			if (!body || !body.payload) {
				throw Student.responseWithCode(1, "Request thiếu payload", {})
			}
			Student.deleteStudentById(body.payload).then((result) => { res.json(result) })
		} catch (error) {
			res.json(Student.responseWithCatch(error, "[System Error] Lỗi tại function deleteStudentById", {}))
		}
	}
)

module.exports = router;
