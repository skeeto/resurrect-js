/**
 *   Resurrect will decorate serialized objects with a few additional
 * properties.
 *
 * Caveats:
 *
 *   All constructors must be named and stored in the global variable
 * under than name.
 *
 *   The wrapper objects Boolean, String, and Number will be
 * unwrapped. This means extra properties added to these objects will
 * not be preserved.
 */

/**
 * @namespace
 * @constructor
 */
function Resurrect() {
}

/* Error Objects */

/**
 * @constructor
 */
Resurrect.Error = function ResurrectError(message) {
    this.message = message || '';
    this.stack = new Error().stack;
};
Resurrect.Error.prototype = Object.create(Error.prototype);
Resurrect.Error.prototype.name = 'ResurrectError';

/* Type Tests */

Resurrect.isArray = function(object) {
    return Object.prototype.toString.call(object) === '[object Array]';
};

Resurrect.isString = function(object) {
    return Object.prototype.toString.call(object) === '[object String]';
};

Resurrect.isBoolean = function(object) {
    return Object.prototype.toString.call(object) === '[object Boolean]';
};

Resurrect.isNumber = function(object) {
    return Object.prototype.toString.call(object) === '[object Number]';
};

Resurrect.isFunction = function(object) {
    return Object.prototype.toString.call(object) === "[object Function]";
};

Resurrect.isObject = function(object) {
    return object !== null && object !== undefined &&
        !Resurrect.isArray(object) && !Resurrect.isBoolean(object) &&
        !Resurrect.isString(object) && !Resurrect.isNumber(object) &&
        !Resurrect.isFunction(object);
};

Resurrect.prototype.decorate = function(object) {
    if (object === null) {
        return null;
    } else if (object === undefined) {
        return undefined;
    } else if (Resurrect.isString(object)) {
        return String(object);
    } else if (Resurrect.isNumber(object)) {
        return Number(object);
    } else if (Resurrect.isBoolean(object)) {
        return Boolean(object);
    } else if (Resurrect.isArray(object)) {
        for (var i = 0; i < object.length; i++) {
            object[i] = this.decorate(object[i]);
        }
        return object;
    } else if (Resurrect.isFunction(object)) {
        throw new this.Error("Can't serialize functions.");
    } else {
        if (!('#' in object)) {
            var constructor = object.constructor.name;
            if (constructor === '') {
                throw new this.Error("Can't serialize objects with " +
                                     "anonymous constructors.");
            } else if (constructor !== 'Object') {
                if (window[constructor].prototype !== object.__proto__) {
                    throw new this.Error('Constructor mismatch!');
                } else {
                    object['#'] = constructor;
                }
            }
        }
        for (var k in object) {
            if (object.hasOwnProperty(k)) {
                object[k] = this.decorate(object[k]);
            }
        }
        return object;
    }
};

Resurrect.prototype.fixPrototype = function(object) {
    var isObject = Resurrect.isObject(object);
    if (isObject && object['#']) {
        var constructor = window[object['#']];
        if (constructor) {
            object.__proto__ = constructor.prototype;
        } else {
            throw new this.Error('Unknown constructor ' + object['#']);
        }
    }
    if (isObject || Resurrect.isArray(object)) {
        for (var k in object) {
            if (object.hasOwnProperty(k)) {
                this.fixPrototype(object[k]);
            }
        }
    }
    return object;
};

Resurrect.prototype.stringify = function(object) {
    return JSON.stringify(this.decorate(object));
};

Resurrect.prototype.resurrect = function(string) {
    return this.fixPrototype(JSON.parse(string));
};
