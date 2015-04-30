# ResurrectJS

ResurrectJS preserves object behavior (prototypes) and reference
circularity with a special JSON encoding. Unlike flat JSON, it can
also properly resurrect these types of values:

 * Date
 * RegExp
 * DOM objects
 * `undefined`
 * NaN, Infinity, -Infinity

Supported Browsers:

 * Chrome
 * Firefox
 * Safari
 * Opera
 * IE9+

Read about [how it works](http://nullprogram.com/blog/2013/03/28/).

## Examples

```javascript
function Foo() {}
Foo.prototype.greet = function() { return "hello"; };

// Behavior is preserved:
var necromancer = new Resurrect();
var json = necromancer.stringify(new Foo());
var foo = necromancer.resurrect(json);
foo.greet();  // => "hello"

// References to the same object are preserved:
json = necromancer.stringify([foo, foo]);
var array = necromancer.resurrect(json);
array[0] === array[1];  // => true
array[1].greet();  // => "hello"

// Dates are restored properly
json = necromancer.stringify(new Date());
var date = necromancer.resurrect(json);
Object.prototype.toString.call(date);  // => "[object Date]"
```

## Options

Options are provided to the constructor as an object with these
properties:

 * *prefix* (`"#"`): A prefix string used for temporary properties added
     to objects during serialization and deserialization. It is
     important that you don't use any properties beginning with this
     string. This option must be consistent between both serialization
     and deserialization.

 * *cleanup* (`false`): Perform full property cleanup after both
     serialization and deserialization using the `delete` operator.
     This may cause performance penalties (i.e. breaking hidden
     classes in V8) on objects that ResurrectJS touches, so enable
     with care.

 * *revive* (`true`): Restore behavior (`__proto__`) to objects that
     have been resurrected. If this is set to false during
     serialization, resurrection information will not be encoded. You
     still get circularity and Date support.

 * *resolver* (Resurrect.NamespaceResolver): Converts between a name
     and a prototype. Create a custom resolver if your constructors
     are not stored in global variables. The resolver has two methods:
     getName(object) and getPrototype(string).

For example,

```javascript
var necromancer = new Resurrect({
    prefix: '__#',
    cleanup: true
});
```

## Methods

Only two methods are significant when using ResurrectJS.

 * `.stringify(object[, replacer[, space]])`: Serializes an arbitrary
     object or value into a string. The `replacer` and `space`
     arguments are the same as [JSON.stringify][json-mdn], being
     passed through to this method. Note that the replacer will *not*
     be called for ResurrectJS's intrusive keys.

 * `.resurrect(string)`: Deserializes an object stored in a string by
     a previous call to `.stringify()`. Circularity and, optionally,
     behavior (prototype chain) will be restored.

## Restrictions

With the default resolver, all constructors must be named and stored
in the global variable under that name. This is required so that the
prototypes can be looked up and reconnected at resurrection time.

The wrapper objects Boolean, String, and Number will be
unwrapped. This means extra properties added to these objects will not
be preserved.

Functions cannot ever be serialized. Resurrect will throw an error if
a function is found when traversing a data structure.

### Custom Resolvers

There is a caveat with the provided resolver, NamespaceResolver: all
constructors *must* be explicitly named when defined. For example, see
the Foo constructor in this example,

~~~javascript
var namespace = {};
namespace.Foo = function Foo() {
    this.bar = true;
};
var necromancer = new Resurrect({
    resolver: new Resurrect.NamespaceResolver(namespace)
});
~~~

The constructor been assigned to the Foo property *and* the function
itself has been given a matching name. This is how the resolver will
find the name of the constructor in the namespace when given the
constructor. Keep in mind that using this form will bind the variable
Foo to the surrounding function within the body of Foo.

## See Also

* [HydrateJS](https://github.com/nanodeath/HydrateJS)


[json-mdn]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify
