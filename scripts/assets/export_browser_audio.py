"""Decode original IMA ADPCM into browser-playable PCM WAV inside Pyodide.

The audioop-lts package supplies the native WebAssembly IMA decoder. This adapter
handles the WAV predictor headers, low-nibble-first encoding and stereo blocks.
No subprocesses, FFmpeg, network access or platform audio service are required.
"""
import array
import io
import json
import struct
import sys
import wave

NIBBLE_SWAP = bytes(((value & 15) << 4) | (value >> 4) for value in range(256))


def pcm_wave(data):
    """Return a PCM WAV, preserving samples and sample rate of the original."""
    import audioop
    if data[:4] != b'RIFF' or data[8:12] != b'WAVE':
        raise ValueError('Expected an original RIFF/WAVE audio stream')
    chunks = {}
    position = 12
    while position + 8 <= len(data):
        kind = data[position:position + 4]
        size = struct.unpack_from('<I', data, position + 4)[0]
        chunks[kind] = data[position + 8:position + 8 + size]
        position += 8 + size + (size & 1)
    fmt, encoded = chunks[b'fmt '], chunks[b'data']
    tag, channels, rate, _, block_size, bits = struct.unpack_from('<HHIIHH', fmt)
    if tag == 1:
        # The original PCM representation already plays in browsers.
        return data
    if tag != 17 or channels not in (1, 2) or bits != 4 or block_size < channels * 4:
        raise ValueError(f'Unsupported original audio format: tag={tag}, channels={channels}, bits={bits}')
    output = io.BytesIO()
    with wave.open(output, 'wb') as wav:
        wav.setnchannels(channels)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        for offset in range(0, len(encoded), block_size):
            block = encoded[offset:offset + block_size]
            if len(block) < channels * 4:
                break
            # WAV stores four consecutive bytes per channel in alternating groups.
            payload = block[channels * 4:]
            decoded = []
            for channel in range(channels):
                predictor, index, _ = struct.unpack_from('<hBB', block, channel * 4)
                channel_data = payload if channels == 1 else b''.join(
                    payload[start:start + 4] for start in range(channel * 4, len(payload), 8))
                # audioop consumes high nibble first; Microsoft IMA WAV is low first.
                samples, _ = audioop.adpcm2lin(channel_data.translate(NIBBLE_SWAP), 2, (predictor, index))
                values = array.array('h')
                values.frombytes(struct.pack('<h', predictor) + samples)
                if sys.byteorder != 'little':
                    values.byteswap()
                decoded.append(values)
            frame_count = min(map(len, decoded))
            interleaved = array.array('h', [0]) * (frame_count * channels)
            for channel, values in enumerate(decoded):
                interleaved[channel::channels] = values[:frame_count]
            if sys.byteorder != 'little':
                interleaved.byteswap()
            wav.writeframesraw(interleaved.tobytes())
    return output.getvalue()


def main():
    import export_assets as e
    output = e.OUT / 'audio'
    output.mkdir(exist_ok=True)
    sounds, music = {}, {}
    count = 0

    def add(key, data, original, text=None, mus=False):
        nonlocal count
        if not data:
            return
        target = output / (key + '.wav')
        target.write_bytes(pcm_wave(data))
        item = {'src': '/assets/audio/' + target.name, 'originalFile': original}
        if text:
            item['text'] = text
        (music if mus else sounds)[key] = item
        count += 1
        if count % 100 == 0:
            print(f'Browser audio: {count} original clips decoded.', flush=True)

    eva = e.read_ini((e.ROOT / 'raw/eva.ini').read_bytes())
    for key, record in eva.items():
        if not key.startswith('eva_'):
            continue
        for faction, name in [('allied', record.get('allied')), ('soviet', record.get('russian'))]:
            if name:
                add(faction + '_' + key[4:], e.M['audio'].get(name + '.wav'), name + '.wav', record.get('text'))
    index = (e.ROOT / 'raw/audio.idx').read_bytes()
    bag = (e.ROOT / 'raw/audio.bag').read_bytes()
    for entry in range(struct.unpack_from('<I', index, 8)[0]):
        offset = 12 + entry * 36
        name = index[offset:offset + 16].split(b'\0')[0].decode()
        start, size, rate, flags, block = struct.unpack_from('<5I', index, offset + 16)
        channels = 2 if flags & 1 else 1
        if flags & 8:
            samples = (block - 4 * channels) * 2 // channels + 1
            fmt = struct.pack('<HHIIHHHH', 17, channels, rate, rate * block // samples, block, 4, 2, samples)
        else:
            bits = 16 if flags & 2 else 8
            fmt = struct.pack('<HHIIHH', 1, channels, rate, rate * channels * bits // 8, channels * bits // 8, bits)
        payload = bag[start:start + size]
        body = b'WAVEfmt ' + struct.pack('<I', len(fmt)) + fmt + b'data' + struct.pack('<I', len(payload)) + payload
        add(name, b'RIFF' + struct.pack('<I', len(body)) + body, 'audio.bag:' + name)
    del bag, index
    for name in ['hm2', 'grinder', 'industro']:
        add(name, e.M['theme'].get(name + '.wav'), name + '.wav', mus=True)
    manifest = json.loads((e.OUT / 'manifest.json').read_text())
    manifest['sounds'], manifest['music'] = sounds, music
    soundini = e.read_ini((e.ROOT / 'raw/sound.ini').read_bytes())
    manifest['soundEvents'] = {
        key: [name.lstrip('$').lower() for name in record['sounds'].split() if name.lstrip('$').lower() in sounds]
        for key, record in soundini.items() if 'sounds' in record}
    manifest['unitVoices'] = {
        key: {event: record[event].lower() for event in ['voiceselect', 'voicemove', 'voiceattack', 'diesound', 'movesound'] if event in record}
        for key, record in e.RULES.items() if 'voiceselect' in record}
    (e.OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2))
    print(f'Browser audio ready: {len(sounds)} sounds, {len(music)} music tracks.', flush=True)


if __name__ == '__main__':
    main()
