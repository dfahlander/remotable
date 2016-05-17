import Typeson from '../lib/typeson/';

var putte = {name: "Putte", age: 77};
var orig ={hej: {ho: putte}, aj: putte};
//orig.oj = orig;
console.log(orig);
var tson = Typeson.stringify(orig, null, 4);
console.log(tson);
var back = Typeson.parse(tson);
console.log(back);
