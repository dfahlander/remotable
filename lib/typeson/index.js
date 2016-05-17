import TypesonCore from './typeson-core';
import defaultTypes from './typeson-defaults';

export default function Typeson () {
    TypesonCore.call(this);
    this.register(defaultTypes);
}

// Let the singleton Typeson be Typeson itself
var defaultInstance = new Typeson();
Object.keys(defaultInstance).forEach(prop => {
    Typeson[prop] = defaultInstance[prop];
});
