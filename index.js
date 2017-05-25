import LaunchPadMini from './lib/launchpad-mini';
import Sound from './lib/sound';
import Scheduler from './lib/scheduler';

window.proto = LaunchPadMini;

const MIN_LINES = 1;
const MAX_LINES = 8;
const BEATS_PER_LINE = 8;

const audioContext = new AudioContext();

function createEmptyPattern() {
    const arr = [];
    for (let i = 0; i < (MAX_LINES * BEATS_PER_LINE); i += 1) {
        arr.push(false);
    }

    return arr;
}

const state = {
    activeLines: 1,
    currentBeat: 0,
    nextBeatTime: 0,
    playing: false,
    resetTimeout: false,
    tempo: 120,
    activeSound: 0,
    sounds: [
        {
            name: 'kick',
            sound: new Sound(audioContext, 'sounds/kick.wav'),
            pattern: createEmptyPattern(),
        },
        {
            name: 'clap',
            sound: new Sound(audioContext, 'sounds/clap.wav'),
            pattern: createEmptyPattern(),
        },
        {
            name: 'closed',
            sound: new Sound(audioContext, 'sounds/closed.wav'),
            pattern: createEmptyPattern(),
        },
        {
            name: 'crash',
            sound: new Sound(audioContext, 'sounds/crash.wav'),
            pattern: createEmptyPattern(),
        },
        {
            name: 'shake',
            sound: new Sound(audioContext, 'sounds/shake.wav'),
            pattern: createEmptyPattern(),
        },
        {
            name: 'snare',
            sound: new Sound(audioContext, 'sounds/snare.wav'),
            pattern: createEmptyPattern(),
        },
        {
            name: 'rim',
            sound: new Sound(audioContext, 'sounds/rim.wav'),
            pattern: createEmptyPattern(),
        },
        {
            name: 'open',
            sound: new Sound(audioContext, 'sounds/open.wav'),
            pattern: createEmptyPattern(),
        },
    ],
};

window.state = state;

// midi functions
function onMIDISuccess(midiAccess) {
    const controller = new LaunchPadMini(midiAccess);
    const scheduler = new Scheduler(audioContext);

    window.test = controller;

    controller.resetGrid();

    // Control the grid pads.
    controller.addEventListener(LaunchPadMini.constants.EVENTS.ALL, (e) => {
        if (!e.pressed || !e.isGrid) { return; }

        const beatIndex = e.x + (BEATS_PER_LINE * e.y);

        if (state.sounds[state.activeSound].pattern[beatIndex]) {
            controller.clearButton(LaunchPadMini.buttons.GRID[e.y][e.x]);
            state.sounds[state.activeSound].pattern[beatIndex] = false;
        } else {
            const brightness = (beatIndex >= state.activeLines * BEATS_PER_LINE) ? LaunchPadMini.constants.BRIGHTNESS.DIM : LaunchPadMini.constants.BRIGHTNESS.BRIGHT;

            controller.setButtonColour(LaunchPadMini.buttons.GRID[e.y][e.x], LaunchPadMini.constants.COLOURS.ORANGE, { brightness });
            state.sounds[state.activeSound].pattern[beatIndex] = true;
        }
    });

    function drawSoundPattern() {
        controller.resetGrid();

        state.sounds[state.activeSound].pattern.forEach((on, index) => {
            if (on) {
                const row = Math.floor(index / 8);
                const column = index % 8;

                const brightness = (index >= state.activeLines * BEATS_PER_LINE) ? LaunchPadMini.constants.BRIGHTNESS.DIM : LaunchPadMini.constants.BRIGHTNESS.BRIGHT;

                controller.setButtonColour(LaunchPadMini.buttons.GRID[row][column], LaunchPadMini.constants.COLOURS.ORANGE, { brightness });
            }
        });

        // Hack to get playback indicator back in place.
        if (!state.playing) { pause(); }
    }

    // Control the amount of bars.
    function updateLineSelectors() {
        controller.setButtonColour(LaunchPadMini.buttons.RIGHT_COLUMN[0], LaunchPadMini.constants.COLOURS.GREEN);
        controller.setButtonColour(LaunchPadMini.buttons.RIGHT_COLUMN[1], LaunchPadMini.constants.COLOURS.GREEN);

        if (state.activeLines === MIN_LINES) {
            controller.setButtonColour(LaunchPadMini.buttons.RIGHT_COLUMN[0], LaunchPadMini.constants.COLOURS.RED);
        } else if (state.activeLines === MAX_LINES) {
            controller.setButtonColour(LaunchPadMini.buttons.RIGHT_COLUMN[1], LaunchPadMini.constants.COLOURS.RED);
        }
    }

    controller.addEventListener(LaunchPadMini.constants.EVENTS.RIGHT, (e) => {
        if (!e.pressed) { return; }

        // This event handler is just for selecting the bumber of bars.
        if (e.y > 1) { return; }

        if (e.y === 0) {
            if (state.activeLines > MIN_LINES) {
                state.activeLines -= 1;
            }
        } else if (state.activeLines < MAX_LINES) {
            state.activeLines += 1;
        }

        updateLineSelectors();
        drawSoundPattern();

        const nextColour = (state.activeLines - 1) === state.activeSound ? LaunchPadMini.constants.COLOURS.GREEN : LaunchPadMini.constants.COLOURS.OFF;
        controller.pulseButton(LaunchPadMini.buttons.TOP_ROW[state.activeLines - 1], LaunchPadMini.constants.COLOURS.ORANGE, 100, { nextColour });
    });


    // Control sound selection.
    function drawActiveSound() {
        controller.resetTop();
        controller.setButtonColour(LaunchPadMini.buttons.TOP_ROW[state.activeSound], LaunchPadMini.constants.COLOURS.GREEN);
    }

    controller.addEventListener(LaunchPadMini.constants.EVENTS.TOP, (e) => {
        if (!e.pressed) { return; }

        if (e.x === state.activeSound) { return; }

        state.activeSound = e.x;
        drawActiveSound();
        drawSoundPattern();
    });

    // set initial state
    drawActiveSound();
    updateLineSelectors();

    // Playback functions.
    function pulse() {
        const beatDuration = (60 / state.tempo) * 0.25;

        let playingSound = false;

        state.sounds.forEach((sound, index) => {
            if (sound.pattern[state.currentBeat]) {
                scheduler.on(state.nextBeatTime, sound.sound.play.bind(sound.sound), 1, 1);

                if (state.activeSound === index) {
                    playingSound = true;
                } else {
                    controller.pulseButton(LaunchPadMini.buttons.TOP_ROW[index], LaunchPadMini.constants.COLOURS.GREEN, beatDuration * 1000);
                }
            }
        });

        const row = Math.floor(state.currentBeat / 8);
        const column = state.currentBeat % 8;
        const colourToPulse = playingSound ? LaunchPadMini.constants.COLOURS.GREEN : LaunchPadMini.constants.COLOURS.RED;
        const nextColour = playingSound ? LaunchPadMini.constants.COLOURS.ORANGE : LaunchPadMini.constants.COLOURS.OFF;
        const nextBrightness = (state.currentBeat >= state.activeLines * BEATS_PER_LINE) ? LaunchPadMini.constants.BRIGHTNESS.DIM : LaunchPadMini.constants.BRIGHTNESS.BRIGHT;

        controller.pulseButton(LaunchPadMini.buttons.GRID[row][column], colourToPulse, beatDuration * 1000, { nextColour, nextBrightness });

        state.currentBeat += 1;
        if (state.currentBeat >= state.activeLines * BEATS_PER_LINE && state.currentBeat % 8 === 0) { state.currentBeat = 0; }
        state.nextBeatTime += beatDuration;

        scheduler.on(state.nextBeatTime, pulse);
    }

    function play() {
        state.nextBeatTime = audioContext.currentTime;
        scheduler.start(pulse);
    }

    function pause() {
        scheduler.stop();

        const row = Math.floor(state.currentBeat / 8);
        const column = state.currentBeat % 8;

        controller.setButtonColour(LaunchPadMini.buttons.GRID[row][column], LaunchPadMini.constants.COLOURS.RED, { brightness: LaunchPadMini.constants.BRIGHTNESS.DIM });
    }

    controller.addEventListener(LaunchPadMini.constants.EVENTS.RIGHT, (e) => {
        if (e.y !== 7) { return; }

        // Releasing the key stops the reset timer.
        if (!e.pressed) {
            clearTimeout(state.resetTimeout);
            return;
        }

        if (state.playing) {
            pause();
            state.playing = false;
            controller.setButtonColour(e.location, LaunchPadMini.constants.COLOURS.RED);

            // Holding the button long enough reset the play position.
            state.resetTimeout = setTimeout(() => {
                state.currentBeat = 0;
                drawSoundPattern();
            }, 1500);
        } else {
            play();
            state.playing = true;
            controller.setButtonColour(e.location, LaunchPadMini.constants.COLOURS.GREEN);
        }
    });

    controller.addEventListener(LaunchPadMini.constants.EVENTS.RIGHT, (e) => {
        if (e.y !== 5 && e.y !== 6) { return; }

        if (!e.pressed) { return; }

        if (e.y === 5) {
            state.tempo += 1;
        } else {
            state.tempo -= 1;
        }

        document.querySelector('#tempo').textContent = state.tempo.toString();
    });
}

function onMIDIFailure(e) {
    console.error('No access to MIDI devices or your browser doesn\'t support WebMIDI API. Please use WebMIDIAPIShim.', e);
}

// request MIDI access
if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess({
        sysex: false,
    }).then(onMIDISuccess, onMIDIFailure);
} else {
    alert('No MIDI support in your browser.');
}
