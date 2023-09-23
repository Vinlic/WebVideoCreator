export class MP4FileSink {

    file;
    offset = 0;

    constructor(file) {
        this.file = file;
    }

    write(chunk) {
        const buffer = new ArrayBuffer(chunk.byteLength);
        new Uint8Array(buffer).set(chunk);
        buffer.fileStart = this.offset;
        this.offset += buffer.byteLength;
        this.file.appendBuffer(buffer);
    }

    close() {
        this.file.flush();
    }

}

const ____MP4FileSink = MP4FileSink;

export default class MP4Demuxer {

    url;
    file;
    _configCallback;
    _chunkCallback;

    constructor(url) {
        this.url = url;
        this.file = MP4Box.createFile();
        this.file.onReady = this._onReady.bind(this);
        this.file.onSamples = this._onSamples.bind(this);
    }

    onConfig(fn) {
        this._configCallback = fn;
    }

    onChunk(fn) {
        this._chunkCallback = fn;
    }

    onError(fn) {
        this.file.onError = fn;
    }

    async load() {
        const fileSink = new ____MP4FileSink(this.file);
        const response = await fetch(this.url);
        response.body.pipeTo(new WritableStream(fileSink, { highWaterMark: 2 }));
    }

    _onReady(info) {
        const track = info.videoTracks[0];
        const COMPLATIBLE_CODEC_MAP = {
            "avc1.64003c": "avc1.640033"
        };
        // 回调配置
        this._configCallback && this._configCallback({
            codec: track.codec.startsWith('vp08') ? 'vp8' : (COMPLATIBLE_CODEC_MAP[track.codec] || track.codec),
            codedWidth: track.video ? track.video.width : track.track_width,
            codedHeight: track.video ? track.video.height : track.track_height,
            description: this._getDescription(track),
            bitrate: track.bitrate,
            duration: (track.movie_duration / track.movie_timescale) * 1000
        });
        // 开始解复用
        this.file.setExtractionOptions(track.id);
        this.file.start();
    }

    _onSamples(track_id, ref, samples) {
        for (const sample of samples) {
            this._chunkCallback && this._chunkCallback(new EncodedVideoChunk({
                type: sample.is_sync ? "key" : "delta",
                timestamp: 1e6 * sample.cts / sample.timescale,
                duration: 1e6 * sample.duration / sample.timescale,
                data: sample.data
            }));
        }
    }

    _getDescription(track) {
        const trak = this.file.getTrackById(track.id);
        for (const entry of trak.mdia.minf.stbl.stsd.entries) {
            const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
            if (box) {
                const stream = new DataStream(undefined, 0, DataStream.BIG_ENDIAN);
                box.write(stream);
                return new Uint8Array(stream.buffer, 8);
            }
        }
        throw new Error("avcC, hvcC, vpcC, or av1C box not found");
    }

}