import assert from "assert";
import _ from "lodash";

import { TRANSITION } from "./const.js";

const TRANSITION_IDS = Object.values(TRANSITION);

export default class Transition {

    /** @type {string} - 转场ID */
    id;
    /** @type {number} - 转场时长 */
    duration;

    /**
     * 构造函数
     * 
     * @param {Object} options - 转场选项
     * @param {string} options.id - 转场ID
     * @param {number} [options.duration=500] - 转场时长（毫秒）
     */
    constructor(options) {
        assert(_.isObject(options), "Transition options must be Object");
        const { id, duration } = options;
        assert(_.isString(id), "Transition id must be string");
        assert(TRANSITION_IDS.includes(id), `Transition id ${id} may not be supported, please refer to http://trac.ffmpeg.org/wiki/Xfade`);
        assert(_.isUndefined(duration) || _.isNumber(duration), "Transition duration must be number");
        this.id = id;
        this.duration = _.defaultTo(duration, 500);
    }

}