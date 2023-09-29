/**
 * 内部工具包
 * 
 * 被用于浏览器环境内
 */
export default () => ({

    /**
     * 简易的断言
     * 
     * @param {any} value - 值
     * @param {string} message - 断言消息
     */
    assert(value, message) {
        if (value === true) return;
        throw (message instanceof Error ? message : new Error(message));
    },

    /**
     * 判断是否对象
     * 
     * @param {any} value - 值
     * @returns {boolean} - 是否对象
     */
    isObject(value) {
        return value instanceof Object;
    },

    /**
     * 判断是否函数
     * 
     * @param {any} value - 值
     * @returns {boolean} - 是否函数
     */
    isFunction(value) {
        return value instanceof Function;
    },

    /**
     * 判断是否Uint8Array
     * 
     * @param {any} value - 值
     * @returns {boolean} - 是否Unit8Array
     */
    isUint8Array(value) {
        return value instanceof Uint8Array;
    },

    /**
     * 判断是否未定义
     * 
     * @param {any} value - 值
     * @returns {boolean} - 是否未定义
     */
    isUndefined(value) {
        return value === undefined;
    },

    /**
     * 判断是否为null
     * 
     * @param {any} value - 值
     * @returns {boolean} - 是否为null
     */
    isNull(value) {
        return value === null;
    },

    /**
     * 判断是否未定义或为null
     * 
     * @param {any} value - 值
     * @returns {boolean} - 是否未定义或为null
     */
    isNil(value) {
        return this.isUndefined(value) || this.isNull(value);
    },

    /**
     * 是否为字符串值
     * 
     * @param {any} value - 值
     * @returns {boolean} - 是否字符串
     */
    isString(value) {
        return typeof value == "string";
    },

    /**
     * 判断是否数字值
     * 
     * @param {any} value - 值
     * @returns {boolean} - 是否数字
     */
    isNumber(value) {
        return !isNaN(value);
    },

    /**
     * 判断是否布尔值
     * 
     * @param {any} value - 值
     * @returns {boolean} - 是否布尔值
     */
    isBoolean(value) {
        return value === true || value === false;
    },

    /**
     * 判断是否错误对象
     * 
     * @param {any} value - 值
     * @returns {boolean} - 是否错误对象
     */
    isError(value) {
        return value instanceof Error;
    },

    /**
     * 默认值赋值
     * 
     * @param {any} value - 值
     * @param {any} defaultValue - 默认值
     * @returns {any} - 值
     */
    defaultTo(value, defaultValue) {
        if(this.isNil(value))
            return defaultValue;
        return value;
    }

});