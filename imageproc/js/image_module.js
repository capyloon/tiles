function clamp_host(i, min, max) {
  if (!Number.isInteger(i)) throw new TypeError(`must be an integer`);
  if (i < min || i > max)
    throw new RangeError(`must be between ${min} and ${max}`);
  return i;
}

let DATA_VIEW = new DataView(new ArrayBuffer());

function data_view(mem) {
  if (DATA_VIEW.buffer !== mem.buffer) DATA_VIEW = new DataView(mem.buffer);
  return DATA_VIEW;
}
const UTF8_DECODER = new TextDecoder("utf-8");

const UTF8_ENCODER = new TextEncoder("utf-8");

function utf8_encode(s, realloc, memory) {
  if (typeof s !== "string") throw new TypeError("expected a string");

  if (s.length === 0) {
    UTF8_ENCODED_LEN = 0;
    return 1;
  }

  let alloc_len = 0;
  let ptr = 0;
  let writtenTotal = 0;
  while (s.length > 0) {
    ptr = realloc(ptr, alloc_len, 1, alloc_len + s.length);
    alloc_len += s.length;
    const { read, written } = UTF8_ENCODER.encodeInto(
      s,
      new Uint8Array(
        memory.buffer,
        ptr + writtenTotal,
        alloc_len - writtenTotal
      )
    );
    writtenTotal += written;
    s = s.slice(read);
  }
  if (alloc_len > writtenTotal) ptr = realloc(ptr, alloc_len, 1, writtenTotal);
  UTF8_ENCODED_LEN = writtenTotal;
  return ptr;
}
let UTF8_ENCODED_LEN = 0;

export class ImageModule {
  addToImports(imports) {}

  async instantiate(module, imports) {
    imports = imports || {};
    this.addToImports(imports);

    if (module instanceof WebAssembly.Instance) {
      this.instance = module;
    } else if (module instanceof WebAssembly.Module) {
      this.instance = await WebAssembly.instantiate(module, imports);
    } else if (module instanceof ArrayBuffer || module instanceof Uint8Array) {
      const { instance } = await WebAssembly.instantiate(module, imports);
      this.instance = instance;
    } else {
      const { instance } = await WebAssembly.instantiateStreaming(
        module,
        imports
      );
      this.instance = instance;
    }
    this._exports = this.instance.exports;
  }
  algorithms(arg0) {
    const memory = this._exports.memory;
    const realloc = this._exports["canonical_abi_realloc"];
    const free = this._exports["canonical_abi_free"];
    const ptr0 = utf8_encode(arg0, realloc, memory);
    const len0 = UTF8_ENCODED_LEN;
    const ret = this._exports["algorithms"](ptr0, len0);
    const len3 = data_view(memory).getInt32(ret + 4, true);
    const base3 = data_view(memory).getInt32(ret + 0, true);
    const result3 = [];
    for (let i = 0; i < len3; i++) {
      const base = base3 + i * 16;
      const ptr1 = data_view(memory).getInt32(base + 0, true);
      const len1 = data_view(memory).getInt32(base + 4, true);
      const list1 = UTF8_DECODER.decode(
        new Uint8Array(memory.buffer, ptr1, len1)
      );
      free(ptr1, len1, 1);
      const ptr2 = data_view(memory).getInt32(base + 8, true);
      const len2 = data_view(memory).getInt32(base + 12, true);
      const list2 = UTF8_DECODER.decode(
        new Uint8Array(memory.buffer, ptr2, len2)
      );
      free(ptr2, len2, 1);
      result3.push({
        name: list1,
        description: list2,
      });
    }
    free(base3, len3 * 16, 4);
    return result3;
  }
  processImage(arg0, arg1, arg2, arg3) {
    const memory = this._exports.memory;
    const realloc = this._exports["canonical_abi_realloc"];
    const free = this._exports["canonical_abi_free"];
    const ptr0 = utf8_encode(arg0, realloc, memory);
    const len0 = UTF8_ENCODED_LEN;
    const val1 = arg1;
    const len1 = val1.length;
    const ptr1 = realloc(0, 0, 1, len1 * 1);
    new Uint8Array(memory.buffer, ptr1, len1 * 1).set(
      new Uint8Array(val1.buffer, val1.byteOffset, len1 * 1)
    );
    const ret = this._exports["process-image"](
      ptr0,
      len0,
      ptr1,
      len1,
      clamp_host(arg2, 0, 4294967295),
      clamp_host(arg3, 0, 4294967295)
    );
    let variant3;
    switch (data_view(memory).getUint8(ret + 0, true)) {
      case 0: {
        variant3 = null;
        break;
      }
      case 1: {
        const ptr2 = data_view(memory).getInt32(ret + 4, true);
        const len2 = data_view(memory).getInt32(ret + 8, true);
        const list2 = new Uint8Array(
          memory.buffer.slice(ptr2, ptr2 + len2 * 1)
        );
        free(ptr2, len2, 1);

        variant3 = list2;
        break;
      }

      default:
        throw new RangeError("invalid variant discriminant for option");
    }
    return variant3;
  }
}
