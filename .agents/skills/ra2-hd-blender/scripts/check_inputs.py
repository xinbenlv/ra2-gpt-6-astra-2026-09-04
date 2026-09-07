#!/usr/bin/env python3
"""Read-only input identity check. Run from the repo root, or pass --root.

The default manifest describes the accepted powerplant. Other assets may supply
--manifest JSON with version=1 and inputs={role: {path, sha256?}}. Relative paths
resolve against --root (default: current directory), not against the manifest.
Without an expected sha256, a file is only checked for presence and fingerprinted.
No images, models, manifests or external services are changed.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys


def inspect_inputs(manifest_path, root):
    record = json.loads(manifest_path.read_text())
    if not isinstance(record, dict) or record.get('version') != 1:
        raise ValueError('Expected a version 1 input manifest.')
    inputs = record.get('inputs')
    if not isinstance(inputs, dict) or not inputs:
        raise ValueError('The manifest needs a nonempty inputs object.')
    results = []
    for role, item in inputs.items():
        if not isinstance(item, dict) or not isinstance(item.get('path'), str) or not item['path'].strip():
            raise ValueError(f'{role}: expected a nonempty path.')
        expected = item.get('sha256')
        if expected is not None and (not isinstance(expected, str) or not re.fullmatch(r'[a-fA-F0-9]{64}', expected)):
            raise ValueError(f'{role}: sha256 must contain 64 hexadecimal characters.')
        path = (root / item['path']).resolve()
        result = {'role': role, 'path': str(path)}
        try:
            digest = hashlib.sha256()
            with path.open('rb') as stream:
                for block in iter(lambda: stream.read(1024 * 1024), b''):
                    digest.update(block)
            actual = digest.hexdigest()
            result.update(sha256=actual, status='match' if expected else 'present')
            if expected and actual != expected.lower():
                result.update(status='changed', expected_sha256=expected.lower())
        except FileNotFoundError:
            result['status'] = 'missing'
        except OSError as error:
            result.update(status='unreadable', error=str(error))
        results.append(result)
    return {'asset': record.get('asset'),
            'ready': all(item['status'] in ('match', 'present') for item in results),
            'inputs': results}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path.cwd())
    parser.add_argument('--manifest', type=Path,
                        default=Path(__file__).resolve().parents[1] / 'references/powerplant-inputs.json')
    args = parser.parse_args()
    try:
        result = inspect_inputs(args.manifest, args.root)
    except (OSError, ValueError) as error:
        print(f'Input manifest error: {error}', file=sys.stderr)
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result['ready'] else 1


if __name__ == '__main__':
    sys.exit(main())
