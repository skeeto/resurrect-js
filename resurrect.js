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
    this.table = null;
    this.prefix = '#';
    this.cleanup = false;
    for (var option in options) {
        if (options.hasOwnProperty(option)) {
            this[option] = options[option];
        }
    }
    this.refcode = this.prefix + 'id';
    this.origcode = this.prefix + 'original';
}

/* Helper Objects */

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

Resurrect.isAtom = function(object) {
    return object === null || object === undefined ||
        Resurrect.isBoolean(object) || Resurrect.isString(object) ||
        Resurrect.isNumber(object) || Resurrect.isFunction(object);
};

/* Methods */

/**
 * Create a reference to an object.
 * @method
 */
Resurrect.prototype.ref = function(object) {
    var ref = {};
    if (object === undefined) {
        ref[this.prefix] = -1;
    } else {
        ref[this.prefix] = object[this.refcode];
    }
    return ref;
};

/**
 * @method
 */
Resurrect.prototype.deref = function(ref) {
    return this.table[ref[this.prefix]];
};

Resurrect.prototype.tag = function(object) {
    var constructor = object.constructor.name;
    if (constructor === '') {
        throw new this.Error("Can't serialize with anonymous constructors.");
    } else if (constructor !== 'Object') {
        if (window[constructor].prototype !== Object.getPrototypeOf(object)) {
            throw new this.Error('Constructor mismatch!');
        } else {
            object[this.prefix] = constructor;
        }
    }
    object[this.refcode] = this.table.length;
    this.table.push(object);
    return object[this.refcode];
};

Resurrect.prototype.isTagged = function(object) {
    return (this.refcode in object) && (object[this.refcode] != null);
};

Resurrect.prototype.visit = function(root, f) {
    if (Resurrect.isAtom(root)) {
        return f(root);
    } else if (!this.isTagged(root)) {
        var copy = null;
        if (Resurrect.isArray(root)) {
            copy = [];
            root[this.refcode] = this.tag(copy);
            for (var i = 0; i < root.length; i++) {
                copy.push(this.visit(root[i], f));
            }
        } else { /* Object */
            copy = Object.create(Object.getPrototypeOf(root));
            root[this.refcode] = this.tag(copy);
            for (var key in root) {
                if (root.hasOwnProperty(key)) {
                    copy[key] = this.visit(root[key], f);
                }
            }
        }
        copy[this.origcode] = root;
        return this.ref(copy);
    } else {
        return this.ref(root);
    }
};

/**
 * @method
 */
Resurrect.prototype.stringify = function(object) {
    this.table = [];
    if (Resurrect.isAtom(object)) {
        this.table.push(object);
    } else {
        this.visit(object, function(atom) {
            if (Resurrect.isFunction(atom)) {
                throw new this.Error("Can't serialize functions.");
            } else if (atom === undefined) {
                return this.ref(undefined);
            } else {
                return atom;
            }
        }.bind(this));
        for (var i = 0; i < this.table.length; i++) {
            if (this.cleanup) {
                delete this.table[i][this.origcode][this.refcode];
            } else {
                this.table[i][this.origcode][this.refcode] = null;
            }
            delete this.table[i][this.refcode];
            delete this.table[i][this.origcode];
        }
    }
    var table = this.table;
    this.table = null;
    return JSON.stringify(table);
};

/**
 * @method
 */
Resurrect.prototype.resurrect = function(string) {
    this.table = JSON.parse(string);
    for (var i = 0; i < this.table.length; i++) {
        var object = this.table[i];
        if (!Resurrect.isAtom(object)) {
            for (var key in object) {
                if (object.hasOwnProperty(key)) {
                    if (!(Resurrect.isAtom(object[key]))) {
                        object[key] = this.deref(object[key]);
                    }
                }
            }
            if (this.prefix in object) {
                var name = object[this.prefix];
                var constructor = window[name];
                if (constructor) {
                    object.__proto__ = constructor.prototype;
                } else {
                    throw new this.Error('Unknown constructor: ' + name);
                }
                if (this.cleanup) {
                    delete object[this.prefix];
                }
            }
        }
    }
    var result = this.table[0];
    this.table = null;
    return result;
};
