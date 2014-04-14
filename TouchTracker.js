/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Owner: mark@famo.us
 * @license MPL 2.0
 * @copyright Famous Industries, Inc. 2014
 */

define(function(require, exports, module) {
    var LONG_PRESS_THRESHHOLD       = 1000;                          // min length of a "Long Press" in milliseconds
    var LONG_PRESS_DRAG_THRESHHOLD  = 5;                             // max initial allowed drag in X or Y plane in pixels to qualify as a "Long Press"
    var EventHandler = require('famous/core/EventHandler');

    function _timestampTouch(touch, origin, history, count, isTouchEnd) {
        var touchClone = {};
        for (var i in touch) touchClone[i] = touch[i];
        var now = Date.now();
        return {
            touch: touchClone,
            origin: origin,
            timestamp: now,
            count: count,
            history: history,
            longPress: _determineLongPress(touchClone, history, now, isTouchEnd)
        };
    }

    /**
     * Determine if touch began with a 'Long Press'
     * @param {Object} touch
     * @param {Array} history
     * @param {Number} now
     * @param {Boolean} isTouchEnd
     * @returns {String} Whether touch began with a 'Long Press'
     *   'unknown' -- press is not yet long enough to qualify for, and has not yet moved far enough to rule out, a long press
     *   'false' -- press has moved too far before the LONG_PRESS_THRESHHOLD to qualify as a long press
     *   'true' -- press has lasted longer than LONG_PRESS_THRESHHOLD without moving more than LONG_PRESS_DRAG_THRESHHOLD in X or Y
    */
    function _determineLongPress(touch, history, now, isTouchEnd) {
        var longPress = 'unknown';
        if (history && (history.length > 0)) {
            if (!history[history.length - 1].longPress || (history[history.length - 1].longPress === 'unknown')) {
                if (now - history[0].timestamp < LONG_PRESS_THRESHHOLD) {
                    if ((Math.abs(touch.clientX - history[0].touch.clientX) > LONG_PRESS_DRAG_THRESHHOLD) ||
                        (Math.abs(touch.clientY - history[0].touch.clientY) > LONG_PRESS_DRAG_THRESHHOLD)) {
                        longPress = 'false';
                    }
                } else {
                    if ((Math.abs(touch.clientX - history[0].touch.clientX) > LONG_PRESS_DRAG_THRESHHOLD) ||
                        (Math.abs(touch.clientY - history[0].touch.clientY) > LONG_PRESS_DRAG_THRESHHOLD)) {
                        longPress = 'false';
                    } else {
                        longPress = 'true';
                    }
                }
            } else {
                longPress = history[history.length - 1].longPress;          // retain existing 'longPress' state
            }
        }
        if (isTouchEnd && (longPress === 'unknown')) longPress = 'false';   // 'unknown' longPress with touchEnd event must be 'false'
        return longPress;
    }

    function _handleStart(event) {
        for (var i = 0; i < event.changedTouches.length; i++) {
            var touch = event.changedTouches[i];
            var data = _timestampTouch(touch, event.origin, undefined, event.touches.length, false);
            this.eventOutput.emit('trackstart', data);
            if (!this.selective && !this.touchHistory[touch.identifier]) this.track(data);
        }
    }

    function _handleMove(event) {
        for (var i = 0; i < event.changedTouches.length; i++) {
            var touch = event.changedTouches[i];
            var history = this.touchHistory[touch.identifier];
            if (history) {
                var data = _timestampTouch(touch, event.origin, history, event.touches.length, false);
                this.touchHistory[touch.identifier].push(data);
                this.eventOutput.emit('trackmove', data);
            }
        }
    }

    function _handleEnd(event) {
        for (var i = 0; i < event.changedTouches.length; i++) {
            var touch = event.changedTouches[i];
            var history = this.touchHistory[touch.identifier];
            if (history) {
                var data = _timestampTouch(touch, event.origin, history, event.touches.length, true);
                this.eventOutput.emit('trackend', data);
                delete this.touchHistory[touch.identifier];
            }
        }
    }

    function _handleUnpipe() {
        var now = Date.now();
        for (var i in this.touchHistory) {
            var history = this.touchHistory[i];
            this.eventOutput.emit('trackend', {
                touch: history[history.length - 1].touch,
                timestamp: now,
                count: 0,
                history: history,
                longPress: _determineLongPress(history[history.length - 1].touch, history, now, true)
            });
            delete this.touchHistory[i];
        }
    }

    /**
     * Helper to TouchSync – tracks piped in touch events, organizes touch
     *   events by ID, and emits track events back to TouchSync.
     *   Emits 'trackstart', 'trackmove', and 'trackend' events upstream.
     *
     * @class TouchTracker
     * @constructor
     * @param {Boolean} selective if false, save state for each touch.
     */
    function TouchTracker(selective) {
        this.selective = selective;
        this.touchHistory = {};
        this.eventInput = new EventHandler();
        this.eventOutput = new EventHandler();
        EventHandler.setInputHandler(this, this.eventInput);
        EventHandler.setOutputHandler(this, this.eventOutput);

        this.eventInput.on('touchstart', _handleStart.bind(this));
        this.eventInput.on('touchmove', _handleMove.bind(this));
        this.eventInput.on('touchend', _handleEnd.bind(this));
        this.eventInput.on('touchcancel', _handleEnd.bind(this));
        this.eventInput.on('unpipe', _handleUnpipe.bind(this));
    }

    /**
     * Record touch data, if selective is false.
     * @private
     * @method track
     * @param {Object} data touch data
     */
    TouchTracker.prototype.track = function track(data) {
        this.touchHistory[data.touch.identifier] = [data];
    };

    module.exports = TouchTracker;
});
