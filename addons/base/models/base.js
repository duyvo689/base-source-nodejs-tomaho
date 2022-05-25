const _ = require('lodash');
const { ObjectID } = require('mongodb');
const { set, startOfDay, endOfDay, startOfMonth, endOfMonth } = require('date-fns');
const { format, utcToZonedTime } = require('date-fns-tz');
const DB = require('../../../db');
const SYSTEMCONFIG = require('../../../config');
const { Logger, Tools } = require('../../../utils');
const { niceRequest } = Tools;
const logger = Logger;
let Tomaho;
process.nextTick(() => Tomaho = require('../../tomaho'));

const LOGICAL = ['&', '!', '|'];
const LOGICAL_MAP = { '&': '$and', '!': '$not', '|': '$or' };
const COMPARISON = ['=', '!=', '>', '>=', '<', '<=', 'in', 'not in', 'isExists', 'isLike'];


class BaseModel {
    constructor(connection) {
        this.name = '';
        this.label = '';
        this.fields = {
            create_date: { type: 'date' },
            create_uid: { type: 'many2one', refModel: 'ResUser' },
            write_date: { type: 'date' },
            write_uid: { type: 'many2one', refModel: 'ResUser' }
        }
        // Example
        // type: date, datetime, string, number, many2one, one2many
        // this.fields = {
        //     field_name: { 
        //         type: 'many2one', refModel: 'refModel', 
        //         mandatory: true, noUpdate: true, noRead: true, 
        //         index: true, 
        //         schemaless: []
        //     }
        // }

        this.many2OneFields = []; // các field liên kết với model khác
        this.mandatoryFields = []; // các field required
        this.defaultFields = {};
        this._init(this.fields);
        this.indexes = [
            // { 
            //     key: { field: 1 }, 
            //     name: 'model_field_index_1', 
            //     unique: false, // cho phép trùng lặp
            //     sparse: false // không index những document không có field trong key
            // },
        ]
        this.permission_create = 'base_isNoOne';
        this.permission_read = 'base_isNoOne';
        this.permission_update = 'base_isNoOne';
        this.permission_delete = 'base_isNoOne';
    }

    _init(fields) {
        Object.keys(fields).forEach(key => {
            if (fields[key].mandatory) {
                this.mandatoryFields.push(key)
            }
            if (fields[key].type === 'many2one') {
                this.defaultFields[key] = '';
                if (!this.many2OneFields.includes(key)) {
                    this.many2OneFields.push(key)
                }
            } else if (fields[key].type === 'string') {
                this.defaultFields[key] = '';
            } else if (fields[key].type === 'number') {
                this.defaultFields[key] = '';
            } else if (fields[key].type === 'boolean') {
                this.defaultFields[key] = '';
            } else if (fields[key].type === 'datetime') {
                this.defaultFields[key] = '';
            }
        })
    }

    _buildIndexes() {
        let self = this;
        Promise.all([]).then(() => {
            if (!Array.isArray(self.indexes)) {
                throw `${self.name}.indexes phải là array`
            }
            for (let i of self.indexes) {
                if (typeof i !== 'object' || !i.key || typeof i.key !== 'object') {
                    throw `${self.name}.indexes sai khai báo`
                }
            }
        }).then(() => {
            if (self.indexes && self.indexes.length > 0) {
                self.getCollection().createIndexes(self.indexes, {}, (err, res) => {
                    if (!err && res) {
                        logger.log(`Tạo indexes cho ${self.name} thành công`)
                    } else {
                        console.log(`Lỗi khi tạo ${self.name}.indexes: `, err)
                    }
                })
            }
        }).catch((error) => {
            throw error;
        })
    }

    getCollection(collection) {
        if (!DB.getDBSession()) {
            console.log("Model chưa nhận được kết nối Database")
        } else {
            return DB.getDBSession().collection(collection ? collection : this.name);
        }
    }

    /* 
     * Kiểm tra và làm đúng giá trị - Start
     */
    convertToString(field_name, field_value) {
        return field_value ? field_value.toString() : '';
    }

    convertToNumber(field_name, field_value) {
        return isNaN(field_value) ? 0 : Number(field_value);
    }

    convertToDouble(field_name, field_value) {
        return isNaN(field_value) ? 0 : Number.parseFloat(field_value);
    }

    convertToFloat(field_name, field_value) {
        if (field_value !== true) {
            return false;
        } else {
            return true;
        }
    }

    convertToMany2one(field_name, field_value) {
        if (ObjectID.isValid(field_value)) {
            return ObjectID(field_value);
        } else if (field_value === '') {
            return field_value;
        } else {
            throw `${this.name}.${field_name}: dữ liệu many2one không hợp lệ`;
        }
    }

    convertToSchemaless(field_name, field_value) {
        let checkStr = JSON.stringify(field_value);
        if (checkStr.length > 2000) {
            throw `${this.name}.${field_name}: dữ liệu vượt quá 2000 ký tự`;
        } else {
            return field_value;
        }
    }

    convertCorrectFieldValueByType(f_name, f_value) {
        try {
            switch (this.fields[f_name].type) {
                case 'string':
                    return this.convertToString(f_name, f_value);
                case 'number':
                    return this.convertToNumber(f_name, f_value);
                case 'double':
                    return this.convertToDouble(f_name, f_value);
                case 'boolean':
                    return this.convertToFloat(f_name, f_value);
                case 'date':
                    return f_value;
                case 'datetime':
                    return f_value;
                case 'many2one':
                    return this.convertToMany2one(f_name, f_value);
                case 'schemaless':
                    return this.convertToSchemaless(f_name, f_value);
                default:
                    return f_value;
            }
        } catch (error) {
            throw error;
        }
    }
    /* 
     * Kiểm tra và làm đúng giá trị - End
     */

    /* 
     * ==================================
     * PARSE TOMAHO SQL TO MONGO SQL - Start 
     * ==================================
     */
    _isLogicalOperator(e) {
        return e ? (typeof e === 'string' && LOGICAL.includes(e)) : false;
    }

    _isComparisonOperator(e) {
        return e ? (Array.isArray(e) && e.length === 3 && COMPARISON.includes(e[1])) : false;
    }

    _checkLeaf(e) {
        return (!this._isLogicalOperator(e) && !this._isComparisonOperator(e));
    }

    _mapComparisonLeafToMongo(leaf) {
        try {
            let [left, operator, right] = leaf;
            if (!COMPARISON.includes(operator)) {
                throw `${this.name}._mapComparisonLeafToMongo: operator (${operator}) không được hỗ trợ`;
            }
            if (operator === '=') {
                return { [left]: right }
            } else if (operator === '!=') {
                return { [left]: { '$ne': right } }
            } else if (operator === '>') {
                return { [left]: { '$gt': right } }
            } else if (operator === '>=') {
                return { [left]: { '$gte': right } }
            } else if (operator === '<') {
                return { [left]: { '$lt': right } }
            } else if (operator === '<=') {
                return { [left]: { '$lte': right } }
            } else if (operator === 'in' && Array.isArray(right)) {
                return { [left]: { '$in': right } }
            } else if (operator === 'not in' && Array.isArray(right)) {
                return { [left]: { '$nin': right } }
            } else if (operator === 'isExists' && typeof right === 'boolean') {
                return { [left]: { '$exists': right } }
            } else if (operator === 'isLike' && typeof right === 'string') {
                return { [left]: { '$regex': right, '$options': 'i' } }
            } else {
                throw `${this.name}._mapComparisonLeafToMongo: operator (${operator}) không được hỗ trợ`;
            }
        } catch (error) {
            throw error;
        }
    }

    _mapLogicalLeafToMongo(operator, expressions) {
        try {
            if (!LOGICAL.includes(operator)) {
                throw `${this.name}._mapLogicalLeafToMongo: logical operator (${operator}) không được hỗ trợ`
            }
            if (operator === '&') {
                return { '$and': expressions }
            } else if (operator === '!') {
                return { '$not': expressions }
            } else if (operator === '|') {
                return { '$or': expressions }
            }
        } catch (error) {
            throw error;
        }
    }

    _parseLogicalOperatorToMongo(results, index, last_operator) {
        try {
            if (index < 0) {
                throw `${this.name}._parseLogicalOperatorToMongo: index của logical operator không hợp lệ`;
            }
            if (typeof results[index] === 'undefined') {
                throw `${this.name}._parseLogicalOperatorToMongo: undefined logical operator`;
            }
            if (typeof results[index + 1] === 'undefined' || typeof results[index + 2] === 'undefined') {
                throw `${this.name}._parseLogicalOperatorToMongo: cấu trúc expressions của logical operator không hợp lệ`;
            }
            let operator = results[index], expressions, key;
            // Kiểm tra có trùng Operator
            if (last_operator && (last_operator[0] === index + 1) && (last_operator[1] === operator)) {
                expressions = results[index + 1]; // Đây là Json = {'key': []}
                key = LOGICAL_MAP[operator];
                expressions[[key]].push(results[index + 2])
                results.splice(index, 3, expressions);
            } else {
                expressions = [results[index + 1], results[index + 2]]; // Đây là array
                results.splice(index, 3, this._mapLogicalLeafToMongo(operator, expressions));
            }
            return [index, operator];
        } catch (error) {
            throw error;
        }
    }

    _parseDomainForSearchJoin({ domain }) {
        try {
            let dataJoin = {}, // { user_id: 'ResUser' }
                field = [], self = this;
            for (let item of domain) {
                if (Array.isArray(item)) { // chỉ quan tâm điều kiện lọc [a,'so sánh',b]
                    field = item[0].split('.'); // user_id.name => ['user_id','name']
                    if (field.length === 2) {
                        if (self.fields[field[0]].type === 'many2one') { // ref field
                            if (!self.fields[field[0]].noJoin) { // run join
                                dataJoin[[field[0]]] = self.fields[field[0]].refModel;
                            } else {
                                continue;
                            }
                        } else if (self.fields[field[0]].type === 'schemaless') { // là trường schemaless
                            continue;
                        } else {
                            throw `domain = [...${JSON.stringify(item)}...]`;
                        }
                    } else if (field.length === 1) { // trường của model hiện tại
                        continue;
                    } else {
                        throw `domain = [...${JSON.stringify(item)}...]`;
                    }
                }
            }
            let fieldsJoin = Object.keys(dataJoin);
            if (!_.isEmpty(dataJoin)) {
                let refFieldType;
                domain.forEach((item, index) => {
                    if (Array.isArray(item)) {
                        field = item[0].split('.');
                        if (fieldsJoin.indexOf(field[0]) > -1) { // ref field
                            if (field.length === 1) {
                                domain[index][0] = `${item[0]}._id`;
                                if (item[1] === 'in' || item[1] === 'not in') {
                                    if (Array.isArray(item[2])) {
                                        domain[index][2] = item[2].map((i) => {
                                            if (ObjectID.isValid(i)) { // nếu là ObjectID -> convert
                                                return ObjectID(i)
                                            } else {
                                                return i;
                                            }
                                        })
                                    } else {
                                        throw `domain = [...${JSON.stringify(item)}...]`;
                                    }
                                } else if (item[1] === '=' || item[1] === '!=') {
                                    if (ObjectID.isValid(item[2])) { // nếu là ObjectID -> convert
                                        domain[index][2] = ObjectID(item[2])
                                    }
                                }
                            } else { // chỉ có thể bằng 2
                                // ví dụ: Tomaho['ResUser'].fields['name'].type = 'string'
                                refFieldType = Tomaho[dataJoin[field[0]]].fields[field[1]].type;
                                if (refFieldType === 'many2one') {
                                    if (item[1] === 'in' || item[1] === 'not in') {
                                        if (Array.isArray(item[2])) {
                                            domain[index][2] = item[2].map((i) => {
                                                if (ObjectID.isValid(i)) { // nếu là ObjectID -> convert
                                                    return ObjectID(i)
                                                } else {
                                                    return i;
                                                }
                                            })
                                        } else {
                                            throw `domain = [...${JSON.stringify(item)}...]`;
                                        }
                                    } else if (item[1] === '=' || item[1] === '!=') {
                                        if (ObjectID.isValid(item[2])) { // nếu là ObjectID -> convert
                                            domain[index][2] = ObjectID(item[2])
                                        }
                                    }
                                }
                                refFieldType = undefined; // reset
                            }
                        }
                    }
                })
            }
            return { parseDomain: domain, fieldsSearchJoin: fieldsJoin }
        } catch (error) {
            throw error;
        }
    }

    _parseSearchDomainToJson(payload) {
        try {
            let { domain } = payload;
            if (!domain || !Array.isArray(domain)) {
                throw `domain = ${JSON.stringify(domain)}`;
            }
            // Kiểm tra cấu trúc của Domain
            for (let item of domain) {
                if (this._checkLeaf(item)) {
                    throw `domain = [...${JSON.stringify(item)}...]`;
                }
            }
            // Parse domain lọc các trường many2one để join
            let { parseDomain, fieldsSearchJoin } = this._parseDomainForSearchJoin({ domain })
            payload.fieldsSearchJoin = fieldsSearchJoin; // fieldsSearchJoin dùng bên _search
            // Chuẩn bị data để parse Domain thành JSON
            let result = {}, parseResult = [], leaf;
            parseDomain.reverse();
            // Parse Comparison Operator
            while (leaf = parseDomain.pop()) {
                if (this._isLogicalOperator(leaf)) {
                    parseResult.push(leaf)
                } else if (this._isComparisonOperator(leaf)) {
                    parseResult.push(this._mapComparisonLeafToMongo(leaf))
                } else {
                    throw `reversed domain = [...${JSON.stringify(leaf)}...]`;
                }
            }
            // Parse Logical Operator
            let logicIndexes = [];
            parseResult.forEach((e, i) => { if (this._isLogicalOperator(e)) { logicIndexes.push(i) } })
            if (logicIndexes.length > 0) {
                logicIndexes.reverse()
                let lastOperator;
                for (let i = 0; i < logicIndexes.length; i++) {
                    lastOperator = this._parseLogicalOperatorToMongo(parseResult, logicIndexes[i], lastOperator)
                }
            }
            parseResult.forEach((e) => { Object.assign(result, e) })
            return result;
        } catch (error) {
            throw error;
        }
    }
    // ==================================
    // PARSE TOMAHO SQL TO MONGO SQL - END 
    // ==================================

    _verifyAndConvertDataBeforeCreate({ document }) {
        try {
            if (typeof document !== 'object' || _.isEmpty(document)) {
                throw `document = ${JSON.stringify(document)}`;
            }
            let self = this, keys = Object.keys(document);
            if (!self.mandatoryFields.every(f => keys.indexOf(f) > -1)) { // Kiểm tra trường bắt buộc
                self.mandatoryFields.forEach(f => {
                    if (keys.indexOf(f) === -1) {
                        throw `thiếu field bắt buộc ${f}`;
                    }
                })
            }
            _.forEach(document, function (v, f) {
                if (!self.fields.hasOwnProperty(f)) {
                    if (f === '_id' && ObjectID.isValid(v)) {
                        // ko làm gì hết
                    } else {
                        delete document[f]; // Xóa trường không tồn tại
                    }
                } else {
                    if (self.fields[f].mandatory && (v === null || v === undefined || v === '')) {
                        throw `field bắt buộc ${f} không được để trống`;
                    } else {
                        document[f] = self.convertCorrectFieldValueByType(f, v); // Ép kiểu giá trị của trường về đúng dạng
                    }
                }
            })
            let result = { ...self.defaultFields, ...document } // left outer join dữ liệu
            return result;
        } catch (error) {
            throw error;
        }
    }

    _updateDocumentBeforeCreate(payload) {
        let { documents } = payload, self = this;
        return Promise.all([]).then(() => {
            if (!Array.isArray(documents) || documents.length === 0) {
                throw `documents = ${JSON.stringify(documents)}`;
            }
            documents.forEach((doc, index) => {
                let newDoc = self._verifyAndConvertDataBeforeCreate({ document: doc }) // dữ liệu đã được filter
                documents[index] = { ...newDoc }
            })
            payload = { ...payload, documents } // overwrite
            return self.responseWithCode(0, "Ok", {})
        }).catch((error) => {
            throw error;
        })
    }

    _create({ documents, options }) {
        return new Promise((resolve, reject) => {
            this.getCollection().insertMany(documents, options, (err, res) => {
                if (!err) {
                    resolve(res)
                } else {
                    reject(err)
                }
            })
        }).then((mongoResult) => { // kết quả phải là JSON object
            let { ops, result } = mongoResult;
            if (result && result.ok === 1) { // 1 là command chạy đúng
                return this.responseWithCode(0, "Ok", { records: ops })
            } else {
                logger.trace(`${this.name}._create: result.ok = ${result.ok}`)
                return this.responseWithCode(1, "Lỗi khi tạo mới record")
            }
        }).catch((error) => {
            logger.trace(`${this.name}._create: Error = ${JSON.stringify(error)}`)
            return this.responseWithCode(1, "Không thể tạo mới record", {})
        })
    }

    _doCreate(payload) {
        try {
            let { documents, options } = payload;
            return this._create({ documents, options })
        } catch (error) {
            throw error;
        }
    }

    responseWithCode(code, msg, data) {
        return {
            statusCode: code,
            statusMessage: msg || '',
            data: data
        }
    }

    create(payload) {
        return Promise.all([]).then(() => {
            return this._updateDocumentBeforeCreate(payload)
        }).then((result) => {
            this.validateResult(result)
            return this._doCreate(payload)
        }).catch((error) => {
            if (error.hasOwnProperty('statusCode') && error.hasOwnProperty('statusMessage')) {
                return error;
            } else {
                logger.trace(`${this.name}.create: Error ${JSON.stringify(error)}`)
                return this.responseWithCode(1, "Không thể tạo mới record", {})
            }
        })
    }

    // function này sẽ kiểm tra tất cả các field điều kiện lọc trong domain
    // chỉ giữ các field thuộc model
    _parseDomainKeepValidField({ domain }) {
        try {
            let newDomain = [], field;
            for (let item of domain) {
                if (Array.isArray(item)) {
                    if (item.length === 3) {
                        field = item[0].split(".");
                        if (field.length < 1) {
                            throw `${this.name}.search: Error domain = [...${String(item)}...]`;
                        } else {
                            // giữ field thuộc model hoặc _id
                            if (field[0] === '_id' || this.fields.hasOwnProperty(field[0])) {
                                newDomain.push(item);
                            } else {
                                continue;
                            }
                        }
                    } else {
                        throw `${this.name}.search: Error domain = [...${String(item)}...]`;
                    }
                } else {
                    if (LOGICAL.indexOf(item) > -1) {
                        newDomain.push(item)
                    } else {
                        throw `${this.name}.search: Error domain = [...${String(item)}...]`;
                    }
                }
            }
            return newDomain;
        } catch (error) {
            throw error;
        }
    }

    _parseDomainConvertMany2oneToObjectId({ domain }) {
        try {
            let self = this;
            domain.forEach((item, index) => {
                if (Array.isArray(item) && item.length === 3) {
                    if (!self.many2OneFields.includes(item[0]) && item[0] !== '_id') {
                        // continue;
                    } else {
                        if (["=", "!="].includes(item[1])) {
                            if (ObjectID.isValid(item[2])) { // data là ObjectID
                                domain[index][2] = ObjectID(item[2]);
                            }
                        } else if (["in", "not in"].includes(item[1])) {
                            if (Array.isArray(item[2])) {
                                domain[index][2] = item[2].map((i) => {
                                    if (ObjectID.isValid(i)) { // data là ObjectID
                                        return ObjectID(i)
                                    } else {
                                        return i;
                                    }
                                })
                            } else {
                                throw `${self.name}.search: Error domain = [...${String(item)}...]`;
                            }
                        } else {
                            // continue;
                        }
                    }
                }
            })
            return domain;
        } catch (error) {
            throw error;
        }
    }

    _checkAndUpdateDomainBeforeAction({ domain, permission }) {
        try {
            if (!Array.isArray(domain)) {
                throw `${this.name}.search: Error domain = ${String(domain)}`;
            }
            // Lọc lấy các field của model
            let result = this._parseDomainKeepValidField({ domain })
            // Convert string thành ObjectID
            return this._parseDomainConvertMany2oneToObjectId({ domain: result })
        } catch (error) {
            throw error
        }
    }

    _rawSearch({ domain, projection, limit, offset, order, options }) {
        return new Promise((resolve, reject) => {
            this.getCollection().find(domain, options).sort(order).skip(offset).limit(limit).project(projection).toArray((err, res) => {
                if (!err) {
                    resolve(res)
                } else {
                    reject(err)
                }
            })
        }).then((mongoResult) => {
            return this.responseWithCode(0, "Ok", { records: mongoResult })
        }).catch((error) => {
            logger.trace(`${this.name}._rawSearch: Error = ${JSON.stringify(error)}`)
            return this.responseWithCode(1, "Không thể lấy dữ liệu", {})
        })
    }

    _pipelineSearch({ aggregate, options }) {
        return new Promise((resolve, reject) => {
            this.getCollection().aggregate(aggregate, options).toArray((err, res) => {
                if (!err) {
                    resolve(res)
                } else {
                    reject(err)
                }
            })
        }).then((mongoResult) => {
            return this.responseWithCode(0, "Ok", { records: mongoResult })
        }).catch((error) => {
            logger.trace(`${this.name}._pipelineSearch: Error = ${JSON.stringify(error)}`)
            return this.responseWithCode(1, "Không thể lấy dữ liệu", {})
        })
    }

    // Tất cả điều kiện sẽ được parse ra và mang vào search bằng aggregation pipeline
    _search(payload) {
        try {
            let { domain, projection, limit, offset, order, options, fieldsSearchJoin, enableFacet } = payload;
            let aggregate = [], new_projection = {}, self = this;
            // left join cho many2one field
            if (fieldsSearchJoin && fieldsSearchJoin.length > 0) {
                fieldsSearchJoin.forEach((f) => {
                    aggregate.push(...self.leftJoin({
                        ref_model: self.fields[f].refModel,
                        ref_field: '_id', field: f, name: f
                    }))
                })
            }
            aggregate.push({ $match: domain }) // add filter
            // tìm và join để lấy thêm name của many2one field
            if (Array.isArray(projection) && projection.length > 0) {
                for (let i = 0; i < projection.length; i++) {
                    let [f, right] = projection[i].split(".");
                    if (self.fields[f]) {
                        if (self.fields[f].type === 'many2one' && !self.fields[f].noJoin) {
                            let selects = { $ifNull: [{ name: `$${f}.name`, _id: `$${f}._id` }, []] }
                            if (!fieldsSearchJoin || (fieldsSearchJoin && fieldsSearchJoin.indexOf(f) === -1)) {
                                aggregate.push(...self.leftJoin({
                                    ref_model: self.fields[f].refModel,
                                    ref_field: '_id', field: f, name: f
                                }))
                            }
                            if (right) {
                                right = right.slice(1, -1).split(',')
                                right.forEach(e => {
                                    Object.assign(selects.$ifNull[0], { [e]: `$${f}.${e}` })
                                })
                            }
                            new_projection[f] = selects
                        } else {
                            if (self.fields[f].hasOwnProperty('defaultSearch')) {
                                new_projection[f] = { $ifNull: [`$${f}`, self.fields[f].defaultSearch] }
                            } else {
                                new_projection[f] = 1;
                            }
                        }
                    } else if (f === '_id') {
                        new_projection[f] = 1;
                    }
                }
            }
            // order result
            if (typeof order === 'object' && !Array.isArray(order) && Object.keys(order).length > 0) {
                aggregate.push({ $sort: order })
            }
            // mặc định lấy _id và name
            if (_.isEmpty(new_projection)) {
                Object.assign(new_projection, { _id: 1, name: 1 })
            }
            aggregate.push({ $project: new_projection })
            if (enableFacet === true) {
                // facet result
                let facet = { "records": [], "totalRecord": [{ $count: "count" }] }
                // offset - skip
                if (Number.isInteger(offset) && offset >= 0) {
                    facet["records"].push({ $skip: offset })
                }
                // limit
                if (Number.isInteger(limit)) {
                    if (limit > 0) {
                        facet["records"].push({ $limit: limit })
                    } else if (limit === -1) {
                        // no limit
                    } else {
                        facet["records"].push({ $limit: 40 })
                    }
                } else {
                    facet["records"].push({ $limit: 40 })
                }
                aggregate.push({ $facet: facet })
            } else {
                if (Number.isInteger(offset) && offset >= 0) {
                    aggregate.push({ $skip: offset })
                }
                if (Number.isInteger(limit)) {
                    if (limit > 0) {
                        aggregate.push({ $limit: limit })
                    } else if (limit === -1) {
                        // no limit
                    } else {
                        aggregate.push({ $limit: 40 })
                    }
                } else {
                    aggregate.push({ $limit: 40 })
                }
            }
            return self._pipelineSearch({ aggregate, options })
        } catch (error) {
            throw error;
        }
    }

    _updateDomainBeforeSearch(payload) {
        return Promise.all([]).then(() => {
            let { domain, permission } = payload;
            payload.domain = [...this._checkAndUpdateDomainBeforeAction({ domain, permission })]
            return this.responseWithCode(0, "Ok", {})
        }).catch((error) => {
            throw error;
        })
    }

    _removeNoReadFieldBeforeSearch(payload) {
        let { projection, permission } = payload;
        let prefix = /[\[]/g,  // tìm "["
            postfix = /[\]]/g, // tìm "]"
            new_projection = ['_id', 'name']; // default lấy _id và name
        return Promise.all([]).then(() => {
            if (Array.isArray(projection)) {
                for (let field of projection) { // Ví dụ: "move_id.[_id,name]" hoặc "move_id.amount"
                    let [f, right] = field.split('.');
                    if (this.fields[f] && !this.fields[f].noRead) { // field thuộc model và được phép đọc
                        if (this.fields[f].type !== 'many2one') { // các field != many2one
                            new_projection.push(f)
                        } else { // là many2one field
                            if (this.fields[f].noJoin) {
                                new_projection.push(f)
                            } else {
                                let ref_name = this.fields[f].refModel;
                                let ref_model = Tomaho[ref_name];
                                if (!ref_name) {
                                    throw `${f}.refModel = ${String(ref_name)}`;
                                } else {
                                    if (!ref_model) {
                                        throw `Tomaho.${String(ref_model)} chưa tồn tại (${this.name}.${f})`;
                                    } else {
                                        // if (!permission.groups[ref_model.permission_read]) {
                                        //     throw `Người dùng không có quyền trên Tomaho.${String(ref_model)}`;
                                        // }
                                    }
                                }
                                if (right) { // khác undefined và empty string
                                    let f_list = ['_id', 'name']
                                    let s1 = right.search(prefix)
                                    let s2 = right.search(postfix)
                                    let rl = right.length - 1
                                    if (s1 === 0) { // muốn lấy tập các field của "f" object
                                        if ((s2 === -1) || (s2 > 0 && s2 !== rl)) {
                                            throw `projection = [...${String(field)}...]`;
                                        } else {
                                            right = right.slice(1, -1).split(',')
                                            right.forEach((e) => {
                                                if (ref_model.fields[e] && !ref_model.fields[e].noRead) {
                                                    f_list.push(e)
                                                }
                                            })
                                        }
                                    } else if (s1 > 0) {
                                        throw `projection = [...${String(field)}...]`;
                                    } else { // lấy chính xác 1 field của "f" object
                                        if (s2 >= 0) {
                                            throw `projection = [...${String(field)}...]`;
                                        }
                                        if (ref_model.fields[right] && !ref_model.fields[right].noRead) {
                                            f_list.push(right)
                                        }
                                    }
                                    f_list = [...new Set(f_list)] // remove duplicated keys
                                    if (f_list.length > 0) {
                                        new_projection.push(`${f}.[${f_list.join()}]`)
                                    } else {
                                        new_projection.push(f)
                                    }
                                } else { // undefined hoặc empty string
                                    new_projection.push(f)
                                }
                            }
                        }
                    }
                }
            }
            payload.projection = new_projection;
            return this.responseWithCode(0, "Ok", {})
        }).catch((error) => {
            throw error;
        })
    }

    _doSearch(payload) {
        // convert domain và lọc many2one field để join (payload.fieldsSearchJoin)
        payload.domain = this._parseSearchDomainToJson(payload)
        return this._search(payload)
    }

    search(payload) {
        // let { user_id, token } = payload;
        return Promise.all([]).then(() => {
            return this._updateDomainBeforeSearch({ options: {}, ...payload })
        }).then((result) => {
            this.validateResult(result)
            return this._removeNoReadFieldBeforeSearch(payload)
        }).then((result) => {
            this.validateResult(result)
            return this._doSearch(payload)
        }).catch((error) => {
            if (error.hasOwnProperty('statusCode') && error.hasOwnProperty('statusMessage')) {
                return error;
            } else {
                logger.trace(`${this.name}.search: Error ${JSON.stringify(error)}`)
                return this.responseWithCode(1, "Không thể lấy dữ liệu", {})
            }
        })
    }

    parseDataRemoveNoUpdateField({ update }) {
        try {
            let self = this;
            _.forEach(update, function (v, f) {
                if (self.fields[f].noUpdate) {
                    delete update[f]; // remove no update field 
                }
            })
        } catch (error) {
            throw error;
        }
    }

    parseDataValidateRequiredField({ update }) {
        try {
            let self = this;
            _.forEach(update, function (v, f) {
                if (self.fields[f].mandatory) {
                    if (self.fields[f].type === 'number') {
                        if (isNaN(v)) {
                            throw ` trường ${f} không phải là number`;
                        }
                    } else if (!v) {
                        throw ` trường ${f} không được để trống`;
                    }
                }
            })
        } catch (error) {
            throw error;
        }
    }

    _verifyAndConvertDataBeforeUpdate({ update }) {
        try {
            if (typeof update !== 'object' || Array.isArray(update) && _.isEmpty(update)) {
                throw `update = ${JSON.stringify(update)}`;
            }
            let updateFields = Object.keys(update), self = this;
            for (let f of updateFields) {
                if (!this.fields.hasOwnProperty(f)) {
                    delete update[f];
                }
            }
            this.parseDataRemoveNoUpdateField({ update })
            this.parseDataValidateRequiredField({ update })
            _.forEach(update, function (v, f) {
                update[f] = self.convertCorrectFieldValueByType(f, v)
            })
            return { ...update }
        } catch (error) {
            throw error;
        }
    }

    _updateDomainBeforeUpdate(payload) {
        return Promise.all([]).then(() => {
            let { domain, permission } = payload;
            payload.domain = [...this._checkAndUpdateDomainBeforeAction({ domain, permission })]
            return this.responseWithCode(0, "Ok", {})
        }).catch((error) => {
            throw error;
        })
    }

    _updateDocumentBeforeUpdate(payload) {
        return Promise.all([]).then(() => {
            let { update } = payload;
            let newUpdate = this._verifyAndConvertDataBeforeUpdate({ update })
            payload.update = { ...newUpdate }
            return this.responseWithCode(0, "Ok", {})
        }).catch((error) => {
            throw error;
        })
    }

    _update({ domain, update, options }) {
        return new Promise((resolve, reject) => {
            this.getCollection().updateMany(domain, update, options, (err, res) => {
                if (!err) {
                    resolve(res)
                } else {
                    reject(err)
                }
            })
        }).then((mongoResult) => {
            let { acknowledged, matchedCount, modifiedCount } = mongoResult;
            return this.responseWithCode(0, "Ok", { acknowledged, matchedCount, modifiedCount })
        }).catch((error) => {
            logger.trace(`${this.name}._update: Error = ${JSON.stringify(error)}`)
            return this.responseWithCode(1, "Không thể cập nhật record", {})
        })
    }

    _doUpdate(payload) {
        try {
            let { recordIds, options } = payload;
            let domain = {
                _id: { $in: recordIds }
            }
            let update = { $set: payload.update }
            return this._update({ domain, update, options })
        } catch (error) {
            throw error;
        }
    }

    update(payload) {
        return Promise.all([]).then(() => {
            return this._updateDomainBeforeUpdate({ options: {}, ...payload })
        }).then((result) => {
            this.validateResult(result)
            return this._updateDocumentBeforeUpdate(payload)
        }).then((result) => {
            this.validateResult(result)
            let domain = this._parseSearchDomainToJson(payload)
            payload = { ...payload, domain }
            let { options, fieldsSearchJoin } = payload;
            // tìm và chỉ lấy id của các record cần update
            return this._search({ domain, projection: ['_id'], limit: -1, options, fieldsSearchJoin })
        }).then((result) => {
            this.validateResult(result)
            let { records } = result.data;
            let recordIds = records.map((r) => { return r._id }) // các record cần update
            payload = { ...payload, recordIds }
            return this._doUpdate(payload)
        }).then((result) => {
            this.validateResult(result)
            let { recordIds } = payload;
            return this.responseWithCode(0, "Ok", { ...result, updateIds: recordIds })
        }).catch((error) => {
            if (error.hasOwnProperty('statusCode') && error.hasOwnProperty('statusMessage')) {
                return error;
            } else {
                logger.trace(`${this.name}.update: Error ${JSON.stringify(error)}`)
                return this.responseWithCode(1, "Không thể cập nhật dữ liệu", {})
            }
        })
    }

    _updateDomainsBeforeWrite(payload) {
        return Promise.all([]).then(() => {
            let { permission } = payload, self = this;
            if (payload.hasOwnProperty('update')) { // key update là updateMany
                if (Array.isArray(payload.update)) {
                    let newUpdate = [...payload.update]
                    for (let i in newUpdate) {
                        let { domain } = newUpdate[i]
                        domain = [...self._checkAndUpdateDomainBeforeAction({ domain, permission })]
                        newUpdate[i] = { ...newUpdate[i], domain }
                    }
                    payload = { ...payload, update: newUpdate }
                } else {
                    throw `key update = ${JSON.stringify(payload.update)}`;
                }
            }
            if (payload.hasOwnProperty('delete')) { // key delete là deleteMany
                if (Array.isArray(payload.delete)) {
                    let newDelete = [...payload.delete]
                    for (let i in newDelete) {
                        let { domain } = newDelete[i]
                        domain = [...self._checkAndUpdateDomainBeforeAction({ domain, permission })]
                        newDelete[i] = { ...newDelete[i], domain }
                    }
                    payload = { ...payload, delete: newDelete }
                } else {
                    throw `key delete = ${JSON.stringify(payload.delete)}`;
                }
            }
            return this.responseWithCode(0, "Ok", {})
        }).catch((error) => {
            throw error;
        })
    }

    _updateDocumentsBeforeWrite(payload) {
        return Promise.all([]).then(() => {
            let self = this;
            if (payload.hasOwnProperty("create")) { // key create là insertMany
                if (!Array.isArray(payload.create)) {
                    throw `key create phải là array`;
                } else {
                    let newCreate = [];
                    for (let item of payload.create) {
                        newCreate.push({
                            ...self._verifyAndConvertDataBeforeCreate({ document: item }) // dữ liệu đã được filter
                        })
                    }
                    payload = { ...payload, create: newCreate }
                }
            }
            if (payload.hasOwnProperty("update")) { // key update là updateMany
                if (!Array.isArray(payload.update)) {
                    throw `key update phải là array`;
                } else {
                    let newUpdate = [...payload.update]
                    for (let i in newUpdate) {
                        let { update } = newUpdate[i]
                        newUpdate[i] = {
                            ...newUpdate[i],
                            update: {
                                ...self._verifyAndConvertDataBeforeUpdate({ update })
                            }
                        }
                    }
                }
            }
            return this.responseWithCode(0, "Ok", {})
        }).catch((error) => {
            throw error;
        })
    }

    _write({ operations, options }) {
        return new Promise((resolve, reject) => {
            this.getCollection().bulkWrite(operations, options, (err, res) => {
                if (!err) {
                    resolve(res)
                } else {
                    reject(err)
                }
            })
        }).then((mongoResult) => {
            return this.responseWithCode(0, "Ok", { ...mongoResult })
        }).catch((error) => {
            logger.trace(`${this.name}._write: Error = ${JSON.stringify(error)}`)
            return this.responseWithCode(1, "Không thể cập nhật dữ liệu", {})
        })
    }

    _doWrite(payload) {
        try {
            let operations = [];
            if (payload.create) {
                payload.create.forEach((item) => {
                    operations.push({ insertOne: { document: item } })
                })
            }
            if (payload.update) {
                payload.update.forEach((item) => {
                    let { update, upsert } = item;
                    let operation = {
                        filter: this._parseSearchDomainToJson(item), // { domain: item.domain }
                        update: { $set: update },
                        upsert: false,
                    }
                    if (item.hasOwnProperty('upsert') && typeof upsert === 'boolean' && upsert) {
                        operation.upsert = true; // insert nếu không tìm thấy
                    }
                    operations.push({ updateMany: operation })
                })
            }
            if (payload.delete) {
                payload.delete.forEach((item) => {
                    let operation = {
                        filter: this._parseSearchDomainToJson(item), // { domain: item.domain }
                    }
                    operations.push({ deleteMany: operation })
                })
            }
            delete payload['create'];
            delete payload['update'];
            delete payload['delete'];
            if (operations.length > 0) {
                let { options } = payload;
                return this._write({ operations, options })
            } else {
                throw 'Không có dữ liệu cần cập nhật';
            }
        } catch (error) {
            throw error;
        }
    }

    write(payload) {
        return Promise.all([]).then(() => {
            return this._updateDomainsBeforeWrite({ options: {}, ...payload })
        }).then((result) => {
            this.validateResult(result)
            return this._updateDocumentsBeforeWrite(payload)
        }).then((result) => {
            this.validateResult(result)
            return this._doWrite(payload)
        }).catch((error) => {
            if (error.hasOwnProperty('statusCode') && error.hasOwnProperty('statusMessage')) {
                return error;
            } else {
                logger.trace(`${this.name}.write: Error ${JSON.stringify(error)}`)
                return this.responseWithCode(1, "Không thể cập nhật dữ liệu", {})
            }
        })
    }

    _updateDomainBeforeDelete(payload) {
        return Promise.all([]).then(() => {
            let { domain, permission } = payload;
            payload.domain = [...this._checkAndUpdateDomainBeforeAction({ domain, permission })]
            return this.responseWithCode(0, "Ok", {})
        }).catch((error) => {
            throw error;
        })
    }

    _delete({ domain, options }) {
        return new Promise((resolve, reject) => {
            this.getCollection().deleteMany(domain, options, (err, res) => {
                if (!err) {
                    resolve(res)
                } else {
                    reject(err)
                }
            })
        }).then((mongoResult) => {
            return this.responseWithCode(0, "Ok", { ...mongoResult })
        }).catch((error) => {
            logger.trace(`${this.name}._delete: Error = ${JSON.stringify(error)}`)
            return this.responseWithCode(1, "Không thể xóa record", {})
        })
    }

    _doDelete(payload) {
        try {
            let { options } = payload;
            let domain = this._parseSearchDomainToJson(payload)
            return this._delete({ domain, options })
        } catch (error) {
            throw error;
        }
    }

    delete(payload) {
        return Promise.all([]).then(() => {
            return this._updateDomainBeforeDelete({ options: {}, ...payload })
        }).then((result) => {
            this.validateResult(result)
            return this._doDelete(payload)
        }).catch((error) => {
            if (error.hasOwnProperty('statusCode') && error.hasOwnProperty('statusMessage')) {
                return error;
            } else {
                logger.trace(`${this.name}.create: Error ${JSON.stringify(error)}`)
                return this.responseWithCode(1, "Không thể xóa record", {})
            }
        })
    }

    _many2OneJoinValidation({ field, ref_model, ref_field, name, left_join }) {
        try {
            if (typeof field !== 'string' || !field) {
                throw "Join bảng: thiếu field"
            } else if (typeof ref_model !== 'string' || !ref_model) {
                throw "Join bảng: thiếu ref_model"
            } else if (!Tomaho.hasOwnProperty(ref_model)) {
                throw "Join bảng: ref_model không tồn tại"
            } else if (typeof name !== 'string' || !name) {
                throw "Join bảng: thiếu name"
            } else if (typeof left_join !== 'boolean') {
                throw "Join bảng: thiếu left_join"
            }
            if (typeof ref_field === 'string') {
                if (!ref_field.trim()) {
                    throw "Join bảng: ref_field không được là empty string"
                } else if (Tomaho[ref_model].fields && !Tomaho[ref_model].fields.hasOwnProperty(ref_field)) {
                    if (ref_field !== "_id") {
                        throw `Join bảng: trường ${ref_model}.${ref_field} không tồn tại`
                    }
                }
            } else {
                ref_field = "_id"; // default join vào _id của ref_model
            }
            return [
                {
                    '$lookup': {
                        'from': `${ref_model}`,
                        'foreignField': `${ref_field}`,
                        'localField': `${field}`,
                        'as': `${name}`
                    }
                },
                {
                    '$unwind': {
                        'path': `$${name}`,
                        'preserveNullAndEmptyArrays': left_join
                    }
                },
            ]
        } catch (error) {
            throw error;
        }
    }

    leftJoin({ field, ref_model, ref_field, name }) {
        try {
            return this._many2OneJoinValidation({
                field, ref_model, ref_field, name, left_join: true
            })
        } catch (error) {
            throw error;
        }
    }

    rightJoin({ field, ref_model, ref_field, name }) {
        try {
            return this._many2OneJoinValidation({
                field, ref_model, ref_field, name, left_join: false
            })
        } catch (error) {
            throw error;
        }
    }

    validateResult(data) {
        if (data) {
            if (data.statusCode === 0) {
                // result ok
            } else {
                throw data;
            }
        } else {
            throw data;
        }
    }

    // kiểm tra date hợp lệ
    isValidDate(value) {
        try {
            if (
                value instanceof Date ||
                (typeof value === 'object' && Object.prototype.toString.call(value) === '[object Date]')
            ) {
                return true;
            } else if (
                typeof value === 'number' || Object.prototype.toString.call(value) === '[object Number]'
            ) {
                return true;
            } else {
                return false;
            }
        } catch (error) {
            return false;
        }
    }

    // kiểm tra time zone hợp lệ
    isValidTimeZone(tz) {
        if (!Intl || !Intl.DateTimeFormat().resolvedOptions().timeZone) {
            throw new Error('Time zones are not available in this environment');
        }
        try {
            Intl.DateTimeFormat(undefined, { timeZone: tz })
            return true;
        } catch (error) {
            return false;
        }
    }

    // Convert từ UTC qua time zone muốn chuyển đổi
    parseUtcDateToTimeZone({ value, tz }) {
        try {
            let result, applyTimeZone;
            if (
                value instanceof Date ||
                (typeof value === 'object' && Object.prototype.toString.call(value) === '[object Date]')
            ) {
                // Prevent the date to lose the milliseconds when passed to new Date() in IE10
                result = new Date(value.getTime())
            } else if (
                typeof value === 'number' || Object.prototype.toString.call(value) === '[object Number]'
            ) {
                result = new Date(value)
            } else {
                throw 'value phải là new Date() hoặc là Number()';
            }
            if (!this.isValidTimeZone(tz)) {
                applyTimeZone = 'Asia/Ho_Chi_Minh';
            } else {
                applyTimeZone = tz;
            }
            return utcToZonedTime(result, applyTimeZone)
        } catch (error) {
            throw error;
        }
    }

    // Chuyển đổi input Date qua time zone mong muốn
    smartParseDate({ value, pattern, tz }) {
        try {
            let validPattern, validTimeZone;
            if (!pattern) {
                validPattern = 'dd/MM/yyyy';
            } else {
                validPattern = pattern;
            }
            if (!this.isValidTimeZone(tz)) {
                validTimeZone = 'Asia/Ho_Chi_Minh';
            } else {
                validTimeZone = tz;
            }
            // Áp dụng time zone cho dữ liệu
            let dateInTimeZone = this.parseUtcDateToTimeZone({ value, validTimeZone })
            let beginDay = startOfDay(dateInTimeZone) // 00:00:00 000 của ngày
            let endDay = endOfDay(dateInTimeZone) // 23:59:59 999 của ngày
            let dateFormat = format(dateInTimeZone, validPattern, { timeZone: validTimeZone })
            // Năm + tháng + ngày (ví dụ: 20210930 = 30 tháng 09 năm 2021)
            let dateToString = format(dateInTimeZone, 'yyyyMMdd', { timeZone: validTimeZone }) // dạng string
            let dateToNumber = Number(dateToString) // dạng số
            return {
                dateInTimeZone, // Date đã được áp dụng time zone
                beginDay, // Thời gian đầu ngày (00:00:00 000) sau khi áp dụng time zone
                endDay, // Thời gian cuối ngày (23:59:59 999) sau khi áp dụng time zone
                dateFormat, // Date ở dạng String và format theo pattern
                dateToString, // Date ở dạng String
                dateToNumber, // Date ở dạng số
            }
        } catch (error) {
            throw error;
        }
    }

    // Mặc định chuyển đổi về time zone của Hồ Chí Minh (Việt Nam)
    defaultParseDate(value) {
        try {
            if (!this.isValidDate(value)) {
                throw "Dữ liệu ngày không hợp lệ";
            } else {
                return this.smartParseDate({
                    value: new Date(value).getTime(), pattern: 'dd/MM/yyyy', tz: 'Asia/Ho_Chi_Minh'
                })
            }
        } catch (error) {
            throw error;
        }
    }

    // kiểm tra giá trị có phải ObjectID của MongoDB
    isObjectID(value) {
        try {
            if (ObjectID.isValid(value)) {
                return true;
            } else {
                return false;
            }
        } catch (error) {
            throw error;
        }
    }

    // tìm vị trí của data_id trong array của object với object._id là ObjectId
    getIndexOfId({ dataArr, data_id }) {
        try {
            let result = -1;
            if (this.isObjectID(data_id)) {
                for (let i = 0; i < dataArr.length; i++) {
                    if (ObjectID(dataArr[i]._id).equals(data_id)) {
                        result = i;
                        break;
                    }
                }
            }
            return result;
        } catch (error) {
            throw error;
        }
    }

    // xác định ngày bắt đầu và kết thúc của tháng (mặc định về time zone của Hồ Chí Minh)
    smartParseTimeOfMonthByDate({ value }) {
        try {
            if (!this.isValidDate(value)) {
                throw "Dữ liệu ngày không hợp lệ";
            } else {
                // convert về HCM timezone
                let tzdate = this.parseUtcDateToTimeZone({ value })
                let startMonth = startOfMonth(tzdate) // datetime bắt đầu của tháng
                let endMonth = endOfMonth(tzdate) // datetime kết thúc của tháng
                return { startMonth, endMonth }
            }
        } catch (error) {
            throw error;
        }
    }

    // xác định ngày bắt đầu và kết thúc của tháng (mặc định về time zone của Hồ Chí Minh)
    smartParseTimeOfMonthByYearAndMonth({ year_no, month_no }) {
        try {
            if (!Number.isInteger(year_no) || year_no < 1970) {
                throw "Dữ liệu năm không hợp lệ";
            } else if (!Number.isInteger(month_no) || month_no > 12 || month_no < 1) { // kiểu hiển thị
                throw "Dữ liệu tháng không hợp lệ";
            } else {
                // Tạo sẵn 1 ngày theo múi giờ Việt Nam
                let default_date = this.parseUtcDateToTimeZone({ value: new Date() })
                let tzdate = set(default_date, {
                    year: year_no,
                    month: month_no - 1, // trừ 1 vì tháng (0 đến 11)
                    date: 9 // date = 9 (play a trick)
                })
                let startMonth = startOfMonth(tzdate) // datetime bắt đầu của tháng
                let endMonth = endOfMonth(tzdate) // datetime kết thúc của tháng
                return { startMonth, endMonth }
            }
        } catch (error) {
            throw error;
        }
    }

    // Kiểm tra dữ liệu đầu vào có phải là List<ObjectID>
    isListObjectID(name, value) {
        try {
            if (!Array.isArray(value) || value.length === 0) {
                throw `Thiếu ${name}`;
            } else {
                for (let i of value) {
                    if (!this.isObjectID(i)) { throw `${name} không hợp lệ`; }
                }
            }
        } catch (error) {
            throw error;
        }
    }

    // Tạo reuse hàm để dùng trong catch()
    responseWithCatch(error, message, data) {
        if (error.hasOwnProperty("statusCode") && error.hasOwnProperty("statusMessage")) {
            return error;
        } else {
            return this.responseWithCode(1, message, data)
        }
    }
}

module.exports = BaseModel;