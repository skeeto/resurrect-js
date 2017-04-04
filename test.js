var Resurrect = require('./resurrect.js')
function foo() {
  return 'hello'
}
var necromancer = new Resurrect();

// References to the same object are preserved:
var json = necromancer.stringify([foo, foo]);
var array = necromancer.resurrect(json);
console.log(array)
console.log(array[0]() === array[1]())

// Dates are restored properly
json = necromancer.stringify(new Date());
var date = necromancer.resurrect(json);
console.log(Object.prototype.toString.call(date));  // => "[object Date]"
