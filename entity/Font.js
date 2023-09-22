import assert from "assert";
import _ from "lodash";

/**
 * 字体
 */
export default class Font {

    /** @type {string} - 字体来源 */
    src;
    /** @type {string} - 字体集名称 */
    family;
    /** @type {string} - 字体样式 */
    style;
    /** @type {number|string} - 字体粗细 */
    weight;
    /** @type {string} - 字体格式 */
    format;

    /**
     * 构造函数
     * 
     * @param {Object} options - 字体选项
     * @param {string} options.src - 字体来源
     * @param {string} options.family - 字体集名称
     * @param {string} options.format - 字体格式
     * @param {string} [options.style] - 字体样式
     * @param {number|string} [options.weight] - 字体粗细
     */
    constructor(options) {
        assert(_.isObject(options), "Font options must be Object");
        const { src, family, format, style, weight } = options;
        assert(_.isString(src), "Font src must be string");
        assert(_.isString(family), "Font family must be string");
        assert(_.isString(format), "Font format must be string");
        assert(_.isNil(style) || _.isString(style), "Font style must be string");
        assert(_.isNil(weight) || _.isFinite(weight) || _.isString(weight), "Font weight must be number or string");
        this.src = src;
        this.family = family;
        this.format = format;
        this.style = style;
        this.weight = parseInt(weight);
    }

    /**
     * 转换为字体声明
     * 
     * @returns {string} - 字体声明
     */
    toFontFace() {
        return  `@font-face{
            font-family:"${this.family}";
            ${this.style ? `font-style:${this.style};` : ""}
            ${this.weight ? `font-weight:${this.weight};` : ""}
            src:url(${this.src})format("${this.format}")}`;
    }

}