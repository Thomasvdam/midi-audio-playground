const CODES = {
    GRID: [
        [[144, 0], [144, 1], [144, 2], [144, 3], [144, 4], [144, 5], [144, 6], [144, 7]],
        [[144, 16], [144, 17], [144, 18], [144, 19], [144, 20], [144, 21], [144, 22], [144, 23]],
        [[144, 32], [144, 33], [144, 34], [144, 35], [144, 36], [144, 37], [144, 38], [144, 39]],
        [[144, 48], [144, 49], [144, 50], [144, 51], [144, 52], [144, 53], [144, 54], [144, 55]],
        [[144, 64], [144, 65], [144, 66], [144, 67], [144, 68], [144, 69], [144, 70], [144, 71]],
        [[144, 80], [144, 81], [144, 82], [144, 83], [144, 84], [144, 85], [144, 86], [144, 87]],
        [[144, 96], [144, 97], [144, 98], [144, 99], [144, 100], [144, 101], [144, 102], [144, 103]],
        [[144, 112], [144, 113], [144, 114], [144, 115], [144, 116], [144, 117], [144, 118], [144, 119]],
    ],
    TOP_ROW: [[176, 104], [176, 105], [176, 106], [176, 107], [176, 108], [176, 109], [176, 110], [176, 111]],
    RIGHT_COLUMN: [[144, 8], [144, 24], [144, 40], [144, 56], [144, 72], [144, 88], [144, 104], [144, 120]],
};

const constants = {
    BRIGHTNESS: {
        DIM: 17,
        MEDIUM: 34,
        BRIGHT: 51,
    },
    COLOURS: {
        OFF: 0,
        RED: 3,
        GREEN: 48,
        ORANGE: 51,
    },
    EVENTS: {
        ALL: '*',
        GRID: 'grid',
        TOP: 'top',
        RIGHT: 'right',
    },
};

class LaunchPadButtonEvent {
    constructor(data) {
        this.eventType = null;

        this.isGrid = false;
        this.isTopRow = false;
        this.isRightColumn = false;

        this.x = -1;
        this.y = -1;

        const buttonLocation = [data[0] & 0xf0, data[1]]; // eslint-disable-line no-bitwise
        this.location = buttonLocation;

        if (buttonLocation[0] === 176) {
            // Top row buttons start with 176 and increment by 1 from 104.
            const index = buttonLocation[1] - 104;

            this.eventType = constants.EVENTS.TOP;
            this.x = index;
            this.isTopRow = true;
        } else if ((buttonLocation[1] & 8) === 8) { // eslint-disable-line no-bitwise
            // Only right column buttons have the 4th digit switched on.
            const index = Math.floor(buttonLocation[1] / 16);

            this.eventType = constants.EVENTS.RIGHT;
            this.y = index;
            this.isRightColumn = true;
        } else {
            let x;
            let y;

            CODES.GRID.forEach((column, currentY) => {
                column.forEach((button, currentX) => {
                    if (button[0] === buttonLocation[0] && button[1] === buttonLocation[1]) {
                        x = currentX;
                        y = currentY;
                    }
                });
            });

            this.eventType = constants.EVENTS.GRID;
            this.x = x;
            this.y = y;
            this.isGrid = true;
        }

        this.pressed = data[2] === 127; // Velocity 127 is keyDown, 0 is keyUp (but these are the only two used, hence the simple check).
    }
}

function toArray(midiMaps) {
    const array = [];

    midiMaps.forEach((midiMap) => { array.push(midiMap); });

    return array;
}

function createEmptyEventArrays() {
    return {
        [constants.EVENTS.ALL]: [],
        [constants.EVENTS.GRID]: [],
        [constants.EVENTS.TOP]: [],
        [constants.EVENTS.RIGHT]: [],
    };
}

class LaunchPadMini {
    constructor(midiAccess) {
        const allInputs = toArray(midiAccess.inputs);
        const allOutputs = toArray(midiAccess.outputs);

        const input = allInputs.find(midiInput => midiInput.name === 'Launchpad Mini');
        const output = allOutputs.find(midiInput => midiInput.name === 'Launchpad Mini');

        if (!input || !output) { throw new Error('No Launchpad Mini connected, please make sure it is a Launchpad Mini and is connected.'); }

        this.input = input;
        this.output = output;

        this.input.onmidimessage = this.onMidiMessage.bind(this);

        this.eventListeners = createEmptyEventArrays();
    }

    onMidiMessage(event) {
        const buttonEvent = new LaunchPadButtonEvent(event.data);

        const handleBucket = this.eventListeners[buttonEvent.eventType];

        handleBucket.forEach(handle => handle(buttonEvent));
        this.eventListeners[LaunchPadMini.constants.EVENTS.ALL].forEach(handle => handle(buttonEvent));
    }

    pulseButton(location, colour, duration, opts = {}) {
        this.setButtonColour(location, colour, opts);

        const nextColour = opts.nextColour || LaunchPadMini.constants.COLOURS.OFF;
        // Replace passed delay with the extended delay for the toggle.
        const nextOpts = Object.assign({}, opts, {
            delay: duration + (opts.delay || 0),
            brightness: opts.nextBrightness || opts.brightness,
        });

        this.setButtonColour(location, nextColour, nextOpts);
    }

    setButtonColour(location, colour, opts = {}) {
        const colourVal = opts.brightness ? colour & opts.brightness : colour; // eslint-disable-line no-bitwise

        const message = location.concat(colourVal);
        this.output.send(message, performance.now() + (opts.delay || 0));
    }

    clearButton(location, delay) {
        const message = location.concat(LaunchPadMini.constants.COLOURS.OFF);
        this.output.send(message, delay ? performance.now() + delay : 0);
    }

    resetGrid() {
        CODES.GRID.forEach((row) => {
            row.forEach((code) => {
                this.clearButton(code);
            });
        });
    }

    resetTop() {
        CODES.TOP_ROW.forEach((code) => {
            this.clearButton(code);
        });
    }

    addEventListener(eventName, handle) {
        const handleBucket = this.eventListeners[eventName];

        if (!Array.isArray(handleBucket)) {
            throw new Error('Unsupported event, please use the presets.');
        }

        handleBucket.push(handle);
    }

    removeEventListener(eventName, handle) {
        const handleBucket = this.eventListeners[eventName];

        if (!Array.isArray(handleBucket)) {
            throw new Error('Unsupported event, please use the presets.');
        }

        this.eventListeners[eventName] = handleBucket.filter(existingHandle => existingHandle !== handle);
    }

    removeAllEventListeners() {
        this.eventListeners = createEmptyEventArrays();
    }

    static get constants() {
        return constants;
    }

    static get buttons() {
        return CODES;
    }
}

export default LaunchPadMini;
