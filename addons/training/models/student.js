const _ = require('lodash');
const { ObjectID } = require('mongodb');
const BaseModel = require('../../base').BaseModel;
let Tomaho;
process.nextTick(() => (Tomaho = require('../../tomaho')));


class Student extends BaseModel {
    constructor(connection) {
        super(connection);
        this.name = 'Student';
        this.label = 'Đối tượng Sinh viên'
        this.fields = {
            name: { type: 'string', string: 'Tên sinh viên', mandatory: true },
            code: { type: 'string', string: 'Mã sinh viên', mandatory: true },
            status: {
                type: 'selection', string: 'Trạng thái',
                selection: ['dang_hoc', 'tot_nghiep', 'nghi_hoc'],
            },
            class_id: { type: 'many2one', refModel: 'ClassClass', string: 'Thuộc lớp' },
            create_date: { type: 'date', string: 'Ngày tạo' },
            write_date: { type: 'date', string: 'Ngày chỉnh sửa' },
        }
        this._init(this.fields)
    }


    createStudent(payload) {
        const { data } = payload;
        return Promise.all([]).then(() => {
            if (!data) {
                throw this.responseWithCode(1, 'Dữ liệu đầu vào không đúng findStudentByIds', '')
            }
            if (!data.name || !String(data.name).trim()) {
                throw this.responseWithCode(1, 'Thiếu data.name findStudentByIds', '')
            }
            if (!data.code || !String(data.code).trim()) {
                throw this.responseWithCode(1, 'Thiếu data.code findStudentByIds', '')
            }
            return this.create({
                documents: [{
                    name: String(data.name).trim(),
                    code: String(data.code).trim(),
                    status: 'dang_hoc'
                }]
            })
        }).then((result) => {
            this.validateResult(result)
            let { records } = result.data;
            return this.responseWithCode(0, 'Ok', { Student: records[0] })
        }).catch(error => {
            return this.responseWithCatch(error, "[System Error] Lỗi tại function createStudent", "")
        })
    }

    createStudents(payload) {
        const { data } = payload;
        return Promise.all([]).then(() => {
            if (!data || !Array.isArray(data)) {
                throw this.responseWithCode(1, 'Dữ liệu đầu vào không đúng findStudentByIds', '')
            }
            let arr = [];
            for (const element of data) {
                let doc = {
                    name: String(element.name).trim(),
                    code: String(element.code).trim(),
                    status: 'dang_hoc'
                };
                arr.push(doc);
            }
            return this.create({
                documents: arr
            })

        }).then((result) => {
            this.validateResult(result)
            let { records } = result.data;
            return this.responseWithCode(0, 'Ok', { Student: records[0] })
        }).catch(error => {
            console.log(error);
            return this.responseWithCatch(error, "[System Error] Lỗi tại function createStudent", "")
        })
    }

    updateStudentById(payload) {
        const { data } = payload;
        const { name, code, status } = data;
        return Promise.all([]).then(() => {
            if (!data || !data._id || !ObjectID.isValid(data._id)) {
                throw this.responseWithCode(1, 'Dữ liệu truyền vào không họp lệ findStudentByIds', '')
            }
            return this.search({
                domain: [["_id", "=", data._id]],
                projection: ['name', 'code', 'class_id', 'status'],
            })
        }).then((result) => {
            this.validateResult(result)
            const { records } = result.data;
            if (records && records.length > 0) {
                let student = records[0]
                let updateData = {};
                if (data.hasOwnProperty('name') && String(name).trim() && String(name).trim() != student.name) {
                    updateData = { ...updateData, name: String(name).trim() }
                }
                if (data.hasOwnProperty('code') && String(code).trim() && String(code).trim() != student.code) {
                    updateData = { ...updateData, code: String(code).trim() }
                }
                if (data.hasOwnProperty('status') && status != student.status) {
                    updateData = { ...updateData, status: status }
                }
                if (Object.keys(updateData).length > 0) {
                    return this.update({
                        domain: [["_id", "=", data._id]],
                        update: updateData
                    })
                } else {
                    throw this.responseWithCode(0, 'Ok', { Student: student })
                }
            } else {
                throw this.responseWithCode(1, 'Không tìm thấy sinh viên', '')
            }
        }).then((result) => {
            this.validateResult(result)
            return this.responseWithCode(0, 'Cập nhập thành công', '')
        }).catch(error => {
            console.log(error);
            return this.responseWithCatch(error, "[System Error] Lỗi tại function updateStudentByIds", "")
        })
    }

    findStudentByIds(payload) {
        const { data } = payload;
        return Promise.all([]).then(() => {
            if (!data || !Array.isArray(data._ids) || !data._ids.length === 0) {
                throw this.responseWithCode(1, 'Dữ liệu đầu vào không đúng findStudentByIds', '')
            }
            this.isListObjectID("findStudentByIds _ids", data._ids)
            return this.search({
                domain: [["_id", "in", data._ids]],
                projection: ['name', 'code', 'class_id', 'status'], limit: 200
            })
        }).then((result) => {
            this.validateResult(result)
            let { records } = result.data;
            return this.responseWithCode(0, 'Ok', { Student: records })
        }).catch(error => {
            return this.responseWithCatch(error, "[System Error] Lỗi tại function findStudentByIds", "")
        })
    }

    deleteStudentById(payload) {
        const { data } = payload;
        return Promise.all([]).then(() => {
            if (!data || !this.isObjectID(data._id)) {
                throw this.responseWithCode(1, 'Dữ liệu đầu vào không đúng findStudentByIds', '')
            }
            return this.delete({
                domain: [["_id", "=", data._id]]
            })
        }).then((result) => {
            this.validateResult(result)
            // let { records } = result.data;
            return this.responseWithCode(0, 'Đã xoá thành công', '')
        }).catch(error => {
            console.log(error);
            return this.responseWithCatch(error, "[System Error] Lỗi tại function findStudentByIds", "")
        })
    }
}

module.exports = new Student();

