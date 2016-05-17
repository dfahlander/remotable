var _Promise = typeof Promise !== 'undefined' && Promise;

export default _Promise;

export function setPromise(p) {
    _Promise = p;
}
