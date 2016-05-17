export default function traverse (value, replacer, keypath, target) {
    var type = typeof value;
    var replaced = replacer (keypath, value, type, target);
    if (replaced !== value) return replaced;
    // Don't add edge cases for NaN, Infinity or -Infinity here. Do such things in a replacer callback instead.
    if (type in {'number':1, 'string':1, 'boolean':1, 'undefined':1}) return value;
    if (value === null) return null;
    var res = Array.isArray(value) ? new Array(value.length) : {};
    // Iterate object, function or array
    Object.keys(value).forEach(key => {
        var val = traverse(value[key], replacer, keypath + (keypath ? '.':'') + key, target || res);
        if (val !== undefined) res[key] = val; 
    });
    return res;
}
