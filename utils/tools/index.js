const axios = require('axios');
const { payloadAESPass } = require('../../config');
const CryptoJS = require('crypto-js');
const TIMEOUT = 10000;
const METHOD = 'POST';

class PayloadContext {
    constructor(data) {
        Object.assign(this, data);
        return new Proxy(this, {
            get: (target, prop) => target[prop],
            set: (target, prop, value) => {
                if (prop === 'user_id' && target[prop]) throw new Error('attribute user_id can not set again');
                if (prop === 'token' && target[prop]) throw new Error('attribute token can not set again');
                if (prop === 'company_id' && target[prop]) throw new Error('attribute company_id can not set again');
                if (prop === 'cid' && target[prop]) throw new Error('attribute cid can not set again');
                if (prop === 'uid' && target[prop]) throw new Error('attribute uid can not set again');
                target[`${prop}`] = value;
            }
        });
    }
}

function encryptPayload(payload) {
    return CryptoJS.AES.encrypt(JSON.stringify(payload), payloadAESPass).toString();
}

function plugElementIntoAttribute({ from, to, fromKey, toKey }) {
    try {
        if (!Array.isArray(from) || !Array.isArray(to)) {
            throw new Error('Cả hai không phải là array');
        }
        let objectFrom = {}
        from.forEach(e => {
            if (e[fromKey]) {
                objectFrom[e[fromKey]] = e;
            }
        })
        return to.map(t => {
            if (!t[toKey]) {
                return t;
            }
            return {
                ...t,
                [toKey]: objectFrom[t[toKey]] ? objectFrom[t[toKey]] : t[toKey]
            }
        })
    } catch (error) {
        throw error.stack;
    }
}

function niceRequest(payload) {
    return Promise.all([]).then(res => {
        const { token, api } = payload;
        if (!token || !api) {
            throw { statusCode: 1, statusMessage: '[niceRequest] Thiếu token hoặc api' }
        }
        return axios({
            method: payload.method ? payload.method : METHOD,
            url: `${api}`,
            timeout: payload.timeout ? payload.timeout : TIMEOUT,
            headers: { "Authorization": `Tomaho ${token}`, },
            data: { payload: encryptPayload(payload.payload ? payload.payload : {}) }
        })
    }).then(res => {
        if (res.data) {
            let data = res.data;
            if (data.statusCode) {
                throw data;
            } else if (data.statusCode === 0) {
                return data;
            } else {
                throw { statusCode: 1, statusMessage: '[niceRequest] Sự cố khi không lấy được dữ liệu' }
            }
        } else {
            throw { statusCode: 1, statusMessage: '[niceRequest2] Sự cố khi không lấy được dữ liệu' }
        }
    }).catch(error => {
        if (error.statusCode && error.statusMessage) {
            return error;
        } else {
            return { statusCode: 1, statusMessage: error.toString() }
        }
    })
}

module.exports = {
    PayloadContext,
    encryptPayload,
    plugElementIntoAttribute,
    niceRequest
}