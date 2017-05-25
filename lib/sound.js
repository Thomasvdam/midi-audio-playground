export default class Sound {
    constructor(context, path) {
        this.buffer = null;
        this.path = path;
        this.context = context;

        fetch(path).then(res => res.arrayBuffer())
            .then((arrayBuffer) => {
                this.context.decodeAudioData(arrayBuffer, (buffer) => {
                    this.buffer = buffer;
                }, (err) => {
                    console.error(err);
                });
            });
    }

    play(time, gain, playbackRate) {
        const gainNode = this.context.createGain();
        gainNode.gain.value = gain;

        const playSound = this.context.createBufferSource();
        playSound.detune.value = playbackRate;
        playSound.buffer = this.buffer;
        playSound.connect(gainNode);

        gainNode.connect(this.context.destination);
        playSound.start(time);
    }
}
