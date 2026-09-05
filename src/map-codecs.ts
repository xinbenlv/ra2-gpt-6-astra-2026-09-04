/** Binary codecs used by original Westwood map files. No runtime dependencies. */
export type IniFile = Record<string, Record<string, string>>;

/** Section/key spelling is retained; lookups in map loading are case-insensitive. */
export function parseIni(text: string): IniFile {
  const result: IniFile = Object.create(null);
  let section: Record<string, string> = result[''] = Object.create(null);
  for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.replace(/;.*$/, '').trim();
    if (!line) continue;
    const header = /^\[([^\]]+)\]$/.exec(line);
    if (header) { section = result[header[1]!.trim()] ??= Object.create(null); continue; }
    const equals = line.indexOf('=');
    if (equals > -1) section[line.slice(0, equals).trim()] = line.slice(equals + 1).trim();
  }
  return result;
}

export function iniSection(ini: IniFile, name: string): Record<string, string> {
  return ini[Object.keys(ini).find(key => key.toLowerCase() === name.toLowerCase()) ?? name] ?? {};
}

export function iniValue(section: Record<string, string>, name: string, fallback = ''): string {
  return section[Object.keys(section).find(key => key.toLowerCase() === name.toLowerCase()) ?? name] ?? fallback;
}

export function decodeBase64Section(section: Record<string, string>): Uint8Array {
  const text = Object.keys(section).sort((a, b) => Number(a) - Number(b)).map(key => section[key]).join('').replace(/\s/g, '');
  let decoded: string;
  try { decoded = atob(text); } catch { throw new Error('地图压缩数据不是有效的 Base64。'); }
  return Uint8Array.from(decoded, character => character.charCodeAt(0));
}

/**
 * Original LZO1X stream decoding, following the documented instruction format:
 * https://www.kernel.org/doc/html/latest/staging/lzo.html
 * Every read/write is bounded so malformed imported maps fail instead of hanging.
 */
export function decodeLzo1x(input: Uint8Array, expectedSize: number): Uint8Array {
  if (expectedSize < 0 || expectedSize > 16 * 1024 * 1024) throw new Error('LZO 输出大小无效。');
  const output = new Uint8Array(expectedSize);
  let ip = 0, op = 0, state = 0;
  const byte = () => { if (ip >= input.length) throw new Error('LZO 数据提前结束。'); return input[ip++]!; };
  const word = () => byte() | byte() << 8;
  const literal = (length: number) => {
    if (ip + length > input.length || op + length > output.length) throw new Error('LZO 文字数据越界。');
    output.set(input.subarray(ip, ip + length), op); ip += length; op += length;
  };
  const copy = (distance: number, length: number) => {
    if (distance <= 0 || distance > op || op + length > output.length) throw new Error('LZO 回引用无效。');
    for (let i = 0; i < length; i++) { output[op] = output[op - distance]!; op++; }
  };
  const length = (value: number, mask: number, extra: number) => {
    if (value) return value + extra;
    let total = mask, next = byte();
    while (next === 0) { total += 255; if (total > expectedSize) throw new Error('LZO 长度无效。'); next = byte(); }
    return total + next + extra;
  };
  if (input.length && input[0]! > 17) {
    const count = byte() - 17; literal(count); state = Math.min(count, 4);
  }
  while (ip < input.length) {
    const code = byte();
    if (code < 16 && state === 0) {
      literal(length(code, 15, 3)); state = 4; continue;
    }
    let count: number, distance: number, following: number;
    if (code < 16) {
      count = state === 4 ? 3 : 2;
      distance = (byte() << 2) + (code >> 2) + (state === 4 ? 2049 : 1);
      following = code & 3;
    } else if (code < 32) {
      count = length(code & 7, 7, 2);
      const operand = word();
      distance = 16384 + ((code & 8) << 11) + (operand >> 2);
      following = operand & 3;
      if (distance === 16384) {
        if (op !== expectedSize) throw new Error(`LZO 解压大小不匹配：${op}/${expectedSize}。`);
        return output;
      }
    } else if (code < 64) {
      count = length(code & 31, 31, 2);
      const operand = word(); distance = (operand >> 2) + 1; following = operand & 3;
    } else {
      count = (code >> 5) + 1;
      distance = (byte() << 3) + ((code >> 2) & 7) + 1;
      following = code & 3;
    }
    copy(distance, count); literal(following); state = following;
  }
  throw new Error('LZO 数据缺少结束标记。');
}

/** Westwood LCW / Format80, used for OverlayPack and OverlayDataPack. */
export function decodeLcw(input: Uint8Array, expectedSize: number): Uint8Array {
  if (expectedSize < 0 || expectedSize > 16 * 1024 * 1024) throw new Error('LCW 输出大小无效。');
  const output = new Uint8Array(expectedSize);
  let ip = 0, op = 0;
  const byte = () => { if (ip >= input.length) throw new Error('LCW 数据提前结束。'); return input[ip++]!; };
  const word = () => byte() | byte() << 8;
  const relative = input[0] === 0;
  if (relative) ip++;
  const copy = (source: number, count: number) => {
    if (source < 0 || source >= op || op + count > output.length) throw new Error('LCW 回引用无效。');
    for (let i = 0; i < count; i++) output[op++] = output[source++]!;
  };
  while (ip < input.length) {
    const code = byte();
    if (code === 0x80) {
      if (op !== expectedSize) throw new Error(`LCW 解压大小不匹配：${op}/${expectedSize}。`);
      return output;
    }
    if (!(code & 0x80)) {
      const count = (code >> 4) + 3, distance = ((code & 15) << 8) | byte();
      copy(op - distance, count);
    } else if (!(code & 0x40)) {
      const count = code & 63;
      if (ip + count > input.length || op + count > output.length) throw new Error('LCW 文字数据越界。');
      output.set(input.subarray(ip, ip + count), op); ip += count; op += count;
    } else if (code === 0xfe) {
      const count = word(), value = byte();
      if (op + count > output.length) throw new Error('LCW 填充越界。');
      output.fill(value, op, op + count); op += count;
    } else {
      const count = code === 0xff ? word() : (code & 63) + 3;
      const source = word(); copy(relative ? op - source : source, count);
    }
  }
  if (op === expectedSize) return output;
  throw new Error('LCW 数据缺少结束标记。');
}

export function decodeMapPack(section: Record<string, string>, codec: 'lzo' | 'lcw', maximum = 8 * 1024 * 1024): Uint8Array {
  const packed = decodeBase64Section(section);
  const parts: Uint8Array[] = [];
  let offset = 0, total = 0;
  while (offset < packed.length) {
    if (offset + 4 > packed.length) throw new Error('地图压缩块头不完整。');
    const inputSize = packed[offset]! | packed[offset + 1]! << 8;
    const outputSize = packed[offset + 2]! | packed[offset + 3]! << 8;
    offset += 4;
    if (!inputSize || !outputSize || offset + inputSize > packed.length) throw new Error('地图压缩块大小无效。');
    total += outputSize;
    if (total > maximum) throw new Error('地图数据过大。');
    parts.push((codec === 'lzo' ? decodeLzo1x : decodeLcw)(packed.subarray(offset, offset + inputSize), outputSize));
    offset += inputSize;
  }
  const output = new Uint8Array(total);
  let index = 0;
  for (const part of parts) { output.set(part, index); index += part.length; }
  return output;
}
