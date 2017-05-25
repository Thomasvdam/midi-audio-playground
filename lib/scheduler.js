export default class Scheduler {
    constructor(context = new AudioContext(), opts = {}) {
        this.context = context;
        this.interval = opts.interval || 0.025;
        this.aheadTime = opts.aheadTime || 0.1;

        this._intervalId = null;
        this._scheduleId = 0;
        this._schedule = [];
    }

    get running() {
        return !!this._intervalId;
    }

    get currentTime() {
        return this.context.currentTime;
    }

    get schedule() {
        return this._schedule.slice();
    }

    start(callback, ...args) {
        if (!this._intervalId) {
            this._intervalId = window.setInterval(this.processTick.bind(this), this.interval * 1000);

            if (callback) {
                this.on(this.currentTime, callback, args);
            }
        } else if (callback) {
            this.on(this.currentTime, callback, args);
        }

        return this;
    }

    stop(reset = true) {
        if (this._intervalId) {
            window.clearInterval(this._intervalId);
            this._intervalId = null;
        }

        if (reset) { this.reset(); }

        return this;
    }

    reset() {
        this._schedule.splice(0);

        return this;
    }

    on(time, callback, ...args) {
        const id = this._scheduleId;
        this._scheduleId += 1;

        const event = { id, time, callback, args };

        if (!this._schedule.length || this._schedule[this._schedule.length - 1].time <= time) {
            this._schedule.push(event);
        } else {
            for (let i = 0; i < this._schedule.length; i += 1) {
                if (this._schedule[i].time >= time) {
                    this._schedule.splice(i, 0, event);
                    break;
                }
            }
        }

        return id;
    }

    off(id) {
        if (!Number.isInteger(id)) { return false; }

        for (let i = 0; i < this._schedule.length; i += 1) {
            if (this._schedule[i].id === id) {
                this._schedule.splice(i, 1);
                break;
            }
        }

        return id;
    }

    processTick() {
        const targetTime = this.currentTime + this.aheadTime;

        while (this._schedule.length && this._schedule[0].time < targetTime) {
            const event = this._schedule.shift();
            event.callback(event.time, ...event.args);
        }
    }
}
