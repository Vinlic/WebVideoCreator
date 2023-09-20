import EventEmitter from 'eventemitter3';
import fs from 'fs-extra';
import MP4Box from 'mp4box';

import util from '../lib/util.js';

const { DataStream } = MP4Box;

const CHUNK_SEPARATOR = Buffer.from([0x66, 0xC8, 0xEC, 0xD3, 0xBB]);
const DATA_SEPARATOR = Buffer.from([0xB6, 0x38, 0x2D, 0x3D, 0x26]);

class MP4Source extends EventEmitter {

    file;
    info = null;

    constructor() {
        super();
        this.file = MP4Box.createFile();
        this.file.onError = err => this.emit("error", err);
    }

    async load(source) {
        const readyPromise = new Promise(resolve => this.file.onReady = resolve);
        if (util.isString(source)) {
            if (!await fs.pathExists(source))
                throw new Error(`file ${source} not found`);
            source = await fs.readFile(source);
        }
        if (!util.isBuffer(source))
            throw new TypeError("source must be a buffer or filePath");
        source.buffer.fileStart = 0;
        this.file.appendBuffer(source.buffer);
        this.file.flush();
        this.info = await readyPromise;
    }

    async extract(track, writeStream) {
        const extractPromise = new Promise((resolve, reject) => {
            let writtedSize = 0;
            this.file.onSamples = (track_id, ref, samples) => {
                if (track_id !== track.id) return;
                const chunks = [];
                util.isWriteStream(writeStream) && writeStream.once("error", reject);
                for (const sample of samples) {
                    const type = sample.is_sync ? "key" : "delta";
                    if (util.isWriteStream(writeStream)) {
                        const data = Buffer.concat([Buffer.from(type), DATA_SEPARATOR, Buffer.from(`${sample.cts}`), DATA_SEPARATOR, Buffer.from(`${sample.duration}`), DATA_SEPARATOR, sample.data, CHUNK_SEPARATOR]);
                        writtedSize += sample.data.length;
                        if (writtedSize >= track.size) {
                            writeStream.once("close", resolve);
                            writeStream.end(data);
                        }
                        else
                            writeStream.write(data);
                    }
                    else {
                        chunks.push({
                            type: type,
                            timestamp: sample.cts,
                            duration: sample.duration,
                            data: sample.data
                        });
                        if (sample.cts + sample.duration >= track.duration)
                            return resolve(chunks);
                    }
                }
            };
        });
        this.file.setExtractionOptions(track.id);
        this.file.start();
        return extractPromise;
    }

    getDescription(track) {
        const trak = this.file.getTrackById(track.id);
        for (const entry of trak.mdia.minf.stbl.stsd.entries) {
            if (entry.avcC || entry.hvcC) {
                const stream = new DataStream(undefined, 0, DataStream.BIG_ENDIAN);
                if (entry.avcC) {
                    entry.avcC.write(stream);
                } else {
                    entry.hvcC.write(stream);
                }
                return new Uint8Array(stream.buffer, 8);  // Remove the box header.
            }
        }
        throw "avcC or hvcC not found";
    }

    get audioTracks() {
        if (!this.info) throw new Error("file not load");
        return this.info.audioTracks;
    }

    get videoTracks() {
        if (!this.info) throw new Error("file not load");
        return this.info.videoTracks;
    }

    destory() {
        this.removeAllListeners("error");
        this.file = null;
    }

}

class MP4Demuxer extends EventEmitter {

    source;

    constructor() {
        super();
        this.source = new MP4Source();
        this.source.on("error", err => this.emit("error", err));
    }

    async init(source) {
        await this.source.load(source);
    }

    get config() {
        const track = this.source.videoTracks[0];
        if (!track) throw new Error("video tracks not found");
        return {
            codec: track.codec,
            codedHeight: track.track_height,
            codedWidth: track.track_width,
            description: this.source.getDescription(track),
            duration: (track.movie_duration / track.movie_timescale) * 1000
        };
    }

    async run(writeStream) {
        const track = this.source.videoTracks[0];
        if (!track) throw new Error("video track not found");
        const { codec, codedWidth, codedHeight, description, duration } = this.config;
        writeStream.write(Buffer.concat([Buffer.from(codec), DATA_SEPARATOR, Buffer.from(`${codedWidth}`), DATA_SEPARATOR, Buffer.from(`${codedHeight}`), DATA_SEPARATOR, Buffer.from(`${duration}`), DATA_SEPARATOR, description, CHUNK_SEPARATOR]));
        return await this.source.extract(track, writeStream);
    }

    destory() {
        this.removeAllListeners("error");
        this.source.destory();
        this.source = null;
    }

}

export default MP4Demuxer;