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
function Resurrect(options) {
    this.db = {'0': undefined};
    this.counter = 1;
    this.prefix = '#';
    for (var option in options) {
        if (options.hasOwnProperty(option)) {
            this[option] = options[option];
        }
    }
    if (!('refcode' in this)) {
        this.refcode = this.prefix + '@';
    }
}

/* Helper Objects */

/**
 * @constructor
 */
Resurrect.Ref = function Ref(resurrect, id) {
    this[resurrect.refcode] = id;
    this[resurrect.prefix] = resurrect.prefix;
};

Resurrect.Ref.prototype.deref = function(resurrect) {
    return resurrect.db[this[resurrect.refcode]];
};

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

/* Methods */

/**
 * @method
 */
Resurrect.prototype.makeId = function() {
    return (this.counter++).toString(36);
};

/**
 * Create a reference to an object.
 * @method
 */
Resurrect.prototype.ref = function(object) {
    if (object === undefined) {
        return new Resurrect.Ref(this, '0');
    } else {
        return new Resurrect.Ref(this, object[this.refcode]);;
    }
};

/**
 * @method
 */
Resurrect.prototype.deref = function(ref) {
    return this.db[ref[this.refcode]] || 'unknown';
};

/**
 * Register an object in the database, returning a reference to the
 * object if already registered.
 * @method
 */
Resurrect.prototype.register = function(object) {
    if (!(this.refcode in object)) {
        object[this.refcode] = this.makeId();
    }
    var id = object[this.refcode];
    if (!(id in this.db)) {
        this.db[id] = object;
        for (var k in object) {
            if (object.hasOwnProperty(k) && Resurrect.isObject(object[k])) {
                this.register(object[k]);
            }
        }
        if (Resurrect.isArray(object)) {
            var wrap = {};
            wrap[this.prefix] = object;
            wrap[this.refcode] = object[this.refcode];
            return wrap;
        } else {
            return object;
        }
    } else {
        return this.ref(object);
    }
};

/**
 * @method
 */
Resurrect.prototype.isRegistered = function(object) {
    return object[this.refcode] in this.db;
};

/**
 * @method
 */
Resurrect.prototype.decorate = function(object) {
    if (object === null) {
        return null;
    } else if (object === undefined) {
        return this.ref(undefined);
    } else if (Resurrect.isString(object)) {
        return String(object);
    } else if (Resurrect.isNumber(object)) {
        return Number(object);
    } else if (Resurrect.isBoolean(object)) {
        return Boolean(object);
    } else if (Resurrect.isFunction(object)) {
        throw new this.Error("Can't serialize functions.");
    } else if (Resurrect.isArray(object)) {
        if (this.isRegistered(object)) {
            return this.ref(object);
        } else {
            var wrapped = this.register(object);
            for (var i = 0; i < object.length; i++) {
                object[i] = this.decorate(object[i]);
            }
        }
        return wrapped;
    } else { /* This must be an object. */
        if (!(this.prefix in object)) {
            var constructor = object.constructor.name;
            if (constructor === '') {
                throw new this.Error("Can't serialize objects with " +
                                     "anonymous constructors.");
            } else if (constructor !== 'Object') {
                if (window[constructor].prototype !== object.__proto__) {
                    throw new this.Error('Constructor mismatch!');
                } else {
                    object[this.prefix] = constructor;
                }
            }
        }
        object = this.register(object);
        for (var k in object) {
            if (object.hasOwnProperty(k)) {
                object[k] = this.decorate(object[k]);
            }
        }
        return object;
    }
};

/**
 * @method
 */
Resurrect.prototype.fixup = function(object) {
    var isObject = Resurrect.isObject(object);
    if (isObject && object[this.prefix]) {
        var name = object[this.prefix];
        if (name === this.prefix) {             /* Reference */
            return this.deref(object);
        } else if (Resurrect.isArray(name)) {   /* Array */
            var id = object[this.refcode];
            object = name;
            object[this.refcode] = id;
        } else {                                /* Object */
            var constructor = window[name];
            if (constructor) {
                object.__proto__ = constructor.prototype;
            } else {
                throw new this.Error('Unknown constructor ' + name);
            }
        }
    }
    if (isObject || Resurrect.isArray(object)) {
        for (var k in object) {
            if (object.hasOwnProperty(k)) {
                object[k] = this.fixup(object[k]);
            }
        }
    }
    return object;
};

/**
 * @method
 */
Resurrect.prototype.stringify = function(object) {
    return JSON.stringify(this.decorate(object));
};

/**
 * @method
 */
Resurrect.prototype.resurrect = function(string) {
    return this.fixup(JSON.parse(string));
};
