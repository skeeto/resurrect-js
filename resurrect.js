/**
 *   Resurrect preserves object behavior (prototypes) and reference
 * circularity with a special JSON encoding. Date objects are also
 * properly preserved.
 *
 * ## Caveats
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
    this.revive = true;
    for (var option in options) {
        if (options.hasOwnProperty(option)) {
            this[option] = options[option];
        }
    }
    this.refcode = this.prefix + 'id';
    this.origcode = this.prefix + 'original';
    this.buildcode = this.prefix + '.';
    this.valuecode = this.prefix + 'v';
}

/* Helper Objects */

/**
 * @constructor
 */
Resurrect.prototype.Error = function ResurrectError(message) {
    this.message = message || '';
    this.stack = new Error().stack;
};
Resurrect.prototype.Error.prototype = Object.create(Error.prototype);
Resurrect.prototype.Error.prototype.name = 'ResurrectError';

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

Resurrect.isDate = function(object) {
    return Object.prototype.toString.call(object) === "[object Date]";
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
        Resurrect.isNumber(object) || Resurrect.isFunction(object) ||
        Resurrect.isDate(object);
};

/* Methods */

/**
 * Create a reference (encoding) to an object.
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
 * Lookup an object in the table by reference object.
 * @method
 */
Resurrect.prototype.deref = function(ref) {
    return this.table[ref[this.prefix]];
};

/**
 * Put a temporary identifier on an object and store it in the table.
 * @returns {number} The unique identifier number.
 * @method
 */
Resurrect.prototype.tag = function(object) {
    if (this.revive) {
        var constructor = object.constructor.name;
        if (constructor === '') {
            throw new this.Error("Can't serialize objects with anonymous " +
                                 "constructors.");
        } else if (constructor !== 'Object') {
            var proto = Object.getPrototypeOf(object);
            if (window[constructor].prototype !== proto) {
                throw new this.Error('Constructor mismatch!');
            } else {
                object[this.prefix] = constructor;
            }
        }
    }
    object[this.refcode] = this.table.length;
    this.table.push(object);
    return object[this.refcode];
};

/**
 * Create a builder object (encoding) for serialization.
 * @param {string} name The name of the constructor.
 * @param value The value to pass to the constructor.
 * @method
 */
Resurrect.prototype.builder = function(name, value) {
    var builder = {};
    builder[this.buildcode] = name;
    builder[this.valuecode] = value;
    return builder;
};

/**
 * Build a value from a deserialized builder.
 * @method
 */
Resurrect.prototype.build = function(ref) {
    var type = window[ref[this.buildcode]];
    return new type(ref[this.valuecode]);
};

/**
 * Dereference or build an object or value from an encoding.
 * @method
 */
Resurrect.prototype.decode = function(ref) {
    if (this.prefix in ref) {
        return this.deref(ref);
    } else if (this.buildcode in ref) {
        return this.build(ref);
    } else {
        throw new this.Error('Unknown encoding.');
    }
};

/**
 * @returns True if the provided object is already tagged for serialization.
 * @method
 */
Resurrect.prototype.isTagged = function(object) {
    return (this.refcode in object) && (object[this.refcode] != null);
};

/**
 * Visit root and all its ancestors, visiting atoms with f.
 * @param {Function} f
 * @returns A fresh copy of root to be serialized.
 * @method
 */
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
 * Manage special atom values, possibly returning an encoding.
 */
Resurrect.prototype.handleAtom = function(atom) {
    if (Resurrect.isFunction(atom)) {
        throw new this.Error("Can't serialize functions.");
    } else if (Resurrect.isDate(atom)) {
        return this.builder('Date', atom.toISOString());
    } else if (atom === undefined) {
        return this.ref(undefined);
    } else {
        return atom;
    }
};

/**
 * Serialize an arbitrary JavaScript object, carefully preserving it.
 * @method
 */
Resurrect.prototype.stringify = function(object) {
    if (Resurrect.isAtom(object)) {
        return JSON.stringify(this.handleAtom(object));
    } else {
        this.table = [];
        this.visit(object, this.handleAtom.bind(this));
        for (var i = 0; i < this.table.length; i++) {
            if (this.cleanup) {
                delete this.table[i][this.origcode][this.refcode];
            } else {
                this.table[i][this.origcode][this.refcode] = null;
            }
            delete this.table[i][this.refcode];
            delete this.table[i][this.origcode];
        }
        var table = this.table;
        this.table = null;
        return JSON.stringify(table);
    }
};

/**
 * Restore the __proto__ of the given object to the proper value.
 * @returns The object.
 */
Resurrect.prototype.fixPrototype = function(object) {
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
    return object;
};

/**
 * Deserialize an encoded object, restoring circularity and behavior.
 * @param {string} string
 * @returns The decoded object or value.
 * @method
 */
Resurrect.prototype.resurrect = function(string) {
    var result = null;
    var data = JSON.parse(string);
    if (Resurrect.isArray(data)) {
        this.table = data;
        for (var i = 0; i < this.table.length; i++) {
            var object = this.table[i];
            for (var key in object) {
                if (object.hasOwnProperty(key)) {
                    if (!(Resurrect.isAtom(object[key]))) {
                        object[key] = this.decode(object[key]);
                    }
                }
            }
            if (this.revive) {
                this.fixPrototype(object);
            }
        }
        result = this.table[0];
    } else if (Resurrect.isObject(data)) {
        this.table = [];
        result = this.decode(data);
    } else {
        result = data;
    }
    this.table = null;
    return result;
};
