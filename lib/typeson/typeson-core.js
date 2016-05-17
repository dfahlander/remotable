import traverse from './traverse';
import {getByKeyPath} from './keypath';

export default function TypesonCore () {
    // Replacers signature: replace (value). Returns falsy if not replacing. Otherwise ["Date", value.getTime()]
    var replacers = [];
    // Revivers: map {type => reviver}. Sample: {"Date": value => new Date(value)}
    var revivers = {};
    
    this.stringify = function (obj, replacer, space) {
        return JSON.stringify (encapsulate(obj), replacer, space);
    }
    
    this.parse = function (text, reviver) {
        return revive (JSON.parse (text, reviver));
    }

    var encapsulate = this.encapsulate = function (obj) {
        var types = {},
            refObjs = [],
            refKeys = [];
        var ret = traverse (obj, (key, value, $typeof) => {
            // Resolve cyclic references
            if ($typeof === 'object' && obj) {
                var refIndex = refObjs.indexOf(value);
                if (refIndex < 0) {
                    refObjs.push(value);
                    refKeys.push(key);
                } else {
                    types[key] = "#";
                    return '#'+refKeys[refIndex];
                }
            }
            // Encapsulate registered types
            var i = replacers.length,
                typeIdentifyer = [];
            while (i--) {
                var replacement = replacers[i](value);
                if (replacement) {
                    typeIdentifyer.push(replacement[0]); // replacement[0] = Type Identifyer
                    value = replacement[1];
                }
            }
            if (typeIdentifyer.length)
                types[key] = typeIdentifyer.length > 1 ? typeIdentifyer : typeIdentifyer[0]; 
            return value;
        }, '');
        if (Object.keys(types).length)
            ret.$types = types;
        return ret;
    };

    var revive = this.revive = function (obj) {
        var types = obj.$types;
        if (!types) return obj; // No type info added. Already revived.
        return traverse (obj, (key, value, $typeof, target) => {
            if (key === '$types') return; // return undefined to tell traverse to ignore it.
            var typeIdentifyer = types[key];
            if (!typeIdentifyer) return value;
            if (typeIdentifyer === '#')
                // Revive cyclic referenced object
                return getByKeyPath(target, value.substr(1)); // 1 === "#".length; 
                
            if (typeof typeIdentifyer === 'string') typeIdentifyer = [typeIdentifyer];
            var i = typeIdentifyer.length; // Unless 'ref', TypeIdentifyer is an array of type identifiers
            while (i--) {
                var type = typeIdentifyer[i];
                var reviver = revivers[type];
                if (!reviver) throw new Error ("Unregistered Type: " + type);
                value = reviver(value);
            }
            return value;
        }, '');
    };
    
    this.register = function (typeSpec) {
        Object.keys(typeSpec).forEach(typeIdentifyer => {
            var spec = typeSpec[typeIdentifyer],
                test = spec[0],
                replace = spec[1],
                revive = spec[2],
                existingReviver = revivers[typeSpec];
            if (existingReviver) {
                if (existingReviver.toString() !== revive.toString())
                    throw new Error ("Type " + typeIdentifyer + " is already registered with incompatible behaviour");
                // Ignore re-registration if identical
                return;
            }
            function replacer (value) {
                return test(value) && [typeIdentifyer, replace(value)];
            }
            replacer.typeId = typeIdentifyer;
            replacers.push(replacer);
            revivers[typeIdentifyer] = revive;
        });
    }
}
