export default {
    // Make JSON incompatible number types serializable_
    "NaN": [
        x => typeof x === 'number' && isNaN(x),
        x => "NaN",
        x => NaN
    ],
    "Infinity": [
        x => x === Infinity,
        x => "Infinity",
        x => Infinity
    ],
    "-Infinity": [
        x => x === -Infinity,
        x => "-Infinity",
        x => -Infinity],
    
    // Date
    Date: [
        x => x instanceof Date,
        date => date.getTime(),
        time => new Date(time)
    ],
    
    RegExp: [
        x => x instanceof RegExp,
        rexp => ({source: rexp.source, flags: rexp.flags}),
        obj => new RegExp (obj.source, obj.flags)
    ],
    
    // TODO: Add more types here
        
    // Error
    Error: [
        x => x instanceof Error,
        error => ({name: error.name, message: error.message}),
        error => { var res = new Error (error.message); res.name = error.name; return error; }],
    
};
