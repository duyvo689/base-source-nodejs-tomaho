const _ = require('lodash');
const { ObjectID } = require('mongodb');
const BaseModel = require('../../base').BaseModel;
let Tomaho;
process.nextTick(() => (Tomaho = require('../../tomaho')));


class ClassClass extends BaseModel {
    constructor(connection) {
        super(connection);
        this.name = 'ClassClass';
        this.label = 'Đối tượng Lớp/Khóa'
        this.fields = {
            name: { type: 'string', string: 'Tên lớp/khóa', mandatory: true },
            status: {
                type: 'selection', string: 'Trạng thái',
                selection: ['open', 'class'],
            },
            create_date: { type: 'date', string: 'Ngày tạo' },
            write_date: { type: 'date', string: 'Ngày chỉnh sửa' },
        }
        this._init(this.fields)
    }

    
    findClassByIds(payload) {
        const { data } = payload;
        return Promise.all([]).then(() => {
            if (!data || !Array.isArray(data._ids || data._ids.length === 0)) {
                throw this.responseWithCode(1, 'Dữ liệu đầu vào không đúng findClassByIds', '')
            }
            this.isListObjectID("findClassByIds _ids", data._ids)
            return this.search({
                domain: [["_id", "in", data._ids]],
                projection: ['name', 'status'], limit: 200
            })
        }).then((result) => {
            this.validateResult(result)
            let { records } = result.data;
            return this.responseWithCode(0, 'Ok', { classList: records })
        }).catch(error => {
            return this.responseWithCatch(error, "[System Error] Lỗi tại function findClassByIds", "")
        })
    }
}

module.exports = new ClassClass();

