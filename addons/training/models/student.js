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
    
    findStudentByIds(payload) {
        const { data } = payload;
        return Promise.all([]).then(() => {
            if (!data || !Array.isArray(data._ids || data._ids.length === 0)) {
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
}

module.exports = new Student();

