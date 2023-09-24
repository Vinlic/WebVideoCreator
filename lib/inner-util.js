export default () => ({

    assert(value, message) {
        if (value === true) return;
        throw (message instanceof Error ? message : new Error(message));
    },

    isObject(value) {
        return value instanceof Object;
    },

    isFunction(value) {
        return value instanceof Function;
    },

    isUint8Array(value) {
        return value instanceof Uint8Array;
    },

    isUndefined(value) {
        return value === undefined;
    },

    isNull(value) {
        return value === null;
    },

    isNil(value) {
        return this.isUndefined(value) || this.isNull(value);
    },

    isString(value) {
        return typeof value == "string";
    },

    isNumber(value) {
        return !isNaN(value);
    },

    isBoolean(value) {
        return value === true || value === false;
    },

    isError(value) {
        return value instanceof Error;
    },

    defaultTo(value, defaultValue) {
        if(this.isNil(value))
            return defaultValue;
        return value;
    }

});