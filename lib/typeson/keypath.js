var _hasOwn = {}.hasOwnProperty;

export function getByKeyPath (obj, keyPath) {
    if (!keyPath) {
        return obj;
    }
    var period = keyPath.indexOf('.');
    if (period !== -1) {
        var innerObj = obj[keyPath.substr(0, period)];
        return innerObj === undefined ? undefined : getByKeyPath(innerObj, keyPath.substr(period + 1));
    }
    if (_hasOwn.call(obj, keyPath)) return obj[keyPath];
}
