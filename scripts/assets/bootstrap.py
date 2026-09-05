"""Unpack nested original data archives after 7-Zip extraction; never execute them."""
from pathlib import Path
from mix_extract import Mix
from paths import ASSET_CACHE


def required(archive, name, output):
    data = archive.get(name)
    if not data:
        raise RuntimeError(f'Missing required original asset: {name}')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(data)


def main():
    root = ASSET_CACHE
    game = root / 'game'
    mixes = root / 'mixes'
    raw = root / 'raw'
    # The verified XWIS self-extracting archive has flat filenames. Normalize their
    # case so converters also work on case-sensitive Linux filesystems.
    for path in list(game.iterdir()):
        if path.is_file() and path.suffix.lower() == '.mix' and path.name != path.name.lower():
            path.rename(path.with_name(path.name.lower()))
    archive = Mix(game / 'ra2.mix')
    database = archive.get('local mix database.dat')
    if not database or len(database) < 52:
        raise RuntimeError('The original RA2 MIX filename database is missing.')
    count = 0
    for name in database[52:].decode('ascii', errors='ignore').split('\0'):
        if not name.lower().endswith('.mix'):
            continue
        # Names are archive data: reject path traversal before writing them.
        if Path(name).name != name or '\\' in name:
            raise RuntimeError(f'Unsafe archive member: {name!r}')
        required(archive, name, mixes / name.lower())
        count += 1
    required(Mix(game / 'language.mix'), 'audio.mix', mixes / 'audio.mix')
    local = Mix(mixes / 'local.mix')
    for name in ['rules.ini', 'art.ini', 'snow.ini', 'temperat.ini', 'urban.ini',
                 'eva.ini', 'sound.ini', 'theme.ini']:
        required(local, name, raw / name)
    audio = Mix(mixes / 'audio.mix')
    for name in ['audio.idx', 'audio.bag']:
        required(audio, name, raw / name)
    print(f'Extracted {count + 1} original MIX archives and required INI/audio data.', flush=True)


if __name__ == '__main__':
    main()
