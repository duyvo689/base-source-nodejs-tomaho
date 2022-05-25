const _ = require('lodash');
const Base = require('./base/models');
const Training = require('./training/models');

let Tomaho = {}
_.forEach(Base, (value, key) => { Tomaho[key] = value; })
_.forEach(Training, (value, key) => { Tomaho[key] = value; })
_.forEach(Tomaho, (obj, objName) => {
    if (typeof obj._buildIndexes === 'function') {
        obj._buildIndexes();
    }
})

module.exports = Tomaho;
