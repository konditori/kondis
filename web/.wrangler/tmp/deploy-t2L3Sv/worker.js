var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e3) {
    throw err = [e3], e3;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// .svelte-kit/output/server/chunks/uneval.js
function is_primitive(thing) {
  return thing === null || typeof thing !== "object" && typeof thing !== "function";
}
function is_plain_object(thing) {
  const proto = Object.getPrototypeOf(thing);
  return proto === Object.prototype || proto === null || Object.getPrototypeOf(proto) === null || Object.getOwnPropertyNames(proto).sort().join("\0") === object_proto_names;
}
function get_type(thing) {
  return Object.prototype.toString.call(thing).slice(8, -1);
}
function get_escaped_char(char) {
  switch (char) {
    case '"':
      return '\\"';
    case "<":
      return "\\u003C";
    case "\\":
      return "\\\\";
    case "\n":
      return "\\n";
    case "\r":
      return "\\r";
    case "	":
      return "\\t";
    case "\b":
      return "\\b";
    case "\f":
      return "\\f";
    case "\u2028":
      return "\\u2028";
    case "\u2029":
      return "\\u2029";
    default:
      return char < " " ? `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}` : "";
  }
}
function stringify_string(str) {
  let result = "";
  let last_pos = 0;
  const len = str.length;
  for (let i = 0; i < len; i += 1) {
    const char = str[i];
    const replacement = get_escaped_char(char);
    if (replacement) {
      result += str.slice(last_pos, i) + replacement;
      last_pos = i + 1;
    }
  }
  return `"${last_pos === 0 ? str : result + str.slice(last_pos)}"`;
}
function enumerable_symbols(object) {
  return Object.getOwnPropertySymbols(object).filter((symbol) => Object.getOwnPropertyDescriptor(object, symbol).enumerable);
}
function stringify_key(key2) {
  return is_identifier.test(key2) ? "." + key2 : "[" + JSON.stringify(key2) + "]";
}
function is_valid_array_index(n2) {
  if (!Number.isInteger(n2)) return false;
  if (n2 < 0) return false;
  if (n2 > MAX_ARRAY_INDEX) return false;
  return true;
}
function is_valid_array_len(n2) {
  if (!Number.isInteger(n2)) return false;
  if (n2 < 0) return false;
  if (n2 > MAX_ARRAY_LEN) return false;
  return true;
}
function is_valid_array_index_string(s3) {
  if (s3.length === 0) return false;
  if (s3.length > 1 && s3.charCodeAt(0) === 48) return false;
  for (let i = 0; i < s3.length; i++) {
    const c2 = s3.charCodeAt(i);
    if (c2 < 48 || c2 > 57) return false;
  }
  return is_valid_array_index(+s3);
}
function array_index_cut(keys) {
  for (var i = keys.length - 1; i >= 0; i--) if (is_valid_array_index_string(keys[i])) break;
  return i + 1;
}
function valid_array_indices(array2) {
  const keys = Object.keys(array2);
  keys.length = array_index_cut(keys);
  return keys;
}
function uneval(value, replacer) {
  const counts = /* @__PURE__ */ new Map();
  const keys = [];
  const custom = /* @__PURE__ */ new Map();
  function walk(thing) {
    if (!is_primitive(thing)) {
      if (counts.has(thing)) {
        counts.set(thing, counts.get(thing) + 1);
        return;
      }
      counts.set(thing, 1);
      if (replacer) {
        const str2 = replacer(thing, (value2) => uneval(value2, replacer));
        if (typeof str2 === "string") {
          custom.set(thing, str2);
          return;
        }
      }
      if (typeof thing === "function") throw new DevalueError(`Cannot stringify a function`, keys, thing, value);
      switch (get_type(thing)) {
        case "Number":
        case "BigInt":
        case "String":
        case "Boolean":
        case "Date":
        case "RegExp":
        case "URL":
        case "URLSearchParams":
          return;
        case "Array":
          thing.forEach((value2, i) => {
            keys.push(`[${i}]`);
            walk(value2);
            keys.pop();
          });
          break;
        case "Set":
          Array.from(thing).forEach(walk);
          break;
        case "Map":
          for (const [key2, value2] of thing) {
            keys.push(`.get(${is_primitive(key2) ? stringify_primitive(key2) : "..."})`);
            walk(key2);
            walk(value2);
            keys.pop();
          }
          break;
        case "Int8Array":
        case "Uint8Array":
        case "Uint8ClampedArray":
        case "Int16Array":
        case "Uint16Array":
        case "Float16Array":
        case "Int32Array":
        case "Uint32Array":
        case "Float32Array":
        case "Float64Array":
        case "BigInt64Array":
        case "BigUint64Array":
        case "DataView":
          walk(thing.buffer);
          return;
        case "ArrayBuffer":
          return;
        case "Temporal.Duration":
        case "Temporal.Instant":
        case "Temporal.PlainDate":
        case "Temporal.PlainTime":
        case "Temporal.PlainDateTime":
        case "Temporal.PlainMonthDay":
        case "Temporal.PlainYearMonth":
        case "Temporal.ZonedDateTime":
          return;
        default:
          if (!is_plain_object(thing)) throw new DevalueError(`Cannot stringify arbitrary non-POJOs`, keys, thing, value);
          if (enumerable_symbols(thing).length > 0) throw new DevalueError(`Cannot stringify POJOs with symbolic keys`, keys, thing, value);
          for (const key2 of Object.keys(thing)) {
            if (key2 === "__proto__") throw new DevalueError(`Cannot stringify objects with __proto__ keys`, keys, thing, value);
            keys.push(stringify_key(key2));
            walk(thing[key2]);
            keys.pop();
          }
      }
    } else if (typeof thing === "symbol") throw new DevalueError(`Cannot stringify a Symbol primitive`, keys, thing, value);
  }
  __name(walk, "walk");
  walk(value);
  const names = /* @__PURE__ */ new Map();
  Array.from(counts).filter((entry) => entry[1] > 1).sort((a2, b) => b[1] - a2[1]).forEach((entry, i) => {
    names.set(entry[0], get_name(i));
  });
  function stringify3(thing) {
    if (names.has(thing)) return names.get(thing);
    if (is_primitive(thing)) return stringify_primitive(thing);
    if (custom.has(thing)) return custom.get(thing);
    const type = get_type(thing);
    switch (type) {
      case "Number":
      case "String":
      case "Boolean":
      case "BigInt":
        return `Object(${stringify3(thing.valueOf())})`;
      case "RegExp":
        const { source: source2, flags: flags2 } = thing;
        return flags2 ? `new RegExp(${stringify_string(source2)},"${flags2}")` : `new RegExp(${stringify_string(source2)})`;
      case "Date":
        return `new Date(${thing.getTime()})`;
      case "URL":
        return `new URL(${stringify_string(thing.toString())})`;
      case "URLSearchParams":
        return `new URLSearchParams(${stringify_string(thing.toString())})`;
      case "Array": {
        let has_holes = false;
        let result = "[";
        for (let i = 0; i < thing.length; i += 1) {
          if (i > 0) result += ",";
          if (Object.hasOwn(thing, i)) result += stringify3(thing[i]);
          else if (!has_holes) {
            const populated_keys = valid_array_indices(thing);
            const population = populated_keys.length;
            const d2 = String(thing.length).length;
            if (thing.length + 2 > 25 + d2 + population * (d2 + 2)) {
              const entries = populated_keys.map((k) => `${k}:${stringify3(thing[k])}`).join(",");
              return `Object.assign(Array(${thing.length}),{${entries}})`;
            }
            has_holes = true;
          }
        }
        const tail = thing.length === 0 || thing.length - 1 in thing ? "" : ",";
        return result + tail + "]";
      }
      case "Set":
      case "Map":
        return `new ${type}([${Array.from(thing).map(stringify3).join(",")}])`;
      case "Int8Array":
      case "Uint8Array":
      case "Uint8ClampedArray":
      case "Int16Array":
      case "Uint16Array":
      case "Float16Array":
      case "Int32Array":
      case "Uint32Array":
      case "Float32Array":
      case "Float64Array":
      case "BigInt64Array":
      case "BigUint64Array": {
        let str2 = `new ${type}`;
        if (!names.has(thing.buffer)) str2 += `([${stringify_typed_array_elements(type, thing.buffer)}])`;
        else str2 += `(${stringify3(thing.buffer)})`;
        if (thing.byteLength !== thing.buffer.byteLength) {
          const start = thing.byteOffset / thing.BYTES_PER_ELEMENT;
          const end = start + thing.length;
          str2 += `.subarray(${start},${end})`;
        }
        return str2;
      }
      case "DataView": {
        let str2 = `new DataView`;
        if (!names.has(thing.buffer)) str2 += `(new Uint8Array([${new Uint8Array(thing.buffer)}]).buffer`;
        else str2 += `(${stringify3(thing.buffer)}`;
        if (thing.byteLength !== thing.buffer.byteLength) str2 += `,${thing.byteOffset},${thing.byteLength}`;
        return str2 + ")";
      }
      case "ArrayBuffer":
        return `new Uint8Array([${new Uint8Array(thing).toString()}]).buffer`;
      case "Temporal.Duration":
      case "Temporal.Instant":
      case "Temporal.PlainDate":
      case "Temporal.PlainTime":
      case "Temporal.PlainDateTime":
      case "Temporal.PlainMonthDay":
      case "Temporal.PlainYearMonth":
      case "Temporal.ZonedDateTime":
        return `${type}.from(${stringify_string(thing.toString())})`;
      default:
        const keys2 = Object.keys(thing);
        const obj = keys2.map((key2) => `${safe_key(key2)}:${stringify3(thing[key2])}`).join(",");
        if (Object.getPrototypeOf(thing) === null) return keys2.length > 0 ? `{${obj},__proto__:null}` : `{__proto__:null}`;
        return `{${obj}}`;
    }
  }
  __name(stringify3, "stringify");
  const str = stringify3(value);
  if (names.size) {
    const params = [];
    const statements = [];
    const values = [];
    const reconstructions = [];
    names.forEach((name, thing) => {
      params.push(name);
      if (custom.has(thing)) {
        values.push(custom.get(thing));
        return;
      }
      if (is_primitive(thing)) {
        values.push(stringify_primitive(thing));
        return;
      }
      const type = get_type(thing);
      switch (type) {
        case "Number":
        case "String":
        case "Boolean":
        case "BigInt":
          values.push(`Object(${stringify3(thing.valueOf())})`);
          break;
        case "RegExp":
          const { source: source2, flags: flags2 } = thing;
          const regexp = flags2 ? `new RegExp(${stringify_string(source2)},"${flags2}")` : `new RegExp(${stringify_string(source2)})`;
          values.push(regexp);
          break;
        case "Date":
          values.push(`new Date(${thing.getTime()})`);
          break;
        case "URL":
          values.push(`new URL(${stringify_string(thing.toString())})`);
          break;
        case "URLSearchParams":
          values.push(`new URLSearchParams(${stringify_string(thing.toString())})`);
          break;
        case "Array":
          values.push(`Array(${thing.length})`);
          thing.forEach((v, i) => {
            statements.push(`${name}[${i}]=${stringify3(v)}`);
          });
          break;
        case "Set": {
          values.push(`new Set`);
          const adds = Array.from(thing).map((v) => `.add(${stringify3(v)})`);
          if (adds.length > 0) statements.push(name + adds.join(""));
          break;
        }
        case "Map": {
          values.push(`new Map`);
          const sets = Array.from(thing).map(([k, v]) => `.set(${stringify3(k)}, ${stringify3(v)})`);
          if (sets.length > 0) statements.push(name + sets.join(""));
          break;
        }
        case "Int8Array":
        case "Uint8Array":
        case "Uint8ClampedArray":
        case "Int16Array":
        case "Uint16Array":
        case "Float16Array":
        case "Int32Array":
        case "Uint32Array":
        case "Float32Array":
        case "Float64Array":
        case "BigInt64Array":
        case "BigUint64Array": {
          let str2 = `new ${type}`;
          if (!names.has(thing.buffer)) str2 += `([${stringify_typed_array_elements(type, thing.buffer)}])`;
          else str2 += `(${stringify3(thing.buffer)})`;
          if (thing.byteLength !== thing.buffer.byteLength) {
            const start = thing.byteOffset / thing.BYTES_PER_ELEMENT;
            const end = start + thing.length;
            str2 += `.subarray(${start},${end})`;
          }
          values.push(`{}`);
          reconstructions.push(`${name}=${str2}`);
          break;
        }
        case "DataView": {
          let str2 = `new DataView`;
          if (!names.has(thing.buffer)) str2 += `(new Uint8Array([${new Uint8Array(thing.buffer)}]).buffer`;
          else str2 += `(${stringify3(thing.buffer)}`;
          if (thing.byteLength !== thing.buffer.byteLength) str2 += `,${thing.byteOffset},${thing.byteLength}`;
          str2 += ")";
          values.push(`{}`);
          reconstructions.push(`${name}=${str2}`);
          break;
        }
        case "ArrayBuffer":
          values.push(`new Uint8Array([${new Uint8Array(thing)}]).buffer`);
          break;
        case "Temporal.Duration":
        case "Temporal.Instant":
        case "Temporal.PlainDate":
        case "Temporal.PlainTime":
        case "Temporal.PlainDateTime":
        case "Temporal.PlainMonthDay":
        case "Temporal.PlainYearMonth":
        case "Temporal.ZonedDateTime":
          values.push(`${type}.from(${stringify_string(thing.toString())})`);
          break;
        default:
          values.push(Object.getPrototypeOf(thing) === null ? "Object.create(null)" : "{}");
          Object.keys(thing).forEach((key2) => {
            statements.push(`${name}${safe_prop(key2)}=${stringify3(thing[key2])}`);
          });
      }
    });
    statements.push(`return ${str}`);
    const body = [...reconstructions, ...statements].join(";");
    if (params.length > 65534) return `(function(){var[${params.join(",")}]=arguments[0];${body}}([${values.join(",")}]))`;
    return `(function(${params.join(",")}){${body}}(${values.join(",")}))`;
  } else return str;
}
function stringify_typed_array_elements(type, buffer2) {
  const array2 = new globalThis[type](buffer2);
  if (type === "BigInt64Array" || type === "BigUint64Array") return Array.from(array2, (element2) => `${element2}n`).join(",");
  if (array2 instanceof Float32Array || array2 instanceof Float64Array || typeof Float16Array !== "undefined" && array2 instanceof Float16Array) return Array.from(array2, (element2) => Object.is(element2, -0) ? "-0" : `${element2}`).join(",");
  return array2.toString();
}
function get_name(num) {
  let name = "";
  do {
    name = chars[num % 54] + name;
    num = ~~(num / 54) - 1;
  } while (num >= 0);
  return reserved.test(name) ? `${name}0` : name;
}
function escape_unsafe_char(c2) {
  return escaped[c2] || c2;
}
function escape_unsafe_chars(str) {
  return str.replace(unsafe_chars, escape_unsafe_char);
}
function safe_key(key2) {
  return /^[_$a-zA-Z][_$a-zA-Z0-9]*$/.test(key2) ? key2 : escape_unsafe_chars(JSON.stringify(key2));
}
function safe_prop(key2) {
  return /^[_$a-zA-Z][_$a-zA-Z0-9]*$/.test(key2) ? `.${key2}` : `[${escape_unsafe_chars(JSON.stringify(key2))}]`;
}
function stringify_primitive(thing) {
  const type = typeof thing;
  if (type === "string") return stringify_string(thing);
  if (thing === void 0) return "void 0";
  if (thing === 0 && 1 / thing < 0) return "-0";
  const str = String(thing);
  if (type === "number") return str.replace(/^(-)?0\./, "$1.");
  if (type === "bigint") return thing + "n";
  return str;
}
var MAX_ARRAY_LEN, MAX_ARRAY_INDEX, escaped, DevalueError, object_proto_names, is_identifier, chars, unsafe_chars, reserved;
var init_uneval = __esm({
  ".svelte-kit/output/server/chunks/uneval.js"() {
    MAX_ARRAY_LEN = 2 ** 32 - 1;
    MAX_ARRAY_INDEX = MAX_ARRAY_LEN - 1;
    escaped = {
      "<": "\\u003C",
      "\\": "\\\\",
      "\b": "\\b",
      "\f": "\\f",
      "\n": "\\n",
      "\r": "\\r",
      "	": "\\t",
      "\u2028": "\\u2028",
      "\u2029": "\\u2029"
    };
    DevalueError = class extends Error {
      static {
        __name(this, "DevalueError");
      }
      /**
      * @param {string} message
      * @param {string[]} keys
      * @param {any} [value] - The value that failed to be serialized
      * @param {any} [root] - The root value being serialized
      */
      constructor(message, keys, value, root) {
        super(message);
        this.name = "DevalueError";
        this.path = keys.join("");
        this.value = value;
        this.root = root;
      }
    };
    __name(is_primitive, "is_primitive");
    object_proto_names = /* @__PURE__ */ Object.getOwnPropertyNames(Object.prototype).sort().join("\0");
    __name(is_plain_object, "is_plain_object");
    __name(get_type, "get_type");
    __name(get_escaped_char, "get_escaped_char");
    __name(stringify_string, "stringify_string");
    __name(enumerable_symbols, "enumerable_symbols");
    is_identifier = /^[a-zA-Z_$][a-zA-Z_$0-9]*$/;
    __name(stringify_key, "stringify_key");
    __name(is_valid_array_index, "is_valid_array_index");
    __name(is_valid_array_len, "is_valid_array_len");
    __name(is_valid_array_index_string, "is_valid_array_index_string");
    __name(array_index_cut, "array_index_cut");
    __name(valid_array_indices, "valid_array_indices");
    chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_$";
    unsafe_chars = /[<\b\f\n\r\t\0\u2028\u2029]/g;
    reserved = /^(?:do|if|in|for|int|let|new|try|var|byte|case|char|else|enum|goto|long|this|void|with|await|break|catch|class|const|final|float|short|super|throw|while|yield|delete|double|export|import|native|return|switch|throws|typeof|boolean|default|extends|finally|package|private|abstract|continue|debugger|function|volatile|interface|protected|transient|implements|instanceof|synchronized)$/;
    __name(uneval, "uneval");
    __name(stringify_typed_array_elements, "stringify_typed_array_elements");
    __name(get_name, "get_name");
    __name(escape_unsafe_char, "escape_unsafe_char");
    __name(escape_unsafe_chars, "escape_unsafe_chars");
    __name(safe_key, "safe_key");
    __name(safe_prop, "safe_prop");
    __name(stringify_primitive, "stringify_primitive");
  }
});

// .svelte-kit/output/server/chunks/server.js
function run(fn) {
  return fn();
}
function run_all(arr) {
  for (var i = 0; i < arr.length; i++) arr[i]();
}
function deferred() {
  var resolve2;
  var reject;
  return {
    promise: new Promise((res, rej) => {
      resolve2 = res;
      reject = rej;
    }),
    resolve: resolve2,
    reject
  };
}
function equals(value) {
  return value === this.v;
}
function safe_not_equal(a2, b) {
  return a2 != a2 ? b == b : a2 !== b || a2 !== null && typeof a2 === "object" || typeof a2 === "function";
}
function safe_equals(value) {
  return !safe_not_equal(value, this.v);
}
function derived_inert() {
  console.warn(`https://svelte.dev/e/derived_inert`);
}
function hydration_mismatch(location) {
  console.warn(`https://svelte.dev/e/hydration_mismatch`);
}
function svelte_boundary_reset_noop() {
  console.warn(`https://svelte.dev/e/svelte_boundary_reset_noop`);
}
function set_hydrating(value) {
  hydrating = value;
}
function set_hydrate_node(node) {
  if (node === null) {
    hydration_mismatch();
    throw HYDRATION_ERROR;
  }
  return hydrate_node = node;
}
function hydrate_next() {
  return set_hydrate_node(/* @__PURE__ */ get_next_sibling(hydrate_node));
}
function next(count = 1) {
  if (hydrating) {
    var i = count;
    var node = hydrate_node;
    while (i--) node = /* @__PURE__ */ get_next_sibling(node);
    hydrate_node = node;
  }
}
function skip_nodes(remove = true) {
  var depth = 0;
  var node = hydrate_node;
  while (true) {
    if (node.nodeType === 8) {
      var data = node.data;
      if (data === "]") {
        if (depth === 0) return node;
        depth -= 1;
      } else if (data === "[" || data === "[!" || data[0] === "[" && !isNaN(Number(data.slice(1)))) depth += 1;
    }
    var next2 = /* @__PURE__ */ get_next_sibling(node);
    if (remove) node.remove();
    node = next2;
  }
}
function experimental_async_required(name) {
  throw new Error(`https://svelte.dev/e/experimental_async_required`);
}
function lifecycle_outside_component(name) {
  throw new Error(`https://svelte.dev/e/lifecycle_outside_component`);
}
function missing_context() {
  throw new Error(`https://svelte.dev/e/missing_context`);
}
function effect_update_depth_exceeded() {
  throw new Error(`https://svelte.dev/e/effect_update_depth_exceeded`);
}
function hydration_failed() {
  throw new Error(`https://svelte.dev/e/hydration_failed`);
}
function state_descriptors_fixed() {
  throw new Error(`https://svelte.dev/e/state_descriptors_fixed`);
}
function state_prototype_fixed() {
  throw new Error(`https://svelte.dev/e/state_prototype_fixed`);
}
function state_unsafe_mutation() {
  throw new Error(`https://svelte.dev/e/state_unsafe_mutation`);
}
function svelte_boundary_reset_onerror() {
  throw new Error(`https://svelte.dev/e/svelte_boundary_reset_onerror`);
}
function create_context(get_context, set_context, has_context) {
  const key2 = {};
  return [
    () => {
      if (!has_context(key2)) missing_context();
      return get_context(key2);
    },
    (context3) => set_context(key2, context3),
    () => has_context(key2)
  ];
}
function get_parent_context(context3) {
  let parent = context3.p;
  while (parent !== null && parent.c === null) parent = parent.p;
  return parent?.c ?? null;
}
function get_or_init_context_map(context3, name) {
  if (context3 === null) lifecycle_outside_component(name);
  return context3.c ??= new Map(get_parent_context(context3) || void 0);
}
function set_component_context(context3) {
  component_context = context3;
}
function push$1(props, runes = false, fn) {
  component_context = {
    p: component_context,
    i: false,
    c: null,
    e: null,
    s: props,
    x: null,
    r: active_effect,
    l: legacy_mode_flag && !runes ? {
      s: null,
      u: null,
      $: []
    } : null
  };
}
function pop$1(component22) {
  var context3 = component_context;
  var effects = context3.e;
  if (effects !== null) {
    context3.e = null;
    for (var fn of effects) create_user_effect(fn);
  }
  if (component22 !== void 0) context3.x = component22;
  context3.i = true;
  component_context = context3.p;
  return mark_as_component(component22);
}
function mark_as_component(component22 = {}) {
  define_property(component22, COMPONENT_SYMBOL, { value: true });
  return component22;
}
function is_runes() {
  return !legacy_mode_flag || component_context !== null && component_context.l === null;
}
function run_micro_tasks() {
  var tasks = micro_tasks;
  micro_tasks = [];
  run_all(tasks);
}
function queue_micro_task(fn) {
  if (micro_tasks.length === 0 && !is_flushing_sync) {
    var tasks = micro_tasks;
    queueMicrotask(() => {
      if (tasks === micro_tasks) run_micro_tasks();
    });
  }
  micro_tasks.push(fn);
}
function flush_tasks() {
  while (micro_tasks.length > 0) run_micro_tasks();
}
function set_signal_status(signal, status) {
  signal.f = signal.f & STATUS_MASK | status;
}
function update_derived_status(derived2) {
  if ((derived2.f & 512) !== 0 || derived2.deps === null) set_signal_status(derived2, CLEAN);
  else set_signal_status(derived2, MAYBE_DIRTY);
}
function clear_marked(deps) {
  if (deps === null) return;
  for (const dep of deps) {
    if ((dep.f & 2) === 0 || (dep.f & 65536) === 0) continue;
    dep.f ^= WAS_MARKED;
    clear_marked(
      /** @type {Derived} */
      dep.deps
    );
  }
}
function defer_effect(effect, dirty_effects, maybe_dirty_effects) {
  if ((effect.f & 2048) !== 0) dirty_effects.add(effect);
  else if ((effect.f & 4096) !== 0) maybe_dirty_effects.add(effect);
  clear_marked(effect.deps);
  set_signal_status(effect, CLEAN);
}
function without_reactive_context(fn) {
  var previous_reaction = active_reaction;
  var previous_effect = active_effect;
  set_active_reaction(null);
  set_active_effect(null);
  try {
    return fn();
  } finally {
    set_active_reaction(previous_reaction);
    set_active_effect(previous_effect);
  }
}
function destroy_derived_effects(derived2) {
  var effects = derived2.effects;
  if (effects !== null) {
    derived2.effects = null;
    for (var i = 0; i < effects.length; i += 1) destroy_effect(effects[i]);
  }
}
function execute_derived(derived2) {
  var value;
  var prev_active_effect = active_effect;
  var parent = derived2.parent;
  if (!is_destroying_effect && parent !== null && derived2.v !== UNINITIALIZED && (parent.f & 24576) !== 0) {
    derived_inert();
    return derived2.v;
  }
  set_active_effect(parent);
  try {
    derived2.f &= ~WAS_MARKED;
    destroy_derived_effects(derived2);
    value = update_reaction(derived2);
  } finally {
    set_active_effect(prev_active_effect);
  }
  return value;
}
function update_derived(derived2) {
  var value = execute_derived(derived2);
  if (!derived2.equals(value)) {
    derived2.wv = increment_write_version();
    if (!current_batch?.is_fork || derived2.deps === null) {
      if (current_batch !== null) {
        current_batch.capture(derived2, value, true);
        previous_batch?.capture(derived2, value, true);
      } else derived2.v = value;
      if (derived2.deps === null) {
        set_signal_status(derived2, CLEAN);
        return;
      }
    }
  }
  if (is_destroying_effect) return;
  if (batch_values !== null) {
    if (effect_tracking() || current_batch?.is_fork) batch_values.set(derived2, value);
  } else update_derived_status(derived2);
}
function freeze_derived_effects(derived2) {
  if (derived2.effects === null) return;
  for (const e3 of derived2.effects) if (e3.teardown || e3.ac) {
    e3.teardown?.();
    if (e3.ac !== null) without_reactive_context(() => {
      e3.ac.abort(STALE_REACTION);
      e3.ac = null;
    });
    if (e3.fn !== null) e3.teardown = noop;
    remove_reactions(e3, 0);
    destroy_effect_children(e3);
  }
}
function unfreeze_derived_effects(derived2) {
  if (derived2.effects === null) return;
  for (const e3 of derived2.effects) if (e3.teardown && e3.fn !== null) update_effect(e3);
}
function flushSync(fn) {
  var was_flushing_sync = is_flushing_sync;
  is_flushing_sync = true;
  try {
    var result;
    if (fn) {
      if (current_batch !== null && !current_batch.is_fork) current_batch.flush();
      result = fn();
    }
    while (true) {
      flush_tasks();
      if (current_batch === null) return result;
      current_batch.flush();
    }
  } finally {
    is_flushing_sync = was_flushing_sync;
  }
}
function infinite_loop_guard() {
  try {
    effect_update_depth_exceeded();
  } catch (error2) {
    invoke_error_boundary(error2, last_scheduled_effect);
  }
}
function flush_queued_effects(effects) {
  var length = effects.length;
  if (length === 0) return;
  var i = 0;
  while (i < length) {
    var effect = effects[i++];
    if ((effect.f & 24576) === 0 && is_dirty(effect)) {
      eager_block_effects = /* @__PURE__ */ new Set();
      update_effect(effect);
      if (effect.deps === null && effect.first === null && effect.nodes === null && effect.teardown === null && effect.ac === null) unlink_effect(effect);
      if (eager_block_effects?.size > 0) {
        old_values.clear();
        for (const e3 of eager_block_effects) {
          if ((e3.f & 24576) !== 0) continue;
          const ordered_effects = [e3];
          let ancestor = e3.parent;
          while (ancestor !== null) {
            if (eager_block_effects.has(ancestor)) {
              eager_block_effects.delete(ancestor);
              ordered_effects.push(ancestor);
            }
            ancestor = ancestor.parent;
          }
          for (let j2 = ordered_effects.length - 1; j2 >= 0; j2--) {
            const e4 = ordered_effects[j2];
            if ((e4.f & 24576) !== 0) continue;
            update_effect(e4);
          }
        }
        eager_block_effects.clear();
      }
    }
  }
  eager_block_effects = null;
}
function mark_effects(value, sources, marked, checked) {
  if (marked.has(value)) return;
  marked.add(value);
  if (value.reactions !== null) for (const reaction of value.reactions) {
    const flags2 = reaction.f;
    if ((flags2 & 2) !== 0) mark_effects(reaction, sources, marked, checked);
    else if ((flags2 & 4194320) !== 0 && (flags2 & 2048) === 0 && depends_on(reaction, sources, checked)) {
      set_signal_status(reaction, DIRTY);
      schedule_effect(reaction);
    }
  }
}
function depends_on(reaction, sources, checked) {
  const depends = checked.get(reaction);
  if (depends !== void 0) return depends;
  if (reaction.deps !== null) for (const dep of reaction.deps) {
    if (includes.call(sources, dep)) return true;
    if ((dep.f & 2) !== 0 && depends_on(dep, sources, checked)) {
      checked.set(dep, true);
      return true;
    }
  }
  checked.set(reaction, false);
  return false;
}
function schedule_effect(effect) {
  current_batch.schedule(effect);
}
function reset_branch(effect, tracked) {
  if ((effect.f & 32) !== 0 && (effect.f & 1024) !== 0) return;
  if ((effect.f & 2048) !== 0) tracked.d.push(effect);
  else if ((effect.f & 4096) !== 0) tracked.m.push(effect);
  set_signal_status(effect, CLEAN);
  var e3 = effect.first;
  while (e3 !== null) {
    reset_branch(e3, tracked);
    e3 = e3.next;
  }
}
function reset_all(effect) {
  set_signal_status(effect, CLEAN);
  var e3 = effect.first;
  while (e3 !== null) {
    reset_all(e3);
    e3 = e3.next;
  }
}
function source(v, stack) {
  return {
    f: 0,
    v,
    reactions: null,
    equals,
    rv: 0,
    wv: 0
  };
}
// @__NO_SIDE_EFFECTS__
function state(v, stack) {
  const s3 = source(v, stack);
  push_reaction_value(s3);
  return s3;
}
// @__NO_SIDE_EFFECTS__
function mutable_source(initial_value, immutable2 = false, trackable = true) {
  const s3 = source(initial_value);
  if (!immutable2) s3.equals = safe_equals;
  if (legacy_mode_flag && trackable && component_context !== null && component_context.l !== null) (component_context.l.s ??= []).push(s3);
  return s3;
}
function set(source2, value, should_proxy = false) {
  if (active_reaction !== null && (!untracking || (active_reaction.f & 131072) !== 0) && is_runes() && (active_reaction.f & 4325394) !== 0 && (current_sources === null || !current_sources.has(source2))) state_unsafe_mutation();
  return internal_set(source2, should_proxy ? proxy(value) : value, legacy_updates);
}
function internal_set(source2, value, updated_during_traversal = null) {
  if (!source2.equals(value)) {
    if (is_destroying_effect) old_values.set(source2, value);
    else if (!old_values.has(source2)) old_values.set(source2, source2.v);
    var batch = Batch.ensure();
    batch.capture(source2, value);
    if ((source2.f & 2) !== 0) {
      const derived2 = source2;
      if ((source2.f & 2048) !== 0) execute_derived(derived2);
      if (batch_values === null) update_derived_status(derived2);
    }
    source2.wv = increment_write_version();
    mark_reactions(source2, DIRTY, updated_during_traversal);
    if (is_runes() && active_effect !== null && (active_effect.f & 1024) !== 0 && (active_effect.f & 96) === 0) {
      if (untracked_writes === null) set_untracked_writes([source2]);
      else untracked_writes.push(source2);
    }
    if (!batch.is_fork && eager_effects.size > 0 && !eager_effects_deferred) flush_eager_effects();
  }
  return value;
}
function flush_eager_effects() {
  eager_effects_deferred = false;
  for (const effect of eager_effects) {
    if ((effect.f & 1024) !== 0) set_signal_status(effect, MAYBE_DIRTY);
    let dirty;
    try {
      dirty = is_dirty(effect);
    } catch {
      dirty = true;
    }
    if (dirty) update_effect(effect);
  }
  eager_effects.clear();
}
function increment(source2) {
  set(source2, source2.v + 1);
}
function mark_reactions(signal, status, updated_during_traversal) {
  var reactions = signal.reactions;
  if (reactions === null) return;
  var runes = is_runes();
  var length = reactions.length;
  for (var i = 0; i < length; i++) {
    var reaction = reactions[i];
    var flags2 = reaction.f;
    if (!runes && reaction === active_effect) continue;
    var not_dirty = (flags2 & DIRTY) === 0;
    if (not_dirty) set_signal_status(reaction, status);
    if ((flags2 & 131072) !== 0) eager_effects.add(reaction);
    else if ((flags2 & 2) !== 0) {
      var derived2 = reaction;
      batch_values?.delete(derived2);
      if ((flags2 & 65536) === 0) {
        if (flags2 & 512 && (active_effect === null || (active_effect.f & 2097152) === 0)) reaction.f |= WAS_MARKED;
        mark_reactions(derived2, MAYBE_DIRTY, updated_during_traversal);
      }
    } else if (not_dirty) {
      var effect = reaction;
      if ((flags2 & 16) !== 0 && eager_block_effects !== null) eager_block_effects.add(effect);
      if (updated_during_traversal !== null) updated_during_traversal.push(effect);
      else schedule_effect(effect);
    }
  }
}
function proxy(value) {
  if (typeof value !== "object" || value === null || STATE_SYMBOL in value || COMPONENT_SYMBOL in value) return value;
  const prototype = get_prototype_of(value);
  if (prototype !== object_prototype && prototype !== array_prototype) return value;
  var sources = /* @__PURE__ */ new Map();
  var is_proxied_array = is_array(value);
  var version2 = /* @__PURE__ */ state(0);
  var stack = null;
  var parent_version = update_version;
  var with_parent = /* @__PURE__ */ __name((fn) => {
    if (update_version === parent_version) return fn();
    var reaction = active_reaction;
    var version3 = update_version;
    set_active_reaction(null);
    set_update_version(parent_version);
    var result = fn();
    set_active_reaction(reaction);
    set_update_version(version3);
    return result;
  }, "with_parent");
  if (is_proxied_array) sources.set("length", /* @__PURE__ */ state(
    /** @type {any[]} */
    value.length,
    stack
  ));
  return new Proxy(value, {
    defineProperty(_, prop, descriptor) {
      if (!("value" in descriptor) || descriptor.configurable === false || descriptor.enumerable === false || descriptor.writable === false) state_descriptors_fixed();
      var s3 = sources.get(prop);
      if (s3 === void 0) with_parent(() => {
        var s4 = /* @__PURE__ */ state(descriptor.value, stack);
        sources.set(prop, s4);
        return s4;
      });
      else set(s3, descriptor.value, true);
      return true;
    },
    deleteProperty(target, prop) {
      var s3 = sources.get(prop);
      if (s3 === void 0) {
        if (prop in target) {
          const s4 = with_parent(() => /* @__PURE__ */ state(UNINITIALIZED, stack));
          sources.set(prop, s4);
          increment(version2);
        }
      } else {
        set(s3, UNINITIALIZED);
        increment(version2);
      }
      return true;
    },
    get(target, prop, receiver) {
      if (prop === STATE_SYMBOL) return value;
      var s3 = sources.get(prop);
      var exists = prop in target;
      if (s3 === void 0 && (!exists || get_descriptor(target, prop)?.writable)) {
        s3 = with_parent(() => {
          return /* @__PURE__ */ state(proxy(exists ? target[prop] : UNINITIALIZED), stack);
        });
        sources.set(prop, s3);
      }
      if (s3 !== void 0) {
        var v = get(s3);
        return v === UNINITIALIZED ? void 0 : v;
      }
      return Reflect.get(target, prop, receiver);
    },
    getOwnPropertyDescriptor(target, prop) {
      var descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
      if (descriptor && "value" in descriptor) {
        var s3 = sources.get(prop);
        if (s3) descriptor.value = get(s3);
      } else if (descriptor === void 0) {
        var source2 = sources.get(prop);
        var value2 = source2?.v;
        if (source2 !== void 0 && value2 !== UNINITIALIZED) return {
          enumerable: true,
          configurable: true,
          value: value2,
          writable: true
        };
      }
      return descriptor;
    },
    has(target, prop) {
      if (prop === STATE_SYMBOL) return true;
      var s3 = sources.get(prop);
      var has = s3 !== void 0 && s3.v !== UNINITIALIZED || Reflect.has(target, prop);
      if (s3 !== void 0 || active_effect !== null && (!has || get_descriptor(target, prop)?.writable)) {
        if (s3 === void 0) {
          s3 = with_parent(() => {
            return /* @__PURE__ */ state(has ? proxy(target[prop]) : UNINITIALIZED, stack);
          });
          sources.set(prop, s3);
        }
        if (get(s3) === UNINITIALIZED) return false;
      }
      return has;
    },
    set(target, prop, value2, receiver) {
      var s3 = sources.get(prop);
      var has = prop in target;
      if (is_proxied_array && prop === "length") for (var i = value2; i < s3.v; i += 1) {
        var other_s = sources.get(i + "");
        if (other_s !== void 0) set(other_s, UNINITIALIZED);
        else if (i in target) {
          other_s = with_parent(() => /* @__PURE__ */ state(UNINITIALIZED, stack));
          sources.set(i + "", other_s);
        }
      }
      if (s3 === void 0) {
        if (!has || get_descriptor(target, prop)?.writable) {
          s3 = with_parent(() => /* @__PURE__ */ state(void 0, stack));
          set(s3, proxy(value2));
          sources.set(prop, s3);
        }
      } else {
        has = s3.v !== UNINITIALIZED;
        var p = with_parent(() => proxy(value2));
        set(s3, p);
      }
      var descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
      if (descriptor?.set) descriptor.set.call(receiver, value2);
      if (!has) {
        if (is_proxied_array && typeof prop === "string") {
          var ls = sources.get("length");
          var n2 = Number(prop);
          if (Number.isInteger(n2) && n2 >= ls.v) set(ls, n2 + 1);
        }
        increment(version2);
      }
      return true;
    },
    ownKeys(target) {
      get(version2);
      var own_keys = Reflect.ownKeys(target).filter((key3) => {
        var source3 = sources.get(key3);
        return source3 === void 0 || source3.v !== UNINITIALIZED;
      });
      for (var [key2, source2] of sources) if (source2.v !== UNINITIALIZED && !(key2 in target)) own_keys.push(key2);
      return own_keys;
    },
    setPrototypeOf() {
      state_prototype_fixed();
    }
  });
}
function init_operations() {
  if ($window !== void 0) return;
  $window = window;
  /Firefox/.test("Cloudflare-Workers");
  var element_prototype = Element.prototype;
  var node_prototype = Node.prototype;
  var text_prototype = Text.prototype;
  first_child_getter = get_descriptor(node_prototype, "firstChild").get;
  next_sibling_getter = get_descriptor(node_prototype, "nextSibling").get;
  if (is_extensible(element_prototype)) {
    element_prototype[CLASS_CACHE] = void 0;
    element_prototype[ATTRIBUTES_CACHE] = null;
    element_prototype[STYLE_CACHE] = void 0;
    element_prototype.__e = void 0;
  }
  if (is_extensible(text_prototype))
    text_prototype[TEXT_CACHE] = void 0;
}
function create_text(value = "") {
  return document.createTextNode(value);
}
// @__NO_SIDE_EFFECTS__
function get_first_child(node) {
  return first_child_getter.call(node);
}
// @__NO_SIDE_EFFECTS__
function get_next_sibling(node) {
  return next_sibling_getter.call(node);
}
function clear_text_content(node) {
  node.textContent = "";
}
function handle_error(error2) {
  var effect = active_effect;
  if (effect === null) {
    active_reaction.f |= ERROR_VALUE;
    return error2;
  }
  if ((effect.f & 32768) === 0 && (effect.f & 4) === 0) throw error2;
  invoke_error_boundary(error2, effect);
}
function invoke_error_boundary(error2, effect) {
  if (effect !== null && (effect.f & 16384) !== 0) return;
  while (effect !== null) {
    if ((effect.f & 128) !== 0 && (effect.f & 33570816) === 0) {
      if ((effect.f & 32768) === 0) throw error2;
      try {
        effect.b.error(error2);
        return;
      } catch (e3) {
        error2 = e3;
      }
    }
    effect = effect.parent;
  }
  throw error2;
}
function push_effect(effect, parent_effect) {
  var parent_last = parent_effect.last;
  if (parent_last === null) parent_effect.last = parent_effect.first = effect;
  else {
    parent_last.next = effect;
    effect.prev = parent_last;
    parent_effect.last = effect;
  }
}
function create_effect(type, fn) {
  var parent = active_effect;
  if (parent !== null && (parent.f & 8192) !== 0) type |= INERT;
  var effect = {
    ctx: component_context,
    deps: null,
    nodes: null,
    f: type | DIRTY | 512,
    first: null,
    fn,
    last: null,
    next: null,
    parent,
    b: parent && parent.b,
    prev: null,
    teardown: null,
    wv: 0,
    ac: null
  };
  current_batch?.register_created_effect(effect);
  var e3 = effect;
  if ((type & 4) !== 0) {
    if (collected_effects !== null) collected_effects.push(effect);
    else Batch.ensure().schedule(effect);
  } else if (fn !== null) {
    try {
      update_effect(effect);
    } catch (e4) {
      destroy_effect(effect);
      throw e4;
    }
    if (e3.deps === null && e3.teardown === null && e3.nodes === null && e3.first === e3.last && (e3.f & 524288) === 0) {
      e3 = e3.first;
      if ((type & 16) !== 0 && (type & 65536) !== 0 && e3 !== null) e3.f |= EFFECT_TRANSPARENT;
    }
  }
  if (e3 !== null) {
    e3.parent = parent;
    if (parent !== null) push_effect(e3, parent);
    if (active_reaction !== null && (active_reaction.f & 2) !== 0 && (type & 64) === 0) {
      var derived2 = active_reaction;
      (derived2.effects ??= []).push(e3);
    }
  }
  return effect;
}
function effect_tracking() {
  return active_reaction !== null && !untracking;
}
function create_user_effect(fn) {
  return create_effect(4 | USER_EFFECT, fn);
}
function component_root(fn) {
  Batch.ensure();
  const effect = create_effect(64 | EFFECT_PRESERVED, fn);
  return (options2 = {}) => {
    return new Promise((fulfil) => {
      if (options2.outro) pause_effect(effect, () => {
        destroy_effect(effect);
        fulfil(void 0);
      });
      else {
        destroy_effect(effect);
        fulfil(void 0);
      }
    });
  };
}
function render_effect(fn, flags2 = 0) {
  return create_effect(8 | flags2, fn);
}
function block(fn, flags2 = 0) {
  return create_effect(16 | flags2, fn);
}
function branch(fn) {
  return create_effect(32 | EFFECT_PRESERVED, fn);
}
function execute_effect_teardown(effect) {
  var teardown = effect.teardown;
  if (teardown !== null) {
    const previously_destroying_effect = is_destroying_effect;
    const previous_reaction = active_reaction;
    set_is_destroying_effect(true);
    set_active_reaction(null);
    try {
      teardown.call(null);
    } catch (error2) {
      invoke_error_boundary(error2, effect.parent);
    } finally {
      set_is_destroying_effect(previously_destroying_effect);
      set_active_reaction(previous_reaction);
    }
  }
}
function destroy_effect_children(signal, remove_dom = false) {
  var effect = signal.first;
  signal.first = signal.last = null;
  while (effect !== null) {
    const controller = effect.ac;
    if (controller !== null) without_reactive_context(() => {
      controller.abort(STALE_REACTION);
    });
    var next2 = effect.next;
    if ((effect.f & 64) !== 0) effect.parent = null;
    else destroy_effect(effect, remove_dom);
    effect = next2;
  }
}
function destroy_block_effect_children(signal) {
  var effect = signal.first;
  while (effect !== null) {
    var next2 = effect.next;
    if ((effect.f & 32) === 0) destroy_effect(effect);
    effect = next2;
  }
}
function destroy_effect(effect, remove_dom = true) {
  var removed = false;
  if ((remove_dom || (effect.f & 262144) !== 0) && effect.nodes !== null && effect.nodes.end !== null) {
    remove_effect_dom(effect.nodes.start, effect.nodes.end);
    removed = true;
  }
  effect.f |= DESTROYING;
  destroy_effect_children(effect, remove_dom && !removed);
  remove_reactions(effect, 0);
  var transitions = effect.nodes && effect.nodes.t;
  if (transitions !== null) for (const transition of transitions) transition.stop();
  execute_effect_teardown(effect);
  effect.f ^= DESTROYING;
  effect.f |= DESTROYED;
  var parent = effect.parent;
  if (parent !== null && parent.first !== null) unlink_effect(effect);
  effect.next = effect.prev = effect.teardown = effect.ctx = effect.deps = effect.fn = effect.nodes = effect.ac = effect.b = null;
}
function remove_effect_dom(node, end) {
  while (node !== null) {
    var next2 = node === end ? null : /* @__PURE__ */ get_next_sibling(node);
    node.remove();
    node = next2;
  }
}
function unlink_effect(effect) {
  var parent = effect.parent;
  var prev = effect.prev;
  var next2 = effect.next;
  if (prev !== null) prev.next = next2;
  if (next2 !== null) next2.prev = prev;
  if (parent !== null) {
    if (parent.first === effect) parent.first = next2;
    if (parent.last === effect) parent.last = prev;
  }
}
function pause_effect(effect, callback, destroy = true) {
  var transitions = [];
  effect.f |= 256;
  pause_children(effect, transitions, true);
  var fn = /* @__PURE__ */ __name(() => {
    if (destroy) destroy_effect(effect);
    if (callback) callback();
  }, "fn");
  var remaining = transitions.length;
  if (remaining > 0) {
    var check = /* @__PURE__ */ __name(() => --remaining || fn(), "check");
    for (var transition of transitions) transition.out(check);
  } else fn();
}
function pause_children(effect, transitions, local) {
  if ((effect.f & 8192) !== 0) return;
  effect.f ^= INERT;
  var t4 = effect.nodes && effect.nodes.t;
  if (t4 !== null) {
    for (const transition of t4) if (transition.is_global || local) transitions.push(transition);
  }
  var child = effect.first;
  while (child !== null) {
    var sibling = child.next;
    if ((child.f & 64) === 0) {
      var transparent = (child.f & 65536) !== 0 || (child.f & 32) !== 0 && (effect.f & 16) !== 0;
      pause_children(child, transitions, transparent ? local : false);
    }
    child = sibling;
  }
}
function move_effect(effect, fragment) {
  if (!effect.nodes) return;
  var node = effect.nodes.start;
  var end = effect.nodes.end;
  while (node !== null) {
    var next2 = node === end ? null : /* @__PURE__ */ get_next_sibling(node);
    fragment.append(node);
    node = next2;
  }
}
function set_is_destroying_effect(value) {
  is_destroying_effect = value;
}
function set_active_reaction(reaction) {
  active_reaction = reaction;
}
function set_active_effect(effect) {
  active_effect = effect;
}
function push_reaction_value(value) {
  if (active_reaction !== null && (!async_mode_flag || (active_reaction.f & 2) !== 0)) (current_sources ??= /* @__PURE__ */ new Set()).add(value);
}
function set_untracked_writes(value) {
  untracked_writes = value;
}
function set_update_version(value) {
  update_version = value;
}
function increment_write_version() {
  return ++write_version;
}
function is_dirty(reaction) {
  var flags2 = reaction.f;
  if ((flags2 & 2048) !== 0) return true;
  if (flags2 & 2) reaction.f &= ~WAS_MARKED;
  if ((flags2 & 4096) !== 0) {
    var dependencies = reaction.deps;
    var length = dependencies.length;
    for (var i = 0; i < length; i++) {
      var dependency = dependencies[i];
      if (is_dirty(dependency)) update_derived(dependency);
      if (dependency.wv > reaction.wv) return true;
    }
    if ((flags2 & 512) !== 0 && batch_values === null) set_signal_status(reaction, CLEAN);
  }
  return false;
}
function schedule_possible_effect_self_invalidation(signal, effect, root = true) {
  var reactions = signal.reactions;
  if (reactions === null) return;
  if (!async_mode_flag && current_sources !== null && current_sources.has(signal)) return;
  for (var i = 0; i < reactions.length; i++) {
    var reaction = reactions[i];
    if ((reaction.f & 2) !== 0) schedule_possible_effect_self_invalidation(reaction, effect, false);
    else if (effect === reaction) {
      if (root) set_signal_status(reaction, DIRTY);
      else if ((reaction.f & 1024) !== 0) set_signal_status(reaction, MAYBE_DIRTY);
      schedule_effect(reaction);
    }
  }
}
function update_reaction(reaction) {
  var previous_deps = new_deps;
  var previous_skipped_deps = skipped_deps;
  var previous_untracked_writes = untracked_writes;
  var previous_reaction = active_reaction;
  var previous_sources = current_sources;
  var previous_component_context = component_context;
  var previous_untracking = untracking;
  var previous_update_version = update_version;
  var flags2 = reaction.f;
  new_deps = null;
  skipped_deps = 0;
  untracked_writes = null;
  active_reaction = (flags2 & 96) === 0 ? reaction : null;
  current_sources = null;
  set_component_context(reaction.ctx);
  untracking = false;
  update_version = ++read_version;
  if (reaction.ac !== null) {
    without_reactive_context(() => {
      reaction.ac.abort(STALE_REACTION);
    });
    reaction.ac = null;
  }
  try {
    reaction.f |= REACTION_IS_UPDATING;
    var fn = reaction.fn;
    var result = fn();
    reaction.f |= REACTION_RAN;
    var deps = update_dependencies(reaction);
    if (is_runes() && untracked_writes !== null && !untracking && deps !== null && (reaction.f & 6146) === 0) for (var i = 0; i < untracked_writes.length; i++) schedule_possible_effect_self_invalidation(untracked_writes[i], reaction);
    if (previous_reaction !== null && previous_reaction !== reaction) {
      read_version++;
      if (previous_reaction.deps !== null) for (let i2 = 0; i2 < previous_skipped_deps; i2 += 1) previous_reaction.deps[i2].rv = read_version;
      if (previous_deps !== null) for (const dep of previous_deps) dep.rv = read_version;
      if (untracked_writes !== null) {
        if (previous_untracked_writes === null) previous_untracked_writes = untracked_writes;
        else previous_untracked_writes.push(...untracked_writes);
      }
    }
    if ((reaction.f & 8388608) !== 0) reaction.f ^= ERROR_VALUE;
    return result;
  } catch (error2) {
    update_dependencies(reaction);
    return handle_error(error2);
  } finally {
    reaction.f ^= REACTION_IS_UPDATING;
    new_deps = previous_deps;
    skipped_deps = previous_skipped_deps;
    untracked_writes = previous_untracked_writes;
    active_reaction = previous_reaction;
    current_sources = previous_sources;
    set_component_context(previous_component_context);
    untracking = previous_untracking;
    update_version = previous_update_version;
  }
}
function update_dependencies(reaction) {
  var deps = reaction.deps;
  var is_fork = current_batch?.is_fork;
  if (new_deps !== null) {
    var i;
    if (!is_fork) remove_reactions(reaction, skipped_deps);
    if (deps !== null && skipped_deps > 0) {
      deps.length = skipped_deps + new_deps.length;
      for (i = 0; i < new_deps.length; i++) deps[skipped_deps + i] = new_deps[i];
    } else reaction.deps = deps = new_deps;
    if (effect_tracking() && (reaction.f & 512) !== 0) for (i = skipped_deps; i < deps.length; i++) (deps[i].reactions ??= []).push(reaction);
  } else if (!is_fork && deps !== null && skipped_deps < deps.length) {
    remove_reactions(reaction, skipped_deps);
    deps.length = skipped_deps;
  }
  return deps;
}
function remove_reaction(signal, dependency) {
  let reactions = dependency.reactions;
  if (reactions !== null) {
    var index23 = index_of.call(reactions, signal);
    if (index23 !== -1) {
      var new_length = reactions.length - 1;
      if (new_length === 0) reactions = dependency.reactions = null;
      else {
        reactions[index23] = reactions[new_length];
        reactions.pop();
      }
    }
  }
  if (reactions === null && (dependency.f & 2) !== 0 && (new_deps === null || !includes.call(new_deps, dependency))) {
    var derived2 = dependency;
    if ((derived2.f & 512) !== 0) {
      derived2.f ^= 512;
      derived2.f &= ~WAS_MARKED;
    }
    if (derived2.v !== UNINITIALIZED) update_derived_status(derived2);
    if (derived2.ac !== null) without_reactive_context(() => {
      derived2.ac.abort(STALE_REACTION);
      derived2.ac = null;
      set_signal_status(derived2, DIRTY);
    });
    freeze_derived_effects(derived2);
    remove_reactions(derived2, 0);
  }
}
function remove_reactions(signal, start_index) {
  var dependencies = signal.deps;
  if (dependencies === null) return;
  for (var i = start_index; i < dependencies.length; i++) remove_reaction(signal, dependencies[i]);
}
function update_effect(effect) {
  var flags2 = effect.f;
  if ((flags2 & 16384) !== 0) return;
  set_signal_status(effect, CLEAN);
  var previous_effect = active_effect;
  var was_updating_effect = is_updating_effect;
  active_effect = effect;
  is_updating_effect = (flags2 & 96) === 0;
  try {
    if ((flags2 & 16777232) !== 0) destroy_block_effect_children(effect);
    else destroy_effect_children(effect);
    execute_effect_teardown(effect);
    var teardown = update_reaction(effect);
    effect.teardown = typeof teardown === "function" ? teardown : null;
    effect.wv = write_version;
  } finally {
    is_updating_effect = was_updating_effect;
    active_effect = previous_effect;
  }
}
function get(signal) {
  var is_derived = (signal.f & 2) !== 0;
  captured_signals?.add(signal);
  if (active_reaction !== null && !untracking) {
    if (!(active_effect !== null && (active_effect.f & 16384) !== 0) && (current_sources === null || !current_sources.has(signal))) {
      var deps = active_reaction.deps;
      if ((active_reaction.f & 2097152) !== 0) {
        if (signal.rv < read_version) {
          signal.rv = read_version;
          if (new_deps === null && deps !== null && deps[skipped_deps] === signal) skipped_deps++;
          else if (new_deps === null) new_deps = [signal];
          else new_deps.push(signal);
        }
      } else {
        active_reaction.deps ??= [];
        if (!includes.call(active_reaction.deps, signal)) active_reaction.deps.push(signal);
        var reactions = signal.reactions;
        if (reactions === null) signal.reactions = [active_reaction];
        else if (!includes.call(reactions, active_reaction)) reactions.push(active_reaction);
      }
    }
  }
  if (is_destroying_effect && old_values.has(signal)) return old_values.get(signal);
  if (is_derived) {
    var derived2 = signal;
    if (is_destroying_effect) {
      var value = derived2.v;
      if ((derived2.f & 1024) === 0 && derived2.reactions !== null || depends_on_old_values(derived2)) value = execute_derived(derived2);
      old_values.set(derived2, value);
      return value;
    }
    var should_connect = (derived2.f & 512) === 0 && !untracking && active_reaction !== null && (is_updating_effect || (active_reaction.f & 512) !== 0);
    var is_new = (derived2.f & REACTION_RAN) === 0;
    if (is_dirty(derived2)) {
      if (should_connect) derived2.f |= 512;
      update_derived(derived2);
    }
    if (should_connect && !is_new) {
      unfreeze_derived_effects(derived2);
      reconnect(derived2);
    }
  }
  if (batch_values?.has(signal)) return batch_values.get(signal);
  if ((signal.f & 8388608) !== 0) throw signal.v;
  return signal.v;
}
function reconnect(derived2) {
  derived2.f |= 512;
  if (derived2.deps === null) return;
  for (const dep of derived2.deps) {
    (dep.reactions ??= []).push(derived2);
    if ((dep.f & 2) !== 0 && (dep.f & 512) === 0) {
      unfreeze_derived_effects(dep);
      reconnect(dep);
    }
  }
}
function depends_on_old_values(derived2) {
  if (derived2.v === UNINITIALIZED) return true;
  if (derived2.deps === null) return false;
  for (const dep of derived2.deps) {
    if (old_values.has(dep)) return true;
    if ((dep.f & 2) !== 0 && depends_on_old_values(dep)) return true;
  }
  return false;
}
function untrack(fn) {
  var previous_untracking = untracking;
  try {
    untracking = true;
    return fn();
  } finally {
    untracking = previous_untracking;
  }
}
function readable(value, start) {
  return { subscribe: writable(value, start).subscribe };
}
function writable(value, start = noop) {
  let stop = null;
  const subscribers = /* @__PURE__ */ new Set();
  function set2(new_value) {
    if (safe_not_equal(value, new_value)) {
      value = new_value;
      if (stop) {
        const run_queue = !subscriber_queue.length;
        for (const subscriber of subscribers) {
          subscriber[1]();
          subscriber_queue.push(subscriber, value);
        }
        if (run_queue) {
          for (let i = 0; i < subscriber_queue.length; i += 2) subscriber_queue[i][0](subscriber_queue[i + 1]);
          subscriber_queue.length = 0;
        }
      }
    }
  }
  __name(set2, "set");
  function update(fn) {
    set2(fn(value));
  }
  __name(update, "update");
  function subscribe(run3, invalidate = noop) {
    const subscriber = [run3, invalidate];
    subscribers.add(subscriber);
    if (subscribers.size === 1) stop = start(set2, update) || noop;
    run3(value);
    return () => {
      subscribers.delete(subscriber);
      if (subscribers.size === 0 && stop) {
        stop();
        stop = null;
      }
    };
  }
  __name(subscribe, "subscribe");
  return {
    set: set2,
    update,
    subscribe
  };
}
function is_void(name) {
  return VOID_ELEMENT_NAMES.includes(name) || name.toLowerCase() === "!doctype";
}
function is_boolean_attribute(name) {
  return DOM_BOOLEAN_ATTRIBUTES.includes(name);
}
function is_passive_event(name) {
  return PASSIVE_EVENTS.includes(name);
}
function is_raw_text_element(name) {
  return RAW_TEXT_ELEMENTS.includes(name);
}
function escape_html(value, is_attr) {
  const str = String(value ?? "");
  const pattern2 = is_attr ? ATTR_REGEX : CONTENT_REGEX;
  pattern2.lastIndex = 0;
  let escaped2 = "";
  let last = 0;
  while (pattern2.test(str)) {
    const i = pattern2.lastIndex - 1;
    const ch = str[i];
    escaped2 += str.substring(last, i) + (ch === "&" ? "&amp;" : ch === '"' ? "&quot;" : "&lt;");
    last = i + 1;
  }
  return escaped2 + str.substring(last);
}
function r(e3) {
  var t4, f, n2 = "";
  if ("string" == typeof e3 || "number" == typeof e3) n2 += e3;
  else if ("object" == typeof e3) if (Array.isArray(e3)) {
    var o3 = e3.length;
    for (t4 = 0; t4 < o3; t4++) e3[t4] && (f = r(e3[t4])) && (n2 && (n2 += " "), n2 += f);
  } else for (f in e3) e3[f] && (n2 && (n2 += " "), n2 += f);
  return n2;
}
function clsx$1() {
  for (var e3, t4, f = 0, n2 = "", o3 = arguments.length; f < o3; f++) (e3 = arguments[f]) && (t4 = r(e3)) && (n2 && (n2 += " "), n2 += t4);
  return n2;
}
function attr(name, value, is_boolean = false) {
  if (name === "hidden" && value !== "until-found") is_boolean = true;
  if (value == null || is_boolean && !value && value !== "") return "";
  const normalized = has_own_property.call(replacements, name) && replacements[name].get(value) || value;
  return ` ${name}${is_boolean ? `=""` : `="${escape_html(normalized, true)}"`}`;
}
function clsx(value) {
  if (typeof value === "object") return clsx$1(value);
  else return value ?? "";
}
function to_class(value, hash2, directives) {
  var classname = value == null ? "" : "" + value;
  if (hash2) classname = classname ? classname + " " + hash2 : hash2;
  if (directives) {
    for (var key2 of Object.keys(directives)) if (directives[key2]) classname = classname ? classname + " " + key2 : key2;
    else if (classname.length) {
      var len = key2.length;
      var a2 = 0;
      while ((a2 = classname.indexOf(key2, a2)) >= 0) {
        var b = a2 + len;
        if ((a2 === 0 || whitespace.includes(classname[a2 - 1])) && (b === classname.length || whitespace.includes(classname[b]))) classname = (a2 === 0 ? "" : classname.substring(0, a2)) + classname.substring(b + 1);
        else a2 = b;
      }
    }
  }
  return classname === "" ? null : classname;
}
function append_styles(styles, important = false) {
  var separator = important ? " !important;" : ";";
  var css = "";
  for (var key2 of Object.keys(styles)) {
    var value = styles[key2];
    if (value != null && value !== "") css += " " + key2 + ": " + value + separator;
  }
  return css;
}
function to_css_name(name) {
  if (name[0] !== "-" || name[1] !== "-") return name.toLowerCase();
  return name;
}
function to_style(value, styles) {
  if (styles) {
    var new_style = "";
    var normal_styles;
    var important_styles;
    if (Array.isArray(styles)) {
      normal_styles = styles[0];
      important_styles = styles[1];
    } else normal_styles = styles;
    if (value) {
      value = String(value).replaceAll(/\/\*.*?\*\//g, "").trim();
      var in_str = false;
      var in_apo = 0;
      var in_comment = false;
      var reserved_names = [];
      if (normal_styles) reserved_names.push(...Object.keys(normal_styles).map(to_css_name));
      if (important_styles) reserved_names.push(...Object.keys(important_styles).map(to_css_name));
      var start_index = 0;
      var name_index = -1;
      const len = value.length;
      for (var i = 0; i < len; i++) {
        var c2 = value[i];
        if (in_comment) {
          if (c2 === "/" && value[i - 1] === "*") in_comment = false;
        } else if (in_str) {
          if (in_str === c2) in_str = false;
        } else if (c2 === "/" && value[i + 1] === "*") in_comment = true;
        else if (c2 === '"' || c2 === "'") in_str = c2;
        else if (c2 === "(") in_apo++;
        else if (c2 === ")") in_apo--;
        if (!in_comment && in_str === false && in_apo === 0) {
          if (c2 === ":" && name_index === -1) name_index = i;
          else if (c2 === ";" || i === len - 1) {
            if (name_index !== -1) {
              var name = to_css_name(value.substring(start_index, name_index).trim());
              if (!reserved_names.includes(name)) {
                if (c2 !== ";") i++;
                var property = value.substring(start_index, i).trim();
                new_style += " " + property + ";";
              }
            }
            start_index = i + 1;
            name_index = -1;
          }
        }
      }
    }
    if (normal_styles) new_style += append_styles(normal_styles);
    if (important_styles) new_style += append_styles(important_styles, true);
    new_style = new_style.trim();
    return new_style === "" ? null : new_style;
  }
  return value == null ? null : String(value);
}
function set_ssr_context(v) {
  ssr_context = v;
}
function createContext() {
  return create_context(getContext, setContext, hasContext);
}
function getContext(key2) {
  return get_or_init_context_map(ssr_context, "getContext").get(key2);
}
function setContext(key2, context3) {
  get_or_init_context_map(ssr_context, "setContext").set(key2, context3);
  return context3;
}
function hasContext(key2) {
  return get_or_init_context_map(ssr_context, "hasContext").has(key2);
}
function getAllContexts() {
  return get_or_init_context_map(ssr_context, "getAllContexts");
}
function push(fn) {
  ssr_context = {
    p: ssr_context,
    c: null,
    r: null
  };
}
function pop() {
  ssr_context = ssr_context.p;
}
function async_local_storage_unavailable() {
  const error2 = /* @__PURE__ */ new Error(`async_local_storage_unavailable
The node API \`AsyncLocalStorage\` is not available, but is required to use async server rendering.
https://svelte.dev/e/async_local_storage_unavailable`);
  error2.name = "Svelte error";
  throw error2;
}
function await_invalid() {
  const error2 = /* @__PURE__ */ new Error(`await_invalid
Encountered asynchronous work while rendering synchronously.
https://svelte.dev/e/await_invalid`);
  error2.name = "Svelte error";
  throw error2;
}
function dynamic_element_invalid_tag(tag) {
  const error2 = /* @__PURE__ */ new Error(`dynamic_element_invalid_tag
\`<svelte:element this="${tag}">\` is not a valid element name \u2014 the element will not be rendered
https://svelte.dev/e/dynamic_element_invalid_tag`);
  error2.name = "Svelte error";
  throw error2;
}
function html_deprecated() {
  const error2 = /* @__PURE__ */ new Error(`html_deprecated
The \`html\` property of server render results has been deprecated. Use \`body\` instead.
https://svelte.dev/e/html_deprecated`);
  error2.name = "Svelte error";
  throw error2;
}
function hydratable_serialization_failed(key2, stack) {
  const error2 = /* @__PURE__ */ new Error(`hydratable_serialization_failed
Failed to serialize \`hydratable\` data for key \`${key2}\`.

\`hydratable\` can serialize anything [\`uneval\` from \`devalue\`](https://npmjs.com/package/uneval) can, plus Promises.

Cause:
${stack}
https://svelte.dev/e/hydratable_serialization_failed`);
  error2.name = "Svelte error";
  throw error2;
}
function invalid_csp() {
  const error2 = /* @__PURE__ */ new Error(`invalid_csp
\`csp.nonce\` was set while \`csp.hash\` was \`true\`. These options cannot be used simultaneously.
https://svelte.dev/e/invalid_csp`);
  error2.name = "Svelte error";
  throw error2;
}
function invalid_id_prefix() {
  const error2 = /* @__PURE__ */ new Error(`invalid_id_prefix
The \`idPrefix\` option cannot include \`--\`.
https://svelte.dev/e/invalid_id_prefix`);
  error2.name = "Svelte error";
  throw error2;
}
function lifecycle_function_unavailable(name) {
  const error2 = /* @__PURE__ */ new Error(`lifecycle_function_unavailable
\`${name}(...)\` is not available on the server
https://svelte.dev/e/lifecycle_function_unavailable`);
  error2.name = "Svelte error";
  throw error2;
}
function server_context_required() {
  const error2 = /* @__PURE__ */ new Error(`server_context_required
Could not resolve \`render\` context.
https://svelte.dev/e/server_context_required`);
  error2.name = "Svelte error";
  throw error2;
}
function unresolved_hydratable(key2, stack) {
  console.warn(`https://svelte.dev/e/unresolved_hydratable`);
}
function get_render_context() {
  const store = context ?? als?.getStore();
  if (!store) server_context_required();
  return store;
}
async function with_render_context(fn) {
  context = { hydratable: {
    lookup: /* @__PURE__ */ new Map(),
    comparisons: [],
    unresolved_promises: /* @__PURE__ */ new Map()
  } };
  if (in_webcontainer()) {
    const { promise, resolve: resolve2 } = deferred();
    const previous_render = current_render;
    current_render = promise;
    await previous_render;
    return fn().finally(resolve2);
  }
  try {
    if (als === null) async_local_storage_unavailable();
    return als.run(context, fn);
  } finally {
    context = null;
  }
}
function init_render_context() {
  als_import ??= import("node:async_hooks").then((hooks) => {
    als = new hooks.AsyncLocalStorage();
  }).then(noop, noop);
  return als_import;
}
function in_webcontainer() {
  return !!globalThis.process?.versions?.webcontainer;
}
async function sha256(data) {
  text_encoder ??= new TextEncoder();
  crypto2 ??= globalThis.crypto?.subtle?.digest ? globalThis.crypto : (await obfuscated_import("node:crypto")).webcrypto;
  return base64_encode(await crypto2.subtle.digest("SHA-256", text_encoder.encode(data)));
}
function base64_encode(bytes) {
  if (globalThis.Buffer) return globalThis.Buffer.from(bytes).toString("base64");
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
function element(renderer, tag, attributes_fn = noop, children_fn = noop) {
  renderer.push("<!---->");
  if (tag) {
    if (!REGEX_VALID_TAG_NAME.test(tag)) dynamic_element_invalid_tag(tag);
    renderer.push(`<${tag}`);
    attributes_fn();
    renderer.push(`>`);
    if (!is_void(tag)) {
      children_fn();
      if (!is_raw_text_element(tag)) renderer.push(EMPTY_COMMENT);
      renderer.push(`</${tag}>`);
    }
  }
  renderer.push("<!---->");
}
function render(component22, options2 = {}) {
  if (options2.csp?.hash && options2.csp.nonce) invalid_csp();
  return Renderer.render(component22, options2);
}
function head(hash2, renderer, fn) {
  renderer.head((renderer2) => {
    renderer2.push(`<!--${hash2}-->`);
    renderer2.child(fn);
    renderer2.push(EMPTY_COMMENT);
  });
}
function attributes(attrs, css_hash, classes, styles, flags2 = 0) {
  if (styles) attrs.style = to_style(attrs.style, styles);
  if (attrs.class) attrs.class = clsx(attrs.class);
  if (css_hash || classes) attrs.class = to_class(attrs.class, css_hash, classes);
  let attr_str = "";
  let name;
  const is_html = (flags2 & 1) === 0;
  const lowercase = (flags2 & 2) === 0;
  const is_input = (flags2 & 4) !== 0;
  for (name of Object.keys(attrs)) {
    if (typeof attrs[name] === "function") continue;
    if (name[0] === "$" && name[1] === "$") continue;
    if (name === "" || INVALID_ATTR_NAME_CHAR_REGEX.test(name)) continue;
    var value = attrs[name];
    var lower = name.toLowerCase();
    if (lowercase) name = lower;
    if (lower.length > 2 && lower.startsWith("on")) continue;
    if (is_input) {
      if (name === "defaultvalue" || name === "defaultchecked") {
        name = name === "defaultvalue" ? "value" : "checked";
        if (attrs[name]) continue;
      }
    }
    attr_str += attr(name, value, is_html && is_boolean_attribute(name));
  }
  return attr_str;
}
function spread_props(props) {
  const merged_props = {};
  let key2;
  for (let i = 0; i < props.length; i++) {
    const obj = props[i];
    if (obj == null) continue;
    for (key2 of Object.keys(obj)) {
      const desc = Object.getOwnPropertyDescriptor(obj, key2);
      if (desc) Object.defineProperty(merged_props, key2, desc);
      else merged_props[key2] = obj[key2];
    }
  }
  return merged_props;
}
function stringify(value) {
  return typeof value === "string" ? value : value == null ? "" : value + "";
}
function attr_class(value, hash2, directives) {
  var result = to_class(value, hash2, directives);
  return result ? ` class="${escape_html(result, true)}"` : "";
}
function attr_style(value, directives) {
  var result = to_style(value, directives);
  return result ? ` style="${escape_html(result, true)}"` : "";
}
function bind_props(props_parent, props_now) {
  for (const key2 of Object.keys(props_now)) {
    const initial_value = props_parent[key2];
    const value = props_now[key2];
    if (initial_value === void 0 && value !== void 0 && Object.getOwnPropertyDescriptor(props_parent, key2)?.set) props_parent[key2] = value;
  }
}
function ensure_array_like(array_like_or_iterator) {
  if (array_like_or_iterator) return array_like_or_iterator.length !== void 0 ? array_like_or_iterator : Array.from(array_like_or_iterator);
  return [];
}
function once(get_value) {
  let value = UNINITIALIZED;
  return () => {
    if (value === UNINITIALIZED) value = get_value();
    return value;
  };
}
function derived(fn) {
  const get_value = ssr_context === null ? fn : once(fn);
  let updated_value;
  return function(new_value) {
    if (arguments.length === 0) return updated_value ?? get_value();
    updated_value = new_value;
    return updated_value;
  };
}
var is_array, index_of, includes, array_from, define_property, get_descriptor, object_prototype, array_prototype, get_prototype_of, is_extensible, has_own_property, noop, CLEAN, DIRTY, MAYBE_DIRTY, INERT, DESTROYED, REACTION_RAN, DESTROYING, EFFECT_TRANSPARENT, EFFECT_PRESERVED, USER_EFFECT, WAS_MARKED, REACTION_IS_UPDATING, ERROR_VALUE, STATE_SYMBOL, COMPONENT_SYMBOL, LEGACY_PROPS, ATTRIBUTES_CACHE, CLASS_CACHE, STYLE_CACHE, TEXT_CACHE, STALE_REACTION, HYDRATION_ERROR, UNINITIALIZED, hydrating, hydrate_node, async_mode_flag, legacy_mode_flag, component_context, micro_tasks, STATUS_MASK, legacy_is_updating_store, OBSOLETE, first_batch, last_batch, current_batch, previous_batch, batch_values, last_scheduled_effect, is_flushing_sync, is_processing, collected_effects, legacy_updates, flush_count, uid, Batch, eager_block_effects, eager_effects, old_values, eager_effects_deferred, $window, first_child_getter, next_sibling_getter, captured_signals, is_updating_effect, is_destroying_effect, active_reaction, untracking, active_effect, current_sources, new_deps, skipped_deps, untracked_writes, write_version, read_version, update_version, subscriber_queue, VOID_ELEMENT_NAMES, DOM_BOOLEAN_ATTRIBUTES, PASSIVE_EVENTS, RAW_TEXT_ELEMENTS, REGEX_VALID_TAG_NAME, ATTR_REGEX, CONTENT_REGEX, replacements, whitespace, BLOCK_OPEN, BLOCK_CLOSE, EMPTY_COMMENT, ssr_context, current_render, context, als, als_import, text_encoder, crypto2, obfuscated_import, Renderer, SSRState, INVALID_ATTR_NAME_CHAR_REGEX;
var init_server = __esm({
  ".svelte-kit/output/server/chunks/server.js"() {
    init_uneval();
    is_array = Array.isArray;
    index_of = Array.prototype.indexOf;
    includes = Array.prototype.includes;
    array_from = Array.from;
    define_property = Object.defineProperty;
    get_descriptor = Object.getOwnPropertyDescriptor;
    object_prototype = Object.prototype;
    array_prototype = Array.prototype;
    get_prototype_of = Object.getPrototypeOf;
    is_extensible = Object.isExtensible;
    has_own_property = Object.prototype.hasOwnProperty;
    noop = /* @__PURE__ */ __name(() => {
    }, "noop");
    __name(run, "run");
    __name(run_all, "run_all");
    __name(deferred, "deferred");
    __name(equals, "equals");
    __name(safe_not_equal, "safe_not_equal");
    __name(safe_equals, "safe_equals");
    CLEAN = 1024;
    DIRTY = 2048;
    MAYBE_DIRTY = 4096;
    INERT = 8192;
    DESTROYED = 16384;
    REACTION_RAN = 32768;
    DESTROYING = 1 << 25;
    EFFECT_TRANSPARENT = 65536;
    EFFECT_PRESERVED = 1 << 19;
    USER_EFFECT = 1 << 20;
    WAS_MARKED = 65536;
    REACTION_IS_UPDATING = 1 << 21;
    ERROR_VALUE = 1 << 23;
    STATE_SYMBOL = /* @__PURE__ */ Symbol("$state");
    COMPONENT_SYMBOL = /* @__PURE__ */ Symbol("component");
    LEGACY_PROPS = /* @__PURE__ */ Symbol("legacy props");
    ATTRIBUTES_CACHE = /* @__PURE__ */ Symbol("attributes");
    CLASS_CACHE = /* @__PURE__ */ Symbol("class");
    STYLE_CACHE = /* @__PURE__ */ Symbol("style");
    TEXT_CACHE = /* @__PURE__ */ Symbol("text");
    STALE_REACTION = new class StaleReactionError extends Error {
      static {
        __name(this, "StaleReactionError");
      }
      name = "StaleReactionError";
      message = "The reaction that called `getAbortSignal()` was re-run or destroyed";
    }();
    globalThis.document?.contentType;
    HYDRATION_ERROR = {};
    UNINITIALIZED = /* @__PURE__ */ Symbol("uninitialized");
    __name(derived_inert, "derived_inert");
    __name(hydration_mismatch, "hydration_mismatch");
    __name(svelte_boundary_reset_noop, "svelte_boundary_reset_noop");
    hydrating = false;
    __name(set_hydrating, "set_hydrating");
    __name(set_hydrate_node, "set_hydrate_node");
    __name(hydrate_next, "hydrate_next");
    __name(next, "next");
    __name(skip_nodes, "skip_nodes");
    __name(experimental_async_required, "experimental_async_required");
    __name(lifecycle_outside_component, "lifecycle_outside_component");
    __name(missing_context, "missing_context");
    __name(effect_update_depth_exceeded, "effect_update_depth_exceeded");
    __name(hydration_failed, "hydration_failed");
    __name(state_descriptors_fixed, "state_descriptors_fixed");
    __name(state_prototype_fixed, "state_prototype_fixed");
    __name(state_unsafe_mutation, "state_unsafe_mutation");
    __name(svelte_boundary_reset_onerror, "svelte_boundary_reset_onerror");
    async_mode_flag = false;
    legacy_mode_flag = false;
    __name(create_context, "create_context");
    __name(get_parent_context, "get_parent_context");
    __name(get_or_init_context_map, "get_or_init_context_map");
    component_context = null;
    __name(set_component_context, "set_component_context");
    __name(push$1, "push$1");
    __name(pop$1, "pop$1");
    __name(mark_as_component, "mark_as_component");
    __name(is_runes, "is_runes");
    micro_tasks = [];
    __name(run_micro_tasks, "run_micro_tasks");
    __name(queue_micro_task, "queue_micro_task");
    __name(flush_tasks, "flush_tasks");
    STATUS_MASK = ~(DIRTY | MAYBE_DIRTY | CLEAN);
    __name(set_signal_status, "set_signal_status");
    __name(update_derived_status, "update_derived_status");
    __name(clear_marked, "clear_marked");
    __name(defer_effect, "defer_effect");
    legacy_is_updating_store = false;
    __name(without_reactive_context, "without_reactive_context");
    OBSOLETE = /* @__PURE__ */ Symbol("obsolete");
    __name(destroy_derived_effects, "destroy_derived_effects");
    __name(execute_derived, "execute_derived");
    __name(update_derived, "update_derived");
    __name(freeze_derived_effects, "freeze_derived_effects");
    __name(unfreeze_derived_effects, "unfreeze_derived_effects");
    first_batch = null;
    last_batch = null;
    current_batch = null;
    previous_batch = null;
    batch_values = null;
    last_scheduled_effect = null;
    is_flushing_sync = false;
    is_processing = false;
    collected_effects = null;
    legacy_updates = null;
    flush_count = 0;
    uid = 1;
    Batch = class Batch2 {
      static {
        __name(this, "Batch");
      }
      id = uid++;
      /** True as soon as `#process` was called */
      #started = false;
      linked = true;
      /** @type {Batch | null} */
      #prev = null;
      /** @type {Batch | null} */
      #next = null;
      /** @type {Map<Effect, ReturnType<typeof deferred<any>>>} */
      async_deriveds = /* @__PURE__ */ new Map();
      /**
      * The current values of any signals that are updated in this batch.
      * Tuple format: [value, is_derived] (note: is_derived is false for deriveds, too, if they were overridden via assignment)
      * They keys of this map are identical to `this.#previous`
      * @type {Map<Value, [any, boolean]>}
      */
      current = /* @__PURE__ */ new Map();
      /**
      * The values of any signals (sources and deriveds) that are updated in this batch _before_ those updates took place.
      * They keys of this map are identical to `this.#current`
      * @type {Map<Value, any>}
      */
      previous = /* @__PURE__ */ new Map();
      /**
      * When the batch is committed (and the DOM is updated), we need to remove old branches
      * and append new ones by calling the functions added inside (if/each/key/etc) blocks
      * @type {Set<(batch: Batch) => void>}
      */
      #commit_callbacks = /* @__PURE__ */ new Set();
      /**
      * If a fork is discarded, we need to destroy any effects that are no longer needed
      * @type {Set<(batch: Batch) => void>}
      */
      #discard_callbacks = /* @__PURE__ */ new Set();
      /**
      * The number of async effects that are currently in flight
      */
      #pending = 0;
      /**
      * Async effects that are currently in flight, _not_ inside a pending boundary
      * @type {Map<Effect, number>}
      */
      #blocking_pending = /* @__PURE__ */ new Map();
      /**
      * A deferred that resolves when the batch is committed, used with `settled()`
      * TODO replace with Promise.withResolvers once supported widely enough
      * @type {{ promise: Promise<void>, resolve: (value?: any) => void, reject: (reason: unknown) => void } | null}
      */
      #deferred = null;
      /**
      * The root effects that need to be flushed
      * @type {Effect[]}
      */
      #roots = [];
      /**
      * Effects created while this batch was active.
      * @type {Effect[]}
      */
      #new_effects = [];
      /**
      * Deferred effects (which run after async work has completed) that are DIRTY
      * @type {Set<Effect>}
      */
      #dirty_effects = /* @__PURE__ */ new Set();
      /**
      * Deferred effects that are MAYBE_DIRTY
      * @type {Set<Effect>}
      */
      #maybe_dirty_effects = /* @__PURE__ */ new Set();
      /**
      * A map of branches that still exist, but will be destroyed when this batch
      * is committed — we skip over these during `process`.
      * The value contains child effects that were dirty/maybe_dirty before being reset,
      * so they can be rescheduled if the branch survives.
      * @type {Map<Effect, { d: Effect[], m: Effect[] }>}
      */
      #skipped_branches = /* @__PURE__ */ new Map();
      /**
      * Inverse of #skipped_branches which we need to tell prior batches to unskip them when committing
      * @type {Set<Effect>}
      */
      #unskipped_branches = /* @__PURE__ */ new Set();
      is_fork = false;
      #decrement_queued = false;
      constructor() {
        if (last_batch === null) first_batch = last_batch = this;
        else {
          last_batch.#next = this;
          this.#prev = last_batch;
        }
        last_batch = this;
      }
      #is_deferred() {
        if (this.is_fork) return true;
        for (const effect of this.#blocking_pending.keys()) {
          var e3 = effect;
          var skipped = false;
          while (e3.parent !== null) {
            if (this.#skipped_branches.has(e3)) {
              skipped = true;
              break;
            }
            e3 = e3.parent;
          }
          if (!skipped) return true;
        }
        return false;
      }
      /**
      * Add an effect to the #skipped_branches map and reset its children
      * @param {Effect} effect
      */
      skip_effect(effect) {
        if (!this.#skipped_branches.has(effect)) this.#skipped_branches.set(effect, {
          d: [],
          m: []
        });
        this.#unskipped_branches.delete(effect);
      }
      /**
      * Remove an effect from the #skipped_branches map and reschedule
      * any tracked dirty/maybe_dirty child effects
      * @param {Effect} effect
      * @param {(e: Effect) => void} callback
      */
      unskip_effect(effect, callback = (e3) => this.schedule(e3)) {
        var tracked = this.#skipped_branches.get(effect);
        if (tracked) {
          this.#skipped_branches.delete(effect);
          for (var e3 of tracked.d) {
            set_signal_status(e3, DIRTY);
            callback(e3);
          }
          for (e3 of tracked.m) {
            set_signal_status(e3, MAYBE_DIRTY);
            callback(e3);
          }
        }
        this.#unskipped_branches.add(effect);
      }
      #process() {
        this.#started = true;
        if (flush_count++ > 1e3) {
          this.#unlink();
          infinite_loop_guard();
        }
        for (const e3 of this.#dirty_effects) {
          this.#maybe_dirty_effects.delete(e3);
          set_signal_status(e3, DIRTY);
          this.schedule(e3);
        }
        for (const e3 of this.#maybe_dirty_effects) {
          set_signal_status(e3, MAYBE_DIRTY);
          this.schedule(e3);
        }
        const roots = this.#roots;
        this.#roots = [];
        this.apply();
        var effects = collected_effects = [];
        var render_effects = [];
        var updates = legacy_updates = [];
        for (const root of roots) try {
          this.#traverse(root, effects, render_effects);
        } catch (e3) {
          reset_all(root);
          if (!this.#is_deferred()) this.discard();
          throw e3;
        }
        current_batch = null;
        if (updates.length > 0) {
          var batch = Batch2.ensure();
          for (const e3 of updates) batch.schedule(e3);
        }
        collected_effects = null;
        legacy_updates = null;
        if (this.#is_deferred()) {
          this.#defer_effects(render_effects);
          this.#defer_effects(effects);
          for (const [e3, t4] of this.#skipped_branches) reset_branch(e3, t4);
          if (updates.length > 0)
            current_batch.#process();
          return;
        }
        const earlier_batch = this.#find_earlier_batch();
        if (earlier_batch) {
          this.#defer_effects(render_effects);
          this.#defer_effects(effects);
          earlier_batch.#merge(this);
          return;
        }
        this.#dirty_effects.clear();
        this.#maybe_dirty_effects.clear();
        for (const fn of this.#commit_callbacks) fn(this);
        this.#commit_callbacks.clear();
        previous_batch = this;
        flush_queued_effects(render_effects);
        flush_queued_effects(effects);
        previous_batch = null;
        this.#deferred?.resolve();
        var next_batch = current_batch;
        if (this.#pending === 0 && (this.#roots.length === 0 || next_batch !== null)) {
          this.#unlink();
          if (async_mode_flag) {
            this.#commit();
            current_batch = next_batch;
          }
        }
        if (this.#roots.length > 0) {
          if (next_batch !== null) {
            const batch2 = next_batch;
            batch2.#roots.push(...this.#roots.filter((r3) => !batch2.#roots.includes(r3)));
          } else next_batch = this;
        }
        if (next_batch !== null) {
          old_values.clear();
          next_batch.#process();
        }
      }
      /**
      * Traverse the effect tree, executing effects or stashing
      * them for later execution as appropriate
      * @param {Effect} root
      * @param {Effect[]} effects
      * @param {Effect[]} render_effects
      */
      #traverse(root, effects, render_effects) {
        root.f ^= CLEAN;
        var effect = root.first;
        while (effect !== null) {
          var flags2 = effect.f;
          var is_branch = (flags2 & 96) !== 0;
          if (!(is_branch && (flags2 & 1024) !== 0 || (flags2 & 8192) !== 0 || this.#skipped_branches.has(effect)) && effect.fn !== null) {
            if (is_branch) effect.f ^= CLEAN;
            else if ((flags2 & 4) !== 0) effects.push(effect);
            else if (async_mode_flag && (flags2 & 16777224) !== 0) render_effects.push(effect);
            else if (is_dirty(effect)) {
              if ((flags2 & 16) !== 0) this.#maybe_dirty_effects.add(effect);
              update_effect(effect);
            }
            var child = effect.first;
            if (child !== null) {
              effect = child;
              continue;
            }
          }
          while (effect !== null) {
            var next2 = effect.next;
            if (next2 !== null) {
              effect = next2;
              break;
            }
            effect = effect.parent;
          }
        }
      }
      #find_earlier_batch() {
        var batch = this.#prev;
        while (batch !== null) {
          if (!batch.is_fork) {
            for (const [value, [, is_derived]] of this.current) if (batch.current.has(value) && !is_derived) return batch;
          }
          batch = batch.#prev;
        }
        return null;
      }
      /**
      * @param {Batch} batch
      */
      #merge(batch) {
        for (const [source2, value] of batch.current) {
          if (!this.previous.has(source2) && batch.previous.has(source2)) this.previous.set(source2, batch.previous.get(source2));
          this.current.set(source2, value);
        }
        for (const [effect, deferred2] of batch.async_deriveds) {
          const d2 = this.async_deriveds.get(effect);
          if (d2) deferred2.promise.then(d2.resolve).catch(d2.reject);
        }
        batch.async_deriveds.clear();
        this.transfer_effects(batch.#dirty_effects, batch.#maybe_dirty_effects);
        const mark = /* @__PURE__ */ __name((value) => {
          var reactions = value.reactions;
          if (reactions === null) return;
          if ((value.f & 2) !== 0 && (value.f & 6144) === 0) return;
          for (const reaction of reactions) {
            var flags2 = reaction.f;
            if ((flags2 & 2) !== 0) mark(reaction);
            else {
              var effect = reaction;
              if (flags2 & 4194320 && !this.async_deriveds.has(effect)) {
                this.#maybe_dirty_effects.delete(effect);
                set_signal_status(effect, DIRTY);
                this.schedule(effect);
              }
            }
          }
        }, "mark");
        for (const source2 of this.current.keys()) mark(source2);
        this.oncommit(() => batch.discard());
        batch.#unlink();
        current_batch = this;
        this.#process();
      }
      /**
      * @param {Effect[]} effects
      */
      #defer_effects(effects) {
        for (var i = 0; i < effects.length; i += 1) defer_effect(effects[i], this.#dirty_effects, this.#maybe_dirty_effects);
      }
      /**
      * Associate a change to a given source with the current
      * batch, noting its previous and current values
      * @param {Value} source
      * @param {any} value
      * @param {boolean} [is_derived]
      */
      capture(source2, value, is_derived = false) {
        if (source2.v !== UNINITIALIZED && !this.previous.has(source2)) this.previous.set(source2, source2.v);
        if ((source2.f & 8388608) === 0) {
          this.current.set(source2, [value, is_derived]);
          batch_values?.set(source2, value);
        }
        if (!this.is_fork) source2.v = value;
      }
      activate() {
        current_batch = this;
      }
      deactivate() {
        current_batch = null;
        batch_values = null;
      }
      flush() {
        try {
          is_processing = true;
          current_batch = this;
          this.#process();
        } finally {
          flush_count = 0;
          last_scheduled_effect = null;
          collected_effects = null;
          legacy_updates = null;
          is_processing = false;
          current_batch = null;
          batch_values = null;
          old_values.clear();
        }
      }
      discard() {
        for (const fn of this.#discard_callbacks) fn(this);
        this.#discard_callbacks.clear();
        for (const deferred2 of this.async_deriveds.values()) deferred2.reject(OBSOLETE);
        this.#unlink();
        this.#deferred?.resolve();
      }
      /**
      * @param {Effect} effect
      */
      register_created_effect(effect) {
        this.#new_effects.push(effect);
      }
      #commit() {
        for (let batch = first_batch; batch !== null; batch = batch.#next) {
          var is_earlier = batch.id < this.id;
          var sources = [];
          for (const [source3, [value, is_derived]] of this.current) {
            if (batch.current.has(source3)) {
              var batch_value = batch.current.get(source3)[0];
              if (is_earlier && value !== batch_value) batch.current.set(source3, [value, is_derived]);
              else continue;
            }
            sources.push(source3);
          }
          if (is_earlier) for (const [effect, deferred2] of this.async_deriveds) {
            const d2 = batch.async_deriveds.get(effect);
            if (d2) deferred2.promise.then(d2.resolve).catch(d2.reject);
          }
          var current2 = [...batch.current.keys()].filter((source3) => !batch.current.get(source3)[1]);
          if (!batch.#started || current2.length === 0) continue;
          var others = current2.filter((source3) => !this.current.has(source3));
          if (others.length === 0) {
            if (is_earlier) batch.discard();
          } else if (sources.length > 0) {
            if (is_earlier) for (const unskipped of this.#unskipped_branches) batch.unskip_effect(unskipped, (e3) => {
              if ((e3.f & 4194320) !== 0) batch.schedule(e3);
              else batch.#defer_effects([e3]);
            });
            batch.activate();
            var marked = /* @__PURE__ */ new Set();
            var checked = /* @__PURE__ */ new Map();
            for (var source2 of sources) mark_effects(source2, others, marked, checked);
            checked = /* @__PURE__ */ new Map();
            var current_unequal = [...batch.current].filter(([c2, v1]) => {
              const v2 = this.current.get(c2);
              if (!v2) return true;
              return v2[0] !== v1[0] || v2[1] !== v1[1];
            }).map(([c2]) => c2);
            if (current_unequal.length > 0) {
              for (const effect of this.#new_effects) if ((effect.f & 155648) === 0 && depends_on(effect, current_unequal, checked)) {
                if ((effect.f & 4194320) !== 0) {
                  set_signal_status(effect, DIRTY);
                  batch.schedule(effect);
                } else batch.#dirty_effects.add(effect);
              }
            }
            if (batch.#roots.length > 0 && !batch.#decrement_queued) {
              batch.apply();
              for (var root of batch.#roots) batch.#traverse(root, [], []);
              batch.#roots = [];
            }
            batch.deactivate();
          }
        }
      }
      /**
      * @param {boolean} blocking
      * @param {Effect} effect
      */
      increment(blocking, effect) {
        this.#pending += 1;
        if (blocking) {
          let blocking_pending_count = this.#blocking_pending.get(effect) ?? 0;
          this.#blocking_pending.set(effect, blocking_pending_count + 1);
        }
      }
      /**
      * @param {boolean} blocking
      * @param {Effect} effect
      */
      decrement(blocking, effect) {
        this.#pending -= 1;
        if (blocking) {
          let blocking_pending_count = this.#blocking_pending.get(effect) ?? 0;
          if (blocking_pending_count === 1) this.#blocking_pending.delete(effect);
          else this.#blocking_pending.set(effect, blocking_pending_count - 1);
        }
        if (this.#decrement_queued) return;
        this.#decrement_queued = true;
        queue_micro_task(() => {
          this.#decrement_queued = false;
          if (this.linked) this.flush();
        });
      }
      /**
      * @param {Set<Effect>} dirty_effects
      * @param {Set<Effect>} maybe_dirty_effects
      */
      transfer_effects(dirty_effects, maybe_dirty_effects) {
        for (const e3 of dirty_effects) this.#dirty_effects.add(e3);
        for (const e3 of maybe_dirty_effects) this.#maybe_dirty_effects.add(e3);
        dirty_effects.clear();
        maybe_dirty_effects.clear();
      }
      /** @param {(batch: Batch) => void} fn */
      oncommit(fn) {
        this.#commit_callbacks.add(fn);
      }
      /** @param {(batch: Batch) => void} fn */
      ondiscard(fn) {
        this.#discard_callbacks.add(fn);
      }
      settled() {
        return (this.#deferred ??= deferred()).promise;
      }
      static ensure() {
        if (current_batch === null) {
          const batch = current_batch = new Batch2();
          if (!is_processing && !is_flushing_sync) queue_micro_task(() => {
            if (!batch.#started) batch.flush();
          });
        }
        return current_batch;
      }
      apply() {
        if (!async_mode_flag || !this.is_fork && this.#prev === null && this.#next === null) {
          batch_values = null;
          return;
        }
        batch_values = /* @__PURE__ */ new Map();
        for (const [source2, [value]] of this.current) batch_values.set(source2, value);
        for (let batch = first_batch; batch !== null; batch = batch.#next) {
          if (batch === this || batch.is_fork) continue;
          var intersects = false;
          if (batch.id < this.id) for (const [source2, [, is_derived]] of batch.current) {
            if (is_derived) continue;
            if (this.current.has(source2)) {
              intersects = true;
              break;
            }
          }
          if (!intersects) {
            for (const [source2, previous] of batch.previous) if (!batch_values.has(source2)) batch_values.set(source2, previous);
          }
        }
      }
      /**
      *
      * @param {Effect} effect
      */
      schedule(effect) {
        last_scheduled_effect = effect;
        if (effect.b?.is_pending && (effect.f & 16777228) !== 0 && (effect.f & 32768) === 0) {
          effect.b.defer_effect(effect);
          return;
        }
        var e3 = effect;
        while (e3.parent !== null) {
          e3 = e3.parent;
          var flags2 = e3.f;
          if (collected_effects !== null && e3 === active_effect) {
            if (async_mode_flag) return;
            if ((active_reaction === null || (active_reaction.f & 2) === 0) && !legacy_is_updating_store) return;
          }
          if ((flags2 & 96) !== 0) {
            if ((flags2 & 1024) === 0) return;
            e3.f ^= CLEAN;
          }
        }
        this.#roots.push(e3);
      }
      #unlink() {
        if (!this.linked) return;
        var prev = this.#prev;
        var next2 = this.#next;
        if (prev === null) first_batch = next2;
        else prev.#next = next2;
        if (next2 === null) last_batch = prev;
        else next2.#prev = prev;
        this.linked = false;
      }
    };
    __name(flushSync, "flushSync");
    __name(infinite_loop_guard, "infinite_loop_guard");
    eager_block_effects = null;
    __name(flush_queued_effects, "flush_queued_effects");
    __name(mark_effects, "mark_effects");
    __name(depends_on, "depends_on");
    __name(schedule_effect, "schedule_effect");
    __name(reset_branch, "reset_branch");
    __name(reset_all, "reset_all");
    eager_effects = /* @__PURE__ */ new Set();
    old_values = /* @__PURE__ */ new Map();
    eager_effects_deferred = false;
    __name(source, "source");
    __name(state, "state");
    __name(mutable_source, "mutable_source");
    __name(set, "set");
    __name(internal_set, "internal_set");
    __name(flush_eager_effects, "flush_eager_effects");
    __name(increment, "increment");
    __name(mark_reactions, "mark_reactions");
    __name(proxy, "proxy");
    __name(init_operations, "init_operations");
    __name(create_text, "create_text");
    __name(get_first_child, "get_first_child");
    __name(get_next_sibling, "get_next_sibling");
    __name(clear_text_content, "clear_text_content");
    __name(handle_error, "handle_error");
    __name(invoke_error_boundary, "invoke_error_boundary");
    __name(push_effect, "push_effect");
    __name(create_effect, "create_effect");
    __name(effect_tracking, "effect_tracking");
    __name(create_user_effect, "create_user_effect");
    __name(component_root, "component_root");
    __name(render_effect, "render_effect");
    __name(block, "block");
    __name(branch, "branch");
    __name(execute_effect_teardown, "execute_effect_teardown");
    __name(destroy_effect_children, "destroy_effect_children");
    __name(destroy_block_effect_children, "destroy_block_effect_children");
    __name(destroy_effect, "destroy_effect");
    __name(remove_effect_dom, "remove_effect_dom");
    __name(unlink_effect, "unlink_effect");
    __name(pause_effect, "pause_effect");
    __name(pause_children, "pause_children");
    __name(move_effect, "move_effect");
    captured_signals = null;
    is_updating_effect = false;
    is_destroying_effect = false;
    __name(set_is_destroying_effect, "set_is_destroying_effect");
    active_reaction = null;
    untracking = false;
    __name(set_active_reaction, "set_active_reaction");
    active_effect = null;
    __name(set_active_effect, "set_active_effect");
    current_sources = null;
    __name(push_reaction_value, "push_reaction_value");
    new_deps = null;
    skipped_deps = 0;
    untracked_writes = null;
    __name(set_untracked_writes, "set_untracked_writes");
    write_version = 1;
    read_version = 0;
    update_version = read_version;
    __name(set_update_version, "set_update_version");
    __name(increment_write_version, "increment_write_version");
    __name(is_dirty, "is_dirty");
    __name(schedule_possible_effect_self_invalidation, "schedule_possible_effect_self_invalidation");
    __name(update_reaction, "update_reaction");
    __name(update_dependencies, "update_dependencies");
    __name(remove_reaction, "remove_reaction");
    __name(remove_reactions, "remove_reactions");
    __name(update_effect, "update_effect");
    __name(get, "get");
    __name(reconnect, "reconnect");
    __name(depends_on_old_values, "depends_on_old_values");
    __name(untrack, "untrack");
    subscriber_queue = [];
    __name(readable, "readable");
    __name(writable, "writable");
    VOID_ELEMENT_NAMES = [
      "area",
      "base",
      "br",
      "col",
      "command",
      "embed",
      "hr",
      "img",
      "input",
      "keygen",
      "link",
      "meta",
      "param",
      "source",
      "track",
      "wbr"
    ];
    __name(is_void, "is_void");
    DOM_BOOLEAN_ATTRIBUTES = [
      "allowfullscreen",
      "async",
      "autofocus",
      "autoplay",
      "checked",
      "controls",
      "default",
      "disabled",
      "formnovalidate",
      "indeterminate",
      "inert",
      "ismap",
      "loop",
      "multiple",
      "muted",
      "nomodule",
      "novalidate",
      "open",
      "playsinline",
      "readonly",
      "required",
      "reversed",
      "seamless",
      "selected",
      "webkitdirectory",
      "defer",
      "disablepictureinpicture",
      "disableremoteplayback"
    ];
    __name(is_boolean_attribute, "is_boolean_attribute");
    [...DOM_BOOLEAN_ATTRIBUTES];
    PASSIVE_EVENTS = ["touchstart", "touchmove"];
    __name(is_passive_event, "is_passive_event");
    RAW_TEXT_ELEMENTS = [
      "textarea",
      "script",
      "style",
      "title"
    ];
    __name(is_raw_text_element, "is_raw_text_element");
    REGEX_VALID_TAG_NAME = /^[a-zA-Z][a-zA-Z0-9]*(-[a-zA-Z0-9.\-_\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u{10000}-\u{EFFFF}]*)?$/u;
    ATTR_REGEX = /[&"<]/g;
    CONTENT_REGEX = /[&<]/g;
    __name(escape_html, "escape_html");
    __name(r, "r");
    __name(clsx$1, "clsx$1");
    replacements = { translate: /* @__PURE__ */ new Map([[true, "yes"], [false, "no"]]) };
    __name(attr, "attr");
    __name(clsx, "clsx");
    whitespace = [..." 	\n\r\f\xA0\v\uFEFF"];
    __name(to_class, "to_class");
    __name(append_styles, "append_styles");
    __name(to_css_name, "to_css_name");
    __name(to_style, "to_style");
    BLOCK_OPEN = `<!--[-->`;
    BLOCK_CLOSE = `<!--]-->`;
    EMPTY_COMMENT = `<!---->`;
    ssr_context = null;
    __name(set_ssr_context, "set_ssr_context");
    __name(createContext, "createContext");
    __name(getContext, "getContext");
    __name(setContext, "setContext");
    __name(hasContext, "hasContext");
    __name(getAllContexts, "getAllContexts");
    __name(push, "push");
    __name(pop, "pop");
    __name(async_local_storage_unavailable, "async_local_storage_unavailable");
    __name(await_invalid, "await_invalid");
    __name(dynamic_element_invalid_tag, "dynamic_element_invalid_tag");
    __name(html_deprecated, "html_deprecated");
    __name(hydratable_serialization_failed, "hydratable_serialization_failed");
    __name(invalid_csp, "invalid_csp");
    __name(invalid_id_prefix, "invalid_id_prefix");
    __name(lifecycle_function_unavailable, "lifecycle_function_unavailable");
    __name(server_context_required, "server_context_required");
    __name(unresolved_hydratable, "unresolved_hydratable");
    current_render = null;
    context = null;
    __name(get_render_context, "get_render_context");
    __name(with_render_context, "with_render_context");
    als = null;
    als_import = null;
    __name(init_render_context, "init_render_context");
    __name(in_webcontainer, "in_webcontainer");
    obfuscated_import = /* @__PURE__ */ __name((module_name) => import(
      /* @vite-ignore */
      module_name
    ), "obfuscated_import");
    __name(sha256, "sha256");
    __name(base64_encode, "base64_encode");
    Renderer = class Renderer2 {
      static {
        __name(this, "Renderer");
      }
      /**
      * The contents of the renderer.
      * @type {RendererItem[]}
      */
      #out = [];
      /**
      * Any `onDestroy` callbacks registered during execution of this renderer.
      * @type {(() => void)[] | undefined}
      */
      #on_destroy = void 0;
      /**
      * Whether this renderer is a component body.
      * @type {boolean}
      */
      #is_component_body = false;
      /**
      * If set, this renderer is an error boundary. When async collection
      * of the children fails, the failed snippet is rendered instead.
      * @type {{
      * 	failed: (renderer: Renderer, error: unknown, reset: () => void) => void;
      * 	transformError: (error: unknown) => unknown;
      * 	context: SSRContext | null;
      * } | null}
      */
      #boundary = null;
      /**
      * The type of string content that this renderer is accumulating.
      * @type {RendererType}
      */
      type;
      /** @type {Renderer | undefined} */
      #parent;
      /**
      * Asynchronous work associated with this renderer
      * @type {Promise<void> | undefined}
      */
      promise = void 0;
      /**
      * State which is associated with the content tree as a whole.
      * It will be re-exposed, uncopied, on all children.
      * @type {SSRState}
      * @readonly
      */
      global;
      /**
      * State that is local to the branch it is declared in.
      * It will be shallow-copied to all children.
      *
      * @type {{ select_value: any, multiple: boolean }}
      */
      local;
      /**
      * @param {SSRState} global
      * @param {Renderer | undefined} [parent]
      */
      constructor(global, parent) {
        this.#parent = parent;
        this.global = global;
        this.local = parent ? { ...parent.local } : {
          select_value: void 0,
          multiple: false
        };
        this.type = parent ? parent.type : "body";
      }
      /**
      * @param {(renderer: Renderer) => void} fn
      */
      head(fn) {
        const head2 = new Renderer2(this.global, this);
        head2.type = "head";
        this.#out.push(head2);
        head2.child(fn);
      }
      /**
      * @param {Array<Promise<void>>} blockers
      * @param {(renderer: Renderer) => void} fn
      */
      async_block(blockers, fn) {
        this.#out.push(BLOCK_OPEN);
        this.async(blockers, fn);
        this.#out.push(BLOCK_CLOSE);
      }
      /**
      * @param {Array<Promise<void>>} blockers
      * @param {(renderer: Renderer) => void} fn
      */
      async(blockers, fn) {
        let callback = fn;
        if (blockers.length > 0) {
          const context3 = ssr_context;
          callback = /* @__PURE__ */ __name((renderer) => {
            return Promise.all(blockers).then(() => {
              const previous_context = ssr_context;
              try {
                set_ssr_context(context3);
                return fn(renderer);
              } finally {
                set_ssr_context(previous_context);
              }
            });
          }, "callback");
        }
        this.child(callback);
      }
      /**
      * @param {Array<() => void>} thunks
      */
      run(thunks) {
        const context3 = ssr_context;
        let promise = Promise.resolve(thunks[0]());
        const promises = [promise];
        for (const fn of thunks.slice(1)) {
          promise = promise.then(() => {
            const previous_context = ssr_context;
            set_ssr_context(context3);
            try {
              return fn();
            } finally {
              set_ssr_context(previous_context);
            }
          });
          promises.push(promise);
        }
        promise.catch(noop);
        this.promise = this.global.track(promise);
        return promises;
      }
      /**
      * @param {(renderer: Renderer) => MaybePromise<void>} fn
      */
      child_block(fn) {
        this.#out.push(BLOCK_OPEN);
        this.child(fn);
        this.#out.push(BLOCK_CLOSE);
      }
      /**
      * Create a child renderer. The child renderer inherits the state from the parent,
      * but has its own content.
      * @param {(renderer: Renderer) => MaybePromise<void>} fn
      */
      child(fn) {
        const child = new Renderer2(this.global, this);
        this.#out.push(child);
        const parent = ssr_context;
        set_ssr_context({
          ...ssr_context,
          p: parent,
          c: null,
          r: child
        });
        const result = fn(child);
        set_ssr_context(parent);
        if (result instanceof Promise) {
          result.catch(noop);
          result.finally(() => set_ssr_context(null)).catch(noop);
          if (child.global.mode === "sync") await_invalid();
          child.promise = child.global.track(result);
        }
        return child;
      }
      /**
      * Render children inside an error boundary. If the children throw and the API-level
      * `transformError` transform handles the error (doesn't re-throw), the `failed` snippet is
      * rendered instead. Otherwise the error propagates.
      *
      * @param {{ failed?: (renderer: Renderer, error: unknown, reset: () => void) => void }} props
      * @param {(renderer: Renderer) => MaybePromise<void>} children_fn
      */
      boundary(props, children_fn) {
        const child = new Renderer2(this.global, this);
        this.#out.push(child);
        const parent_context = ssr_context;
        if (props.failed) child.#boundary = {
          failed: props.failed,
          transformError: this.global.transformError,
          context: parent_context
        };
        set_ssr_context({
          ...ssr_context,
          p: parent_context,
          c: null,
          r: child
        });
        try {
          const result = children_fn(child);
          set_ssr_context(parent_context);
          if (result instanceof Promise) {
            if (child.global.mode === "sync") await_invalid();
            result.catch(noop);
            child.promise = child.global.track(result);
          }
        } catch (error2) {
          set_ssr_context(parent_context);
          const failed_snippet = props.failed;
          if (!failed_snippet) throw error2;
          const result = this.global.transformError(error2);
          child.#out.length = 0;
          child.#boundary = null;
          if (result instanceof Promise) {
            if (this.global.mode === "sync") await_invalid();
            child.promise = child.global.track(
              /** @type {Promise<unknown>} */
              result.then((transformed) => {
                set_ssr_context(parent_context);
                child.#out.push(Renderer2.#serialize_failed_boundary(transformed));
                failed_snippet(child, transformed, noop);
                child.#out.push(BLOCK_CLOSE);
              })
            );
            child.promise.catch(noop);
          } else {
            child.#out.push(Renderer2.#serialize_failed_boundary(result));
            failed_snippet(child, result, noop);
            child.#out.push(BLOCK_CLOSE);
          }
        }
      }
      /**
      * Create a component renderer. The component renderer inherits the state from the parent,
      * but has its own content. It is treated as an ordering boundary for ondestroy callbacks.
      * @param {(renderer: Renderer) => MaybePromise<void>} fn
      * @param {Function} [component_fn]
      * @returns {void}
      */
      component(fn, component_fn) {
        push(component_fn);
        this.child((renderer) => {
          renderer.#is_component_body = true;
          return fn(renderer);
        });
        pop();
      }
      /**
      * @param {Record<string, any>} attrs
      * @param {(renderer: Renderer) => void} fn
      * @param {string | undefined} [css_hash]
      * @param {Record<string, boolean> | undefined} [classes]
      * @param {Record<string, string> | undefined} [styles]
      * @param {number | undefined} [flags]
      * @param {boolean | undefined} [is_rich]
      * @returns {void}
      */
      select(attrs, fn, css_hash, classes, styles, flags2, is_rich) {
        const { value, defaultValue, ...select_attrs } = attrs;
        if (select_attrs.multiple === "") select_attrs.multiple = true;
        this.push(`<select${attributes(select_attrs, css_hash, classes, styles, flags2)}>`);
        this.child((renderer) => {
          renderer.local.select_value = value === void 0 ? defaultValue : value;
          renderer.local.multiple = !!select_attrs.multiple;
          fn(renderer);
        });
        this.push(`${is_rich ? "<!>" : ""}</select>`);
      }
      /**
      * @param {Record<string, any>} attrs
      * @param {string | number | boolean | ((renderer: Renderer) => void)} body
      * @param {string | undefined} [css_hash]
      * @param {Record<string, boolean> | undefined} [classes]
      * @param {Record<string, string> | undefined} [styles]
      * @param {number | undefined} [flags]
      * @param {boolean | undefined} [is_rich]
      */
      option(attrs, body, css_hash, classes, styles, flags2, is_rich) {
        this.#out.push(`<option${attributes(attrs, css_hash, classes, styles, flags2)}`);
        const close = /* @__PURE__ */ __name((renderer, value, { head: head2, body: body2 }) => {
          if (has_own_property.call(attrs, "value")) value = attrs.value;
          var select_value = this.local.select_value;
          if (this.local.multiple && is_array(select_value) ? select_value.includes(value) : value === select_value) renderer.#out.push(' selected=""');
          renderer.#out.push(`>${body2}${is_rich ? "<!>" : ""}</option>`);
          if (head2) renderer.head((child) => child.push(head2));
        }, "close");
        if (typeof body === "function") this.child((renderer) => {
          const r3 = new Renderer2(this.global, this);
          body(r3);
          if (this.global.mode === "async") return r3.#collect_content_async().then((content) => {
            close(renderer, content.body.replaceAll("<!---->", ""), content);
          });
          else {
            const content = r3.#collect_content();
            close(renderer, content.body.replaceAll("<!---->", ""), content);
          }
        });
        else close(this, body, { body: escape_html(body) });
      }
      /**
      * @param {(renderer: Renderer) => void} fn
      */
      title(fn) {
        const path = this.get_path();
        const close = /* @__PURE__ */ __name((head2) => {
          this.global.set_title(head2, path);
        }, "close");
        this.child((renderer) => {
          const r3 = new Renderer2(renderer.global, renderer);
          fn(r3);
          if (renderer.global.mode === "async") return r3.#collect_content_async().then((content) => {
            close(content.head);
          });
          else {
            const content = r3.#collect_content();
            close(content.head);
          }
        });
      }
      /**
      * @param {string | (() => Promise<string>)} content
      */
      push(content) {
        if (typeof content === "function") this.child(async (renderer) => renderer.push(await content()));
        else this.#out.push(content);
      }
      /**
      * @param {() => void} fn
      */
      on_destroy(fn) {
        (this.#on_destroy ??= []).push(fn);
      }
      /**
      * @returns {number[]}
      */
      get_path() {
        return this.#parent ? [...this.#parent.get_path(), this.#parent.#out.indexOf(this)] : [];
      }
      /**
      * @deprecated this is needed for legacy component bindings
      */
      copy() {
        const copy = new Renderer2(this.global, this.#parent);
        copy.type = this.type;
        copy.#out = this.#out.map((item) => item instanceof Renderer2 ? item.copy() : item);
        copy.promise = this.promise;
        return copy;
      }
      /**
      * @param {Renderer} other
      * @deprecated this is needed for legacy component bindings
      */
      subsume(other) {
        if (this.global.mode !== other.global.mode) throw new Error("invariant: A renderer cannot switch modes. If you're seeing this, there's a compiler bug. File an issue!");
        this.local = other.local;
        this.#out = other.#out.map((item, i) => {
          const current2 = this.#out[i];
          if (current2 instanceof Renderer2 && item instanceof Renderer2) {
            current2.subsume(item);
            return current2;
          }
          return item;
        });
        this.promise = other.promise;
        this.type = other.type;
      }
      get length() {
        return this.#out.length;
      }
      /**
      * Creates the hydration comment that marks the start of a failed boundary.
      * The error is JSON-serialized and embedded inside an HTML comment for the client
      * to parse during hydration. The JSON is escaped to prevent `-->` or `<!--` sequences
      * from breaking out of the comment (XSS). Uses unicode escapes which `JSON.parse()`
      * handles transparently.
      * @param {unknown} error
      * @returns {string}
      */
      static #serialize_failed_boundary(error2) {
        return `<!--[?${JSON.stringify(error2).replace(/>/g, "\\u003e").replace(/</g, "\\u003c")}-->`;
      }
      /**
      * Only available on the server and when compiling with the `server` option.
      * Takes a component and returns an object with `body` and `head` properties on it, which you can use to populate the HTML when server-rendering your app.
      * @template {Record<string, any>} Props
      * @param {Component<Props>} component
      * @param {{ props?: Omit<Props, '$$slots' | '$$events'>; context?: Map<any, any>; idPrefix?: string; csp?: Csp }} [options]
      * @returns {RenderOutput}
      */
      static render(component22, options2 = {}) {
        let sync;
        let async;
        const result = {};
        Object.defineProperties(result, {
          html: { get: /* @__PURE__ */ __name(() => {
            return (sync ??= Renderer2.#render(component22, options2)).body;
          }, "get") },
          head: { get: /* @__PURE__ */ __name(() => {
            return (sync ??= Renderer2.#render(component22, options2)).head;
          }, "get") },
          body: { get: /* @__PURE__ */ __name(() => {
            return (sync ??= Renderer2.#render(component22, options2)).body;
          }, "get") },
          hashes: { value: { script: "" } },
          then: { value: (
            /**
            * this is not type-safe, but honestly it's the best I can do right now, and it's a straightforward function.
            *
            * @template TResult1
            * @template [TResult2=never]
            * @param { (value: SyncRenderOutput) => TResult1 } onfulfilled
            * @param { (reason: unknown) => TResult2 } onrejected
            */
            /* @__PURE__ */ __name((onfulfilled, onrejected) => {
              if (!async_mode_flag) {
                const result2 = sync ??= Renderer2.#render(component22, options2);
                const user_result = onfulfilled({
                  head: result2.head,
                  body: result2.body,
                  html: result2.body,
                  hashes: { script: [] }
                });
                return Promise.resolve(user_result);
              }
              async ??= init_render_context().then(() => with_render_context(() => Renderer2.#render_async(component22, options2)));
              return async.then((result2) => {
                Object.defineProperty(result2, "html", { get: /* @__PURE__ */ __name(() => {
                  html_deprecated();
                }, "get") });
                return onfulfilled(result2);
              }, onrejected);
            }, "value")
          ) }
        });
        return result;
      }
      /**
      * Collect all of the `onDestroy` callbacks registered during rendering. In an async context, this is only safe to call
      * after awaiting `collect_async`.
      *
      * Child renderers are "porous" and don't affect execution order, but component body renderers
      * create ordering boundaries. Within a renderer, callbacks run in order until hitting a component boundary.
      * @returns {Iterable<() => void>}
      */
      *#collect_on_destroy() {
        for (const component22 of this.#traverse_components()) yield* component22.#collect_ondestroy();
      }
      /**
      * Performs a depth-first search of renderers, yielding the deepest components first, then additional components as we backtrack up the tree.
      * @returns {Iterable<Renderer>}
      */
      *#traverse_components() {
        for (const child of this.#out) if (typeof child !== "string") yield* child.#traverse_components();
        if (this.#is_component_body) yield this;
      }
      /**
      * @returns {Iterable<() => void>}
      */
      *#collect_ondestroy() {
        if (this.#on_destroy) for (const fn of this.#on_destroy) yield fn;
        for (const child of this.#out) if (child instanceof Renderer2 && !child.#is_component_body) yield* child.#collect_ondestroy();
      }
      /**
      * Runs every `onDestroy` callback in this renderer tree. On a failed render,
      * cleanup errors are suppressed so they do not mask the render error.
      * @param {boolean} suppress_errors
      */
      #run_on_destroy(suppress_errors) {
        let first_error;
        let has_error = false;
        for (const cleanup of this.#collect_on_destroy()) try {
          cleanup();
        } catch (error2) {
          if (!suppress_errors && !has_error) {
            first_error = error2;
            has_error = true;
          }
        }
        if (has_error) throw first_error;
      }
      /**
      * @param {'sync' | 'async'} mode
      * @param {{ idPrefix?: string; csp?: Csp; transformError?: (error: unknown) => unknown }} options
      * @returns {Renderer}
      */
      static #create(mode, options2) {
        if (options2.idPrefix?.includes("--")) invalid_id_prefix();
        return new Renderer2(new SSRState(mode, options2.idPrefix ? options2.idPrefix + "-" : "", options2.csp, options2.transformError));
      }
      /**
      * Render a component. Throws if any of the children are performing asynchronous work.
      *
      * @template {Record<string, any>} Props
      * @param {Component<Props>} component
      * @param {{ props?: Omit<Props, '$$slots' | '$$events'>; context?: Map<any, any>; idPrefix?: string }} options
      * @returns {AccumulatedContent}
      */
      static #render(component22, options2) {
        var previous_context = ssr_context;
        const renderer = Renderer2.#create("sync", options2);
        let result;
        let render_error;
        let failed = false;
        try {
          try {
            Renderer2.#open_render(renderer, component22, options2);
            result = Renderer2.#close_render(renderer.#collect_content(), renderer);
          } catch (error2) {
            render_error = error2;
            failed = true;
          }
          renderer.#run_on_destroy(failed);
          if (failed) throw render_error;
          return result;
        } finally {
          renderer.global.abort();
          set_ssr_context(previous_context);
        }
      }
      /**
      * Render a component.
      *
      * @template {Record<string, any>} Props
      * @param {Component<Props>} component
      * @param {{ props?: Omit<Props, '$$slots' | '$$events'>; context?: Map<any, any>; idPrefix?: string; csp?: Csp }} options
      * @returns {Promise<AccumulatedContent & { hashes: { script: Sha256Source[] } }>}
      */
      static async #render_async(component22, options2) {
        const previous_context = ssr_context;
        const renderer = Renderer2.#create("async", options2);
        let result;
        let render_error;
        let failed = false;
        try {
          try {
            Renderer2.#open_render(renderer, component22, options2);
            const content = await renderer.#collect_content_async();
            const hydratables = await renderer.#collect_hydratables();
            if (hydratables !== null) content.head = hydratables + content.head;
            result = Renderer2.#close_render(content, renderer);
          } catch (error2) {
            render_error = error2;
            failed = true;
            renderer.global.abort();
            await renderer.global.settle();
          }
          renderer.#run_on_destroy(failed);
          if (failed) throw render_error;
          return result;
        } finally {
          set_ssr_context(previous_context);
          renderer.global.abort();
        }
      }
      /**
      * Collect all of the code from the `out` array and return it as a string, or a promise resolving to a string.
      * @param {AccumulatedContent} content
      * @returns {AccumulatedContent}
      */
      #collect_content(content = {
        head: "",
        body: ""
      }) {
        for (const item of this.#out) if (typeof item === "string") content[this.type] += item;
        else if (item instanceof Renderer2) item.#collect_content(content);
        return content;
      }
      /**
      * Collect all of the code from the `out` array and return it as a string.
      * @param {AccumulatedContent} content
      * @returns {Promise<AccumulatedContent>}
      */
      async #collect_content_async(content = {
        head: "",
        body: ""
      }) {
        await this.promise;
        for (const item of this.#out) if (typeof item === "string") content[this.type] += item;
        else if (item instanceof Renderer2) {
          if (item.#boundary) {
            const boundary_content = {
              head: "",
              body: ""
            };
            try {
              await item.#collect_content_async(boundary_content);
              content.head += boundary_content.head;
              content.body += boundary_content.body;
            } catch (error2) {
              const { context: context3, failed, transformError } = item.#boundary;
              set_ssr_context(context3);
              let promise = transformError(error2);
              set_ssr_context(null);
              let transformed = await promise;
              set_ssr_context(context3);
              const failed_renderer = new Renderer2(item.global, item);
              failed_renderer.type = item.type;
              failed_renderer.#out.push(Renderer2.#serialize_failed_boundary(transformed));
              failed(failed_renderer, transformed, noop);
              failed_renderer.#out.push(BLOCK_CLOSE);
              await failed_renderer.#collect_content_async(content);
            }
          } else await item.#collect_content_async(content);
        }
        return content;
      }
      async #collect_hydratables() {
        const ctx = get_render_context().hydratable;
        for (const [_, key2] of ctx.unresolved_promises) unresolved_hydratable(key2, ctx.lookup.get(key2)?.stack ?? "<missing stack trace>");
        for (const comparison of ctx.comparisons) await comparison;
        return await this.#hydratable_block(ctx);
      }
      /**
      * @template {Record<string, any>} Props
      * @param {Renderer} renderer
      * @param {import('svelte').Component<Props>} component
      * @param {{ props?: Omit<Props, '$$slots' | '$$events'>; context?: Map<any, any>; idPrefix?: string; csp?: Csp; transformError?: (error: unknown) => unknown }} options
      * @returns {void}
      */
      static #open_render(renderer, component22, options2) {
        var previous_context = ssr_context;
        try {
          set_ssr_context({
            p: null,
            c: options2.context ?? null,
            r: renderer
          });
          renderer.push(BLOCK_OPEN);
          component22(renderer, options2.props ?? {});
          renderer.push(BLOCK_CLOSE);
        } finally {
          set_ssr_context(previous_context);
        }
      }
      /**
      * @param {AccumulatedContent} content
      * @param {Renderer} renderer
      * @returns {AccumulatedContent & { hashes: { script: Sha256Source[] } }}
      */
      static #close_render(content, renderer) {
        let head2 = content.head + renderer.global.get_title();
        let body = content.body;
        for (const { hash: hash2, code } of renderer.global.css) head2 += `<style id="${hash2}">${code}</style>`;
        return {
          head: head2,
          body,
          hashes: { script: renderer.global.csp.script_hashes }
        };
      }
      /**
      * @param {HydratableContext} ctx
      */
      async #hydratable_block(ctx) {
        if (ctx.lookup.size === 0) return null;
        let entries = [];
        let has_promises = false;
        for (const [k, v] of ctx.lookup) {
          if (v.promises) {
            has_promises = true;
            for (const p of v.promises) await p;
          }
          entries.push(`[${uneval(k)},${v.serialized}]`);
        }
        let prelude = `const h = (window.__svelte ??= {}).h ??= new Map();`;
        if (has_promises) prelude = `const r = (v) => Promise.resolve(v);
				${prelude}`;
        const body = `
			{
				${prelude}

				for (const [k, v] of [
					${entries.join(",\n					")}
				]) {
					h.set(k, v);
				}
			}
		`;
        let csp_attr = "";
        if (this.global.csp.nonce) csp_attr = ` nonce="${this.global.csp.nonce}"`;
        else if (this.global.csp.hash) {
          const hash2 = await sha256(body);
          this.global.csp.script_hashes.push(`sha256-${hash2}`);
        }
        return `
		<script${csp_attr}>${body}<\/script>`;
      }
    };
    SSRState = class {
      static {
        __name(this, "SSRState");
      }
      /** @readonly @type {Csp & { script_hashes: Sha256Source[] }} */
      csp;
      /** @readonly @type {'sync' | 'async'} */
      mode;
      /** @readonly @type {() => string} */
      uid;
      /** @readonly @type {Set<{ hash: string; code: string }>} */
      css = /* @__PURE__ */ new Set();
      /** @type {Set<Promise<unknown>>} */
      #pending = /* @__PURE__ */ new Set();
      /** @type {AbortController | null} */
      #controller = null;
      #aborted = false;
      /**
      * `transformError` passed to `render`. Called when an error boundary catches an error.
      * Throws by default if unset in `render`.
      * @type {(error: unknown) => unknown}
      */
      transformError;
      /** @type {{ path: number[], value: string }} */
      #title = {
        path: [],
        value: ""
      };
      /**
      * @param {'sync' | 'async'} mode
      * @param {string} id_prefix
      * @param {Csp} csp
      * @param {((error: unknown) => unknown) | undefined} [transformError]
      */
      constructor(mode, id_prefix = "", csp = { hash: false }, transformError) {
        this.mode = mode;
        this.csp = {
          ...csp,
          script_hashes: []
        };
        this.transformError = transformError ?? ((error2) => {
          throw error2;
        });
        let uid2 = 1;
        this.uid = () => `${id_prefix}s${uid2++}`;
      }
      /**
      * @template T
      * @param {Promise<T>} promise
      * @returns {Promise<T>}
      */
      track(promise) {
        this.#pending.add(promise);
        promise.then(() => this.#pending.delete(promise), () => this.#pending.delete(promise));
        return promise;
      }
      async settle() {
        while (this.#pending.size > 0) await Promise.allSettled([...this.#pending]);
      }
      abort() {
        if (this.#aborted) return;
        this.#aborted = true;
        this.#controller?.abort(STALE_REACTION);
      }
      get_abort_signal() {
        const controller = this.#controller ??= new AbortController();
        if (this.#aborted) controller.abort(STALE_REACTION);
        return controller.signal;
      }
      get_title() {
        return this.#title.value;
      }
      /**
      * Performs a depth-first (lexicographic) comparison using the path. Rejects sets
      * from earlier than or equal to the current value.
      * @param {string} value
      * @param {number[]} path
      */
      set_title(value, path) {
        const current2 = this.#title.path;
        let i = 0;
        let l2 = Math.min(path.length, current2.length);
        while (i < l2 && path[i] === current2[i]) i += 1;
        if (path[i] === void 0) return;
        if (current2[i] === void 0 || path[i] > current2[i]) {
          this.#title.path = path;
          this.#title.value = value;
        }
      }
    };
    INVALID_ATTR_NAME_CHAR_REGEX = /[\s'">/=\u{FDD0}-\u{FDEF}\u{FFFE}\u{FFFF}\u{1FFFE}\u{1FFFF}\u{2FFFE}\u{2FFFF}\u{3FFFE}\u{3FFFF}\u{4FFFE}\u{4FFFF}\u{5FFFE}\u{5FFFF}\u{6FFFE}\u{6FFFF}\u{7FFFE}\u{7FFFF}\u{8FFFE}\u{8FFFF}\u{9FFFE}\u{9FFFF}\u{AFFFE}\u{AFFFF}\u{BFFFE}\u{BFFFF}\u{CFFFE}\u{CFFFF}\u{DFFFE}\u{DFFFF}\u{EFFFE}\u{EFFFF}\u{FFFFE}\u{FFFFF}\u{10FFFE}\u{10FFFF}]/u;
    __name(element, "element");
    __name(render, "render");
    __name(head, "head");
    __name(attributes, "attributes");
    __name(spread_props, "spread_props");
    __name(stringify, "stringify");
    __name(attr_class, "attr_class");
    __name(attr_style, "attr_style");
    __name(bind_props, "bind_props");
    __name(ensure_array_like, "ensure_array_like");
    __name(once, "once");
    __name(derived, "derived");
  }
});

// .svelte-kit/output/server/chunks/index-server.js
function getAbortSignal() {
  let context3 = ssr_context;
  while (context3 !== null) {
    if (context3.r !== null) return context3.r.global.get_abort_signal();
    context3 = context3.p;
  }
  return new AbortController().signal;
}
function hydratable(key2, fn) {
  if (!async_mode_flag) experimental_async_required("hydratable");
  const { hydratable: hydratable2 } = get_render_context();
  let entry = hydratable2.lookup.get(key2);
  if (entry !== void 0) return entry.value;
  const value = fn();
  entry = encode(key2, value, hydratable2.unresolved_promises);
  hydratable2.lookup.set(key2, entry);
  return value;
}
function encode(key2, value, unresolved) {
  const entry = {
    value,
    serialized: ""
  };
  let uid2 = 1;
  entry.serialized = uneval(entry.value, (value2, uneval2) => {
    if (is_promise(value2)) {
      const placeholder = `"${uid2++}"`;
      const p = value2.then((v) => {
        entry.serialized = entry.serialized.replace(placeholder, () => `r(${uneval2(v)})`);
      }).catch((devalue_error) => hydratable_serialization_failed(key2, serialization_stack(entry.stack, devalue_error?.stack)));
      unresolved?.set(p, key2);
      p.catch(() => {
      }).finally(() => unresolved?.delete(p));
      (entry.promises ??= []).push(p);
      return placeholder;
    }
  });
  return entry;
}
function is_promise(value) {
  return Object.prototype.toString.call(value) === "[object Promise]";
}
function serialization_stack(root_stack, uneval_stack) {
  let out = "";
  if (root_stack) out += root_stack + "\n";
  if (uneval_stack) out += "Caused by:\n" + uneval_stack + "\n";
  return out || "<missing stack trace>";
}
function createRawSnippet(fn) {
  return (renderer, ...args) => {
    var getters = args.map((value) => () => value);
    renderer.push(fn(...getters).render().trim());
  };
}
function onDestroy(fn) {
  ssr_context.r.on_destroy(fn);
}
function createEventDispatcher() {
  return noop;
}
function mount() {
  lifecycle_function_unavailable("mount");
}
function hydrate() {
  lifecycle_function_unavailable("hydrate");
}
function unmount() {
  lifecycle_function_unavailable("unmount");
}
function fork() {
  lifecycle_function_unavailable("fork");
}
async function tick() {
}
async function settled() {
}
var __defProp2, __commonJSMin, __exportAll, index_server_exports;
var init_index_server = __esm({
  ".svelte-kit/output/server/chunks/index-server.js"() {
    init_uneval();
    init_server();
    __defProp2 = Object.defineProperty;
    __commonJSMin = /* @__PURE__ */ __name((cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports), "__commonJSMin");
    __exportAll = /* @__PURE__ */ __name((all, no_symbols) => {
      let target = {};
      for (var name in all) __defProp2(target, name, {
        get: all[name],
        enumerable: true
      });
      if (!no_symbols) __defProp2(target, Symbol.toStringTag, { value: "Module" });
      return target;
    }, "__exportAll");
    __name(getAbortSignal, "getAbortSignal");
    __name(hydratable, "hydratable");
    __name(encode, "encode");
    __name(is_promise, "is_promise");
    __name(serialization_stack, "serialization_stack");
    __name(createRawSnippet, "createRawSnippet");
    index_server_exports = /* @__PURE__ */ __exportAll({
      afterUpdate: /* @__PURE__ */ __name(() => noop, "afterUpdate"),
      beforeUpdate: /* @__PURE__ */ __name(() => noop, "beforeUpdate"),
      createContext: /* @__PURE__ */ __name(() => createContext, "createContext"),
      createEventDispatcher: /* @__PURE__ */ __name(() => createEventDispatcher, "createEventDispatcher"),
      createRawSnippet: /* @__PURE__ */ __name(() => createRawSnippet, "createRawSnippet"),
      flushSync: /* @__PURE__ */ __name(() => noop, "flushSync"),
      fork: /* @__PURE__ */ __name(() => fork, "fork"),
      getAbortSignal: /* @__PURE__ */ __name(() => getAbortSignal, "getAbortSignal"),
      getAllContexts: /* @__PURE__ */ __name(() => getAllContexts, "getAllContexts"),
      getContext: /* @__PURE__ */ __name(() => getContext, "getContext"),
      hasContext: /* @__PURE__ */ __name(() => hasContext, "hasContext"),
      hydratable: /* @__PURE__ */ __name(() => hydratable, "hydratable"),
      hydrate: /* @__PURE__ */ __name(() => hydrate, "hydrate"),
      mount: /* @__PURE__ */ __name(() => mount, "mount"),
      onDestroy: /* @__PURE__ */ __name(() => onDestroy, "onDestroy"),
      onMount: /* @__PURE__ */ __name(() => noop, "onMount"),
      setContext: /* @__PURE__ */ __name(() => setContext, "setContext"),
      settled: /* @__PURE__ */ __name(() => settled, "settled"),
      tick: /* @__PURE__ */ __name(() => tick, "tick"),
      unmount: /* @__PURE__ */ __name(() => unmount, "unmount"),
      untrack: /* @__PURE__ */ __name(() => run, "untrack")
    });
    __name(onDestroy, "onDestroy");
    __name(createEventDispatcher, "createEventDispatcher");
    __name(mount, "mount");
    __name(hydrate, "hydrate");
    __name(unmount, "unmount");
    __name(fork, "fork");
    __name(tick, "tick");
    __name(settled, "settled");
  }
});

// ../node_modules/.pnpm/@sveltejs+kit@2.70.3_@opentelemetry+api@1.9.0_@sveltejs+vite-plugin-svelte@7.3.0_svelte_07dee83374ba99f2424e63b515f8a75b/node_modules/@sveltejs/kit/src/exports/internal/remote-functions.js
var init_remote_functions = __esm({
  "../node_modules/.pnpm/@sveltejs+kit@2.70.3_@opentelemetry+api@1.9.0_@sveltejs+vite-plugin-svelte@7.3.0_svelte_07dee83374ba99f2424e63b515f8a75b/node_modules/@sveltejs/kit/src/exports/internal/remote-functions.js"() {
  }
});

// ../node_modules/.pnpm/@sveltejs+kit@2.70.3_@opentelemetry+api@1.9.0_@sveltejs+vite-plugin-svelte@7.3.0_svelte_07dee83374ba99f2424e63b515f8a75b/node_modules/@sveltejs/kit/src/exports/internal/index.js
var HttpError, Redirect, SvelteKitError, ActionFailure;
var init_internal = __esm({
  "../node_modules/.pnpm/@sveltejs+kit@2.70.3_@opentelemetry+api@1.9.0_@sveltejs+vite-plugin-svelte@7.3.0_svelte_07dee83374ba99f2424e63b515f8a75b/node_modules/@sveltejs/kit/src/exports/internal/index.js"() {
    init_remote_functions();
    HttpError = class {
      static {
        __name(this, "HttpError");
      }
      /**
       * @param {number} status
       * @param {{message: string} extends App.Error ? (App.Error | string | undefined) : App.Error} body
       */
      constructor(status, body) {
        this.status = status;
        if (typeof body === "string") {
          this.body = { message: body };
        } else if (body) {
          this.body = body;
        } else {
          this.body = { message: `Error: ${status}` };
        }
      }
      toString() {
        return JSON.stringify(this.body);
      }
    };
    Redirect = class {
      static {
        __name(this, "Redirect");
      }
      /**
       * @param {300 | 301 | 302 | 303 | 304 | 305 | 306 | 307 | 308} status
       * @param {string} location
       */
      constructor(status, location) {
        try {
          new Headers({ location });
        } catch {
          throw new Error(
            `Invalid redirect location ${JSON.stringify(location)}: this string contains characters that cannot be used in HTTP headers`
          );
        }
        this.status = status;
        this.location = location;
      }
    };
    SvelteKitError = class extends Error {
      static {
        __name(this, "SvelteKitError");
      }
      /**
       * @param {number} status
       * @param {string} text
       * @param {string} message
       */
      constructor(status, text2, message) {
        super(message);
        this.status = status;
        this.text = text2;
      }
    };
    ActionFailure = class {
      static {
        __name(this, "ActionFailure");
      }
      /**
       * @param {number} status
       * @param {T} data
       */
      constructor(status, data) {
        this.status = status;
        this.data = data;
      }
    };
  }
});

// .svelte-kit/output/server/chunks/shared.js
function noop2() {
}
function once2(fn) {
  let done = false;
  let result;
  return () => {
    if (done) return result;
    done = true;
    return result = fn();
  };
}
function encode_native(array_buffer) {
  return new Uint8Array(array_buffer).toBase64();
}
function decode_native(base64) {
  return Uint8Array.fromBase64(base64).buffer;
}
function encode_buffer(array_buffer) {
  return Buffer.from(array_buffer).toString("base64");
}
function decode_buffer(base64) {
  return Uint8Array.from(Buffer.from(base64, "base64")).buffer;
}
function encode_legacy(array_buffer) {
  const array2 = new Uint8Array(array_buffer);
  let binary = "";
  const chunk_size = 32768;
  for (let i = 0; i < array2.length; i += chunk_size) {
    const chunk = array2.subarray(i, i + chunk_size);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}
function decode_legacy(base64) {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const array2 = new Uint8Array(len);
  for (let i = 0; i < len; i++) array2[i] = binary_string.charCodeAt(i);
  return array2.buffer;
}
function merge_operations(defaults, overrides) {
  if (!overrides) return defaults;
  const merged = {};
  for (const key2 of Object.keys(defaults)) merged[key2] = overrides[key2] ?? defaults[key2];
  return merged;
}
function parse(serialized, revivers, options2) {
  return unflatten(JSON.parse(serialized), revivers, options2);
}
function unflatten(parsed, revivers, options2) {
  const ops = merge_operations(default_parse_operations, options2?.operations);
  if (typeof parsed === "number") return hydrate3(parsed, true);
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Invalid input");
  const values = parsed;
  const hydrated = Array(values.length);
  let hydrating2 = null;
  function hydrate3(index23, standalone = false) {
    if (index23 === -1) return ops.fromPrimitive(void 0);
    if (index23 === -3) return ops.fromPrimitive(NaN);
    if (index23 === -4) return ops.fromPrimitive(Infinity);
    if (index23 === -5) return ops.fromPrimitive(-Infinity);
    if (index23 === -6) return ops.fromPrimitive(-0);
    if (standalone || typeof index23 !== "number") throw new Error(`Invalid input`);
    if (index23 in hydrated) return hydrated[index23];
    if (index23 >= values.length) throw new Error(`Invalid input`);
    const value = values[index23];
    if (!value || typeof value !== "object") hydrated[index23] = ops.fromPrimitive(value);
    else if (Array.isArray(value)) {
      if (typeof value[0] === "string") {
        const type = value[0];
        const reviver = revivers && Object.hasOwn(revivers, type) ? revivers[type] : void 0;
        if (reviver) {
          let i = value[1];
          if (typeof i !== "number") i = values.push(value[1]) - 1;
          if (Object.hasOwn(hydrated, i)) return hydrated[index23] = reviver(hydrated[i]);
          hydrating2 ??= /* @__PURE__ */ new Set();
          if (hydrating2.has(i)) throw new Error("Invalid circular reference");
          hydrating2.add(i);
          hydrated[index23] = reviver(hydrate3(i));
          hydrating2.delete(i);
          return hydrated[index23];
        }
        switch (type) {
          case "Date":
            hydrated[index23] = ops.fromISOString(value[1]);
            break;
          case "Set":
            const set2 = ops.createSet();
            hydrated[index23] = set2;
            for (let i = 1; i < value.length; i += 1) ops.addValue(set2, hydrate3(value[i]));
            break;
          case "Map":
            const map = ops.createMap();
            hydrated[index23] = map;
            for (let i = 1; i < value.length; i += 2) ops.addEntry(map, hydrate3(value[i]), hydrate3(value[i + 1]));
            break;
          case "RegExp":
            hydrated[index23] = ops.fromRegExpInfo(value[1], value[2]);
            break;
          case "Object": {
            const wrapped_index = value[1];
            if (typeof values[wrapped_index] === "object" && values[wrapped_index][0] !== "BigInt") throw new Error("Invalid input");
            hydrated[index23] = ops.box(hydrate3(wrapped_index));
            break;
          }
          case "BigInt":
            hydrated[index23] = ops.fromPrimitive(BigInt(value[1]));
            break;
          case "null":
            const obj = ops.createNullPrototypeObject();
            hydrated[index23] = obj;
            for (let i = 1; i < value.length; i += 2) {
              if (value[i] === "__proto__") throw new Error("Cannot parse an object with a `__proto__` property");
              ops.set(obj, value[i], hydrate3(value[i + 1]));
            }
            break;
          case "Int8Array":
          case "Uint8Array":
          case "Uint8ClampedArray":
          case "Int16Array":
          case "Uint16Array":
          case "Float16Array":
          case "Int32Array":
          case "Uint32Array":
          case "Float32Array":
          case "Float64Array":
          case "BigInt64Array":
          case "BigUint64Array":
          case "DataView": {
            if (values[value[1]][0] !== "ArrayBuffer") throw new Error("Invalid data");
            const buffer2 = hydrate3(value[1]);
            hydrated[index23] = ops.fromViewInfo(type, buffer2, value[2], value[3]);
            break;
          }
          case "ArrayBuffer": {
            const base64 = value[1];
            if (typeof base64 !== "string") throw new Error("Invalid ArrayBuffer encoding");
            hydrated[index23] = ops.fromArrayBuffer(decode64(base64));
            break;
          }
          case "URL":
          case "URLSearchParams":
          case "Temporal.Duration":
          case "Temporal.Instant":
          case "Temporal.PlainDate":
          case "Temporal.PlainTime":
          case "Temporal.PlainDateTime":
          case "Temporal.PlainMonthDay":
          case "Temporal.PlainYearMonth":
          case "Temporal.ZonedDateTime":
            hydrated[index23] = ops.fromStringValue(type, value[1]);
            break;
          default:
            throw new Error(`Unknown type ${type}`);
        }
      } else if (value[0] === -7) {
        const len = value[1];
        if (!is_valid_array_len(len)) throw new Error("Invalid input");
        const array2 = ops.createSparseArray(len);
        hydrated[index23] = array2;
        for (let i = 2; i < value.length; i += 2) {
          const idx = value[i];
          if (!is_valid_array_index(idx) || idx >= len) throw new Error("Invalid input");
          ops.set(array2, idx, hydrate3(value[i + 1]));
        }
      } else {
        const array2 = ops.createArray(value.length);
        hydrated[index23] = array2;
        for (let i = 0; i < value.length; i += 1) {
          const n2 = value[i];
          if (n2 === -2) continue;
          ops.set(array2, i, hydrate3(n2));
        }
      }
    } else {
      const object = ops.createObject();
      hydrated[index23] = object;
      for (const key2 of Object.keys(value)) {
        if (key2 === "__proto__") throw new Error("Cannot parse an object with a `__proto__` property");
        ops.set(object, key2, hydrate3(value[key2]));
      }
    }
    return hydrated[index23];
  }
  __name(hydrate3, "hydrate");
  return hydrate3(0);
}
function stringify$1(value, reducers, options2) {
  const stringified = run2(false, value, reducers, options2);
  return typeof stringified === "string" ? stringified : `[${stringified.join(",")}]`;
}
function run2(async, value, reducers, options2) {
  const ops = merge_operations(default_stringify_operations, options2?.operations);
  const stringified = [];
  const indexes = /* @__PURE__ */ new Map();
  const custom = [];
  if (reducers) for (const key2 of Object.getOwnPropertyNames(reducers)) custom.push({
    key: key2,
    fn: reducers[key2]
  });
  const keys = [];
  let p = 0;
  function flatten(thing, index24) {
    const type = ops.typeOf(thing);
    if (type === "undefined") return -1;
    let number;
    if (type === "number") {
      number = ops.toPrimitive(thing);
      if (Number.isNaN(number)) return -3;
      if (number === Infinity) return -4;
      if (number === -Infinity) return -5;
      if (number === 0 && 1 / number < 0) return -6;
    }
    const id = ops.identify(thing);
    if (indexes.has(id)) return indexes.get(id);
    index24 ??= p++;
    indexes.set(id, index24);
    for (const { key: key2, fn } of custom) {
      const value2 = fn(thing);
      if (value2) {
        stringified[index24] = `["${key2}",${flatten(value2)}]`;
        return index24;
      }
    }
    if (type === "function") throw new DevalueError(`Cannot stringify a function`, keys, thing, value);
    else if (type === "symbol") throw new DevalueError(`Cannot stringify a Symbol primitive`, keys, thing, value);
    let str = "";
    if (type !== "object") str = stringify_primitive2(type === "number" ? number : ops.toPrimitive(thing));
    else if (ops.isThenable(thing)) {
      if (!async) throw new DevalueError(`Cannot stringify a Promise or thenable \u2014 use stringifyAsync instead`, keys, thing, value);
      str = ops.toPromise(thing).then((value2) => {
        const i = flatten(value2, index24);
        if (i < 0) stringified[index24] = i;
      });
    } else {
      const tag = ops.tagOf(thing);
      switch (tag) {
        case "Number":
        case "String":
        case "Boolean":
        case "BigInt":
          str = `["Object",${flatten(ops.unbox(thing))}]`;
          break;
        case "Date":
          str = `["Date","${ops.toISOString(thing)}"]`;
          break;
        case "URL":
          str = `["URL",${stringify_string(ops.toStringValue(thing))}]`;
          break;
        case "URLSearchParams":
          str = `["URLSearchParams",${stringify_string(ops.toStringValue(thing))}]`;
          break;
        case "RegExp":
          const { source: source2, flags: flags2 } = ops.regExpInfo(thing);
          str = flags2 ? `["RegExp",${stringify_string(source2)},"${flags2}"]` : `["RegExp",${stringify_string(source2)}]`;
          break;
        case "Array": {
          let mostly_dense = false;
          const length = ops.lengthOf(thing);
          str = "[";
          for (let i = 0; i < length; i += 1) {
            if (i > 0) str += ",";
            if (ops.hasOwn(thing, i)) {
              keys.push(`[${i}]`);
              str += flatten(ops.get(thing, i));
              keys.pop();
            } else if (mostly_dense) str += -2;
            else {
              const populated_keys = ops.indicesOf(thing);
              const population = populated_keys.length;
              const d2 = String(length).length;
              if ((length - population) * 3 > 4 + d2 + population * (d2 + 1)) {
                str = "[-7," + length;
                for (let j2 = 0; j2 < populated_keys.length; j2++) {
                  const key2 = populated_keys[j2];
                  keys.push(`[${key2}]`);
                  str += "," + key2 + "," + flatten(ops.get(thing, key2));
                  keys.pop();
                }
                break;
              } else {
                mostly_dense = true;
                str += -2;
              }
            }
          }
          str += "]";
          break;
        }
        case "Set":
          str = '["Set"';
          for (const value2 of ops.valuesOf(thing)) str += `,${flatten(value2)}`;
          str += "]";
          break;
        case "Map":
          str = '["Map"';
          for (const [key2, value2] of ops.entriesOf(thing)) {
            const key_type = ops.typeOf(key2);
            const key_is_primitive = key_type !== "object" && key_type !== "function" && key_type !== "symbol";
            keys.push(`.get(${key_is_primitive ? stringify_primitive2(ops.toPrimitive(key2)) : "..."})`);
            str += `,${flatten(key2)},${flatten(value2)}`;
            keys.pop();
          }
          str += "]";
          break;
        case "Int8Array":
        case "Uint8Array":
        case "Uint8ClampedArray":
        case "Int16Array":
        case "Uint16Array":
        case "Float16Array":
        case "Int32Array":
        case "Uint32Array":
        case "Float32Array":
        case "Float64Array":
        case "BigInt64Array":
        case "BigUint64Array": {
          const info = ops.viewInfo(thing);
          str = '["' + tag + '",' + flatten(info.buffer);
          if (info.byteLength !== info.bufferByteLength) str += `,${info.byteOffset},${info.length}`;
          str += "]";
          break;
        }
        case "DataView": {
          const info = ops.viewInfo(thing);
          str = '["' + tag + '",' + flatten(info.buffer);
          if (info.byteLength !== info.bufferByteLength) str += `,${info.byteOffset},${info.byteLength}`;
          str += "]";
          break;
        }
        case "ArrayBuffer":
          str = `["ArrayBuffer","${encode64(ops.toArrayBuffer(thing))}"]`;
          break;
        case "Temporal.Duration":
        case "Temporal.Instant":
        case "Temporal.PlainDate":
        case "Temporal.PlainTime":
        case "Temporal.PlainDateTime":
        case "Temporal.PlainMonthDay":
        case "Temporal.PlainYearMonth":
        case "Temporal.ZonedDateTime":
          str = `["${tag}",${stringify_string(ops.toStringValue(thing))}]`;
          break;
        default: {
          const shape = ops.shapeOf(thing);
          if (shape.kind === "not-plain") throw new DevalueError(`Cannot stringify arbitrary non-POJOs`, keys, thing, value);
          if (shape.kind === "symbol-keys") throw new DevalueError(`Cannot stringify POJOs with symbolic keys`, keys, thing, value);
          if (shape.kind === "null-proto") {
            str = '["null"';
            for (const key2 of shape.keys) {
              if (key2 === "__proto__") throw new DevalueError(`Cannot stringify objects with __proto__ keys`, keys, thing, value);
              keys.push(stringify_key(key2));
              str += `,${stringify_string(key2)},${flatten(ops.get(thing, key2))}`;
              keys.pop();
            }
            str += "]";
          } else {
            str = "{";
            let started = false;
            for (const key2 of shape.keys) {
              if (key2 === "__proto__") throw new DevalueError(`Cannot stringify objects with __proto__ keys`, keys, thing, value);
              if (started) str += ",";
              started = true;
              keys.push(stringify_key(key2));
              str += `${stringify_string(key2)}:${flatten(ops.get(thing, key2))}`;
              keys.pop();
            }
            str += "}";
          }
        }
      }
    }
    stringified[index24] = str;
    return index24;
  }
  __name(flatten, "flatten");
  const index23 = flatten(value);
  if (index23 < 0) return `${index23}`;
  return stringified;
}
function stringify_primitive2(thing) {
  const type = typeof thing;
  if (type === "string") return stringify_string(thing);
  if (thing === void 0) return (-1).toString();
  if (thing === 0 && 1 / thing < 0) return (-6).toString();
  if (type === "bigint") return `["BigInt","${thing}"]`;
  return String(thing);
}
function get_relative_path(from, to) {
  const from_parts = from.split(/[/\\]/);
  const to_parts = to.split(/[/\\]/);
  from_parts.pop();
  while (from_parts[0] === to_parts[0]) {
    from_parts.shift();
    to_parts.shift();
  }
  let i = from_parts.length;
  while (i--) from_parts[i] = "..";
  return from_parts.concat(to_parts).join("/");
}
function base64_encode2(bytes) {
  if (globalThis.Buffer) return globalThis.Buffer.from(bytes).toString("base64");
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
function base64_decode(encoded) {
  if (globalThis.Buffer) {
    const buffer2 = globalThis.Buffer.from(encoded, "base64");
    return new Uint8Array(buffer2);
  }
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function coalesce_to_error(err) {
  return err instanceof Error || err && err.name && err.message ? err : new Error(JSON.stringify(err));
}
function normalize_error(error2) {
  return error2;
}
function get_status(error2) {
  return error2 instanceof HttpError || error2 instanceof SvelteKitError ? error2.status : 500;
}
function get_message(error2) {
  return error2 instanceof SvelteKitError ? error2.text : "Internal Error";
}
function stringify2(data, transport) {
  return stringify$1(data, Object.fromEntries(Object.entries(transport).map(([k, v]) => [k, v.encode])));
}
function create_remote_arg_revivers(transport) {
  const remote_fns_revivers = {
    /** @type {(value: unknown) => unknown} */
    [remote_object]: (value) => value,
    /** @type {(value: unknown) => Map<unknown, unknown>} */
    [remote_map]: (value) => {
      if (!Array.isArray(value)) throw new Error("Invalid data for Map reviver");
      const map = /* @__PURE__ */ new Map();
      for (const item of value) {
        if (!Array.isArray(item) || item.length !== 2 || typeof item[0] !== "string" || typeof item[1] !== "string") throw new Error("Invalid data for Map reviver");
        const [key2, val] = item;
        map.set(parse$1(key2), parse$1(val));
      }
      return map;
    },
    /** @type {(value: unknown) => Set<unknown>} */
    [remote_set]: (value) => {
      if (!Array.isArray(value)) throw new Error("Invalid data for Set reviver");
      const set2 = /* @__PURE__ */ new Set();
      for (const item of value) {
        if (typeof item !== "string") throw new Error("Invalid data for Set reviver");
        set2.add(parse$1(item));
      }
      return set2;
    },
    /** @type {(value: any) => File} */
    [remote_file]: (value) => {
      if (!value || typeof value !== "object" || typeof value.name !== "string" || typeof value.type !== "string" || typeof value.size !== "number" || typeof value.lastModified !== "number" || !(value.data instanceof ArrayBuffer)) throw new Error("Invalid data for File reviver");
      const { data, name, ...meta } = value;
      return new File([data], name, meta);
    }
  };
  const all_revivers = {
    ...Object.fromEntries(Object.entries(transport).map(([k, v]) => [k, v.decode])),
    ...remote_fns_revivers
  };
  const parse$1 = /* @__PURE__ */ __name((data) => parse(data, all_revivers), "parse$1");
  return all_revivers;
}
function parse_remote_arg(string, transport) {
  if (!string) return void 0;
  return parse(new TextDecoder().decode(base64_decode(string.replaceAll("-", "+").replaceAll("_", "/"))), create_remote_arg_revivers(transport));
}
function create_remote_key(id, payload2) {
  return id + "/" + payload2;
}
function split_remote_key(key2) {
  const i = key2.lastIndexOf("/");
  if (i === -1) throw new Error(`Invalid remote key: ${key2}`);
  return {
    id: key2.slice(0, i),
    payload: key2.slice(i + 1)
  };
}
var native, buffer, encode64, decode64, NOT_PLAIN, SYMBOL_KEYS, default_stringify_operations, default_parse_operations, text_encoder2, INVALIDATED_PARAM, TRAILING_SLASH_PARAM, remote_object, remote_map, remote_set, remote_file, remote_arg_marker;
var init_shared = __esm({
  ".svelte-kit/output/server/chunks/shared.js"() {
    init_uneval();
    init_internal();
    __name(noop2, "noop");
    __name(once2, "once");
    __name(encode_native, "encode_native");
    __name(decode_native, "decode_native");
    __name(encode_buffer, "encode_buffer");
    __name(decode_buffer, "decode_buffer");
    __name(encode_legacy, "encode_legacy");
    __name(decode_legacy, "decode_legacy");
    native = typeof Uint8Array.fromBase64 === "function";
    buffer = typeof process === "object" && process.versions?.node !== void 0;
    encode64 = native ? encode_native : buffer ? encode_buffer : encode_legacy;
    decode64 = native ? decode_native : buffer ? decode_buffer : decode_legacy;
    __name(merge_operations, "merge_operations");
    NOT_PLAIN = Object.freeze({ kind: "not-plain" });
    SYMBOL_KEYS = Object.freeze({ kind: "symbol-keys" });
    default_stringify_operations = Object.freeze({
      identify: /* @__PURE__ */ __name((value) => value, "identify"),
      typeOf: /* @__PURE__ */ __name((value) => value === null ? "null" : typeof value, "typeOf"),
      toPrimitive: /* @__PURE__ */ __name((value) => value, "toPrimitive"),
      tagOf: /* @__PURE__ */ __name((value) => get_type(value), "tagOf"),
      isThenable: /* @__PURE__ */ __name((value) => typeof value.then === "function", "isThenable"),
      toPromise: /* @__PURE__ */ __name((thenable) => Promise.resolve(thenable), "toPromise"),
      unbox: /* @__PURE__ */ __name((boxed) => boxed.valueOf(), "unbox"),
      toISOString: /* @__PURE__ */ __name((date) => isNaN(date.getDate()) ? "" : date.toISOString(), "toISOString"),
      toStringValue: /* @__PURE__ */ __name((value) => value.toString(), "toStringValue"),
      regExpInfo: /* @__PURE__ */ __name((regexp) => ({
        source: regexp.source,
        flags: regexp.flags
      }), "regExpInfo"),
      valuesOf: /* @__PURE__ */ __name((set2) => set2, "valuesOf"),
      entriesOf: /* @__PURE__ */ __name((map) => map, "entriesOf"),
      viewInfo: /* @__PURE__ */ __name((view) => ({
        buffer: view.buffer,
        byteOffset: view.byteOffset,
        byteLength: view.byteLength,
        length: view.length,
        bufferByteLength: view.buffer.byteLength
      }), "viewInfo"),
      toArrayBuffer: /* @__PURE__ */ __name((buffer2) => buffer2, "toArrayBuffer"),
      lengthOf: /* @__PURE__ */ __name((array2) => array2.length, "lengthOf"),
      hasOwn: /* @__PURE__ */ __name((value, key2) => Object.hasOwn(value, key2), "hasOwn"),
      indicesOf: /* @__PURE__ */ __name((array2) => valid_array_indices(array2), "indicesOf"),
      shapeOf: /* @__PURE__ */ __name((value) => {
        if (!is_plain_object(value)) return NOT_PLAIN;
        if (enumerable_symbols(value).length > 0) return SYMBOL_KEYS;
        return {
          kind: Object.getPrototypeOf(value) === null ? "null-proto" : "plain",
          keys: Object.keys(value)
        };
      }, "shapeOf"),
      get: /* @__PURE__ */ __name((value, key2) => value[key2], "get")
    });
    default_parse_operations = Object.freeze({
      fromPrimitive: /* @__PURE__ */ __name((primitive) => primitive, "fromPrimitive"),
      fromISOString: /* @__PURE__ */ __name((iso) => new Date(iso), "fromISOString"),
      fromStringValue: /* @__PURE__ */ __name((tag, text2) => {
        if (tag === "URL") return new URL(text2);
        if (tag === "URLSearchParams") return new URLSearchParams(text2);
        return Temporal[tag.slice(9)].from(text2);
      }, "fromStringValue"),
      fromArrayBuffer: /* @__PURE__ */ __name((buffer2) => buffer2, "fromArrayBuffer"),
      fromRegExpInfo: /* @__PURE__ */ __name((source2, flags2) => new RegExp(source2, flags2), "fromRegExpInfo"),
      fromViewInfo: /* @__PURE__ */ __name((tag, buffer2, byteOffset, length) => {
        const Constructor = globalThis[tag];
        return byteOffset !== void 0 ? new Constructor(buffer2, byteOffset, length) : new Constructor(buffer2);
      }, "fromViewInfo"),
      box: /* @__PURE__ */ __name((value) => Object(value), "box"),
      createArray: /* @__PURE__ */ __name((length) => new Array(length), "createArray"),
      createSparseArray: /* @__PURE__ */ __name((length) => {
        const array2 = [];
        array2[MAX_ARRAY_INDEX] = void 0;
        delete array2[MAX_ARRAY_INDEX];
        array2.length = length;
        return array2;
      }, "createSparseArray"),
      createObject: /* @__PURE__ */ __name(() => ({}), "createObject"),
      createNullPrototypeObject: /* @__PURE__ */ __name(() => /* @__PURE__ */ Object.create(null), "createNullPrototypeObject"),
      createSet: /* @__PURE__ */ __name(() => /* @__PURE__ */ new Set(), "createSet"),
      createMap: /* @__PURE__ */ __name(() => /* @__PURE__ */ new Map(), "createMap"),
      set: /* @__PURE__ */ __name((target, key2, value) => {
        target[key2] = value;
      }, "set"),
      addValue: /* @__PURE__ */ __name((set2, value) => {
        set2.add(value);
      }, "addValue"),
      addEntry: /* @__PURE__ */ __name((map, key2, value) => {
        map.set(key2, value);
      }, "addEntry")
    });
    __name(parse, "parse");
    __name(unflatten, "unflatten");
    __name(stringify$1, "stringify$1");
    __name(run2, "run");
    __name(stringify_primitive2, "stringify_primitive");
    text_encoder2 = new TextEncoder();
    __name(get_relative_path, "get_relative_path");
    __name(base64_encode2, "base64_encode");
    __name(base64_decode, "base64_decode");
    __name(coalesce_to_error, "coalesce_to_error");
    __name(normalize_error, "normalize_error");
    __name(get_status, "get_status");
    __name(get_message, "get_message");
    INVALIDATED_PARAM = "x-sveltekit-invalidated";
    TRAILING_SLASH_PARAM = "x-sveltekit-trailing-slash";
    __name(stringify2, "stringify");
    remote_object = "__skrao";
    remote_map = "__skram";
    remote_set = "__skras";
    remote_file = "__skraf";
    remote_arg_marker = Symbol(remote_object);
    __name(create_remote_arg_revivers, "create_remote_arg_revivers");
    __name(parse_remote_arg, "parse_remote_arg");
    __name(create_remote_key, "create_remote_key");
    __name(split_remote_key, "split_remote_key");
  }
});

// .svelte-kit/output/server/chunks/internal.js
function override(paths) {
  base = paths.base;
  assets = paths.assets;
}
function reset() {
  base = initial.base;
  assets = initial.assets;
}
var base, assets, app_dir, initial;
var init_internal2 = __esm({
  ".svelte-kit/output/server/chunks/internal.js"() {
    base = "";
    assets = base;
    app_dir = "_app";
    initial = {
      base,
      assets
    };
    initial.base;
    __name(override, "override");
    __name(reset, "reset");
  }
});

// ../node_modules/.pnpm/esm-env@1.2.2/node_modules/esm-env/true.js
var true_default;
var init_true = __esm({
  "../node_modules/.pnpm/esm-env@1.2.2/node_modules/esm-env/true.js"() {
    true_default = true;
  }
});

// ../node_modules/.pnpm/esm-env@1.2.2/node_modules/esm-env/dev-fallback.js
var node_env, dev_fallback_default;
var init_dev_fallback = __esm({
  "../node_modules/.pnpm/esm-env@1.2.2/node_modules/esm-env/dev-fallback.js"() {
    node_env = "production";
    dev_fallback_default = node_env && !node_env.toLowerCase().startsWith("prod");
  }
});

// ../node_modules/.pnpm/esm-env@1.2.2/node_modules/esm-env/false.js
var init_false = __esm({
  "../node_modules/.pnpm/esm-env@1.2.2/node_modules/esm-env/false.js"() {
  }
});

// ../node_modules/.pnpm/esm-env@1.2.2/node_modules/esm-env/index.js
var init_esm_env = __esm({
  "../node_modules/.pnpm/esm-env@1.2.2/node_modules/esm-env/index.js"() {
    init_true();
    init_dev_fallback();
    init_false();
  }
});

// ../node_modules/.pnpm/@sveltejs+kit@2.70.3_@opentelemetry+api@1.9.0_@sveltejs+vite-plugin-svelte@7.3.0_svelte_07dee83374ba99f2424e63b515f8a75b/node_modules/@sveltejs/kit/src/runtime/pathname.js
var init_pathname = __esm({
  "../node_modules/.pnpm/@sveltejs+kit@2.70.3_@opentelemetry+api@1.9.0_@sveltejs+vite-plugin-svelte@7.3.0_svelte_07dee83374ba99f2424e63b515f8a75b/node_modules/@sveltejs/kit/src/runtime/pathname.js"() {
  }
});

// ../node_modules/.pnpm/@sveltejs+kit@2.70.3_@opentelemetry+api@1.9.0_@sveltejs+vite-plugin-svelte@7.3.0_svelte_07dee83374ba99f2424e63b515f8a75b/node_modules/@sveltejs/kit/src/runtime/utils.js
var text_encoder3;
var init_utils = __esm({
  "../node_modules/.pnpm/@sveltejs+kit@2.70.3_@opentelemetry+api@1.9.0_@sveltejs+vite-plugin-svelte@7.3.0_svelte_07dee83374ba99f2424e63b515f8a75b/node_modules/@sveltejs/kit/src/runtime/utils.js"() {
    init_esm_env();
    text_encoder3 = new TextEncoder();
  }
});

// ../node_modules/.pnpm/@sveltejs+kit@2.70.3_@opentelemetry+api@1.9.0_@sveltejs+vite-plugin-svelte@7.3.0_svelte_07dee83374ba99f2424e63b515f8a75b/node_modules/@sveltejs/kit/src/version.js
var init_version = __esm({
  "../node_modules/.pnpm/@sveltejs+kit@2.70.3_@opentelemetry+api@1.9.0_@sveltejs+vite-plugin-svelte@7.3.0_svelte_07dee83374ba99f2424e63b515f8a75b/node_modules/@sveltejs/kit/src/version.js"() {
  }
});

// ../node_modules/.pnpm/@sveltejs+kit@2.70.3_@opentelemetry+api@1.9.0_@sveltejs+vite-plugin-svelte@7.3.0_svelte_07dee83374ba99f2424e63b515f8a75b/node_modules/@sveltejs/kit/src/exports/index.js
function error(status, body) {
  if ((!true_default || dev_fallback_default) && (isNaN(status) || status < 400 || status > 599)) {
    throw new Error(`HTTP error status codes must be between 400 and 599 \u2014 ${status} is invalid`);
  }
  throw new HttpError(status, body);
}
function redirect(status, location) {
  if ((!true_default || dev_fallback_default) && (isNaN(status) || status < 300 || status > 308)) {
    throw new Error("Invalid status code");
  }
  throw new Redirect(
    // @ts-ignore
    status,
    location.toString()
  );
}
function isRedirect(e3) {
  return e3 instanceof Redirect;
}
function json(data, init2) {
  const body = JSON.stringify(data);
  const headers2 = new Headers(init2?.headers);
  if (!headers2.has("content-length")) {
    headers2.set("content-length", text_encoder3.encode(body).byteLength.toString());
  }
  if (!headers2.has("content-type")) {
    headers2.set("content-type", "application/json");
  }
  return new Response(body, {
    ...init2,
    headers: headers2
  });
}
function text(body, init2) {
  const headers2 = new Headers(init2?.headers);
  if (!headers2.has("content-length")) {
    const encoded = text_encoder3.encode(body);
    headers2.set("content-length", encoded.byteLength.toString());
    return new Response(encoded, {
      ...init2,
      headers: headers2
    });
  }
  return new Response(body, {
    ...init2,
    headers: headers2
  });
}
function fail(status, data) {
  return new ActionFailure(status, data);
}
var init_exports = __esm({
  "../node_modules/.pnpm/@sveltejs+kit@2.70.3_@opentelemetry+api@1.9.0_@sveltejs+vite-plugin-svelte@7.3.0_svelte_07dee83374ba99f2424e63b515f8a75b/node_modules/@sveltejs/kit/src/exports/index.js"() {
    init_internal();
    init_esm_env();
    init_pathname();
    init_utils();
    init_version();
    __name(error, "error");
    __name(redirect, "redirect");
    __name(isRedirect, "isRedirect");
    __name(json, "json");
    __name(text, "text");
    __name(fail, "fail");
  }
});

// ../node_modules/.pnpm/@sveltejs+kit@2.70.3_@opentelemetry+api@1.9.0_@sveltejs+vite-plugin-svelte@7.3.0_svelte_07dee83374ba99f2424e63b515f8a75b/node_modules/@sveltejs/kit/src/runtime/server/constants.js
var IN_WEBCONTAINER;
var init_constants = __esm({
  "../node_modules/.pnpm/@sveltejs+kit@2.70.3_@opentelemetry+api@1.9.0_@sveltejs+vite-plugin-svelte@7.3.0_svelte_07dee83374ba99f2424e63b515f8a75b/node_modules/@sveltejs/kit/src/runtime/server/constants.js"() {
    IN_WEBCONTAINER = !!globalThis.process?.versions?.webcontainer;
  }
});

// ../node_modules/.pnpm/@sveltejs+kit@2.70.3_@opentelemetry+api@1.9.0_@sveltejs+vite-plugin-svelte@7.3.0_svelte_07dee83374ba99f2424e63b515f8a75b/node_modules/@sveltejs/kit/src/exports/internal/event.js
function with_request_store(store, fn) {
  try {
    sync_store = store;
    return als2 ? als2.run(store, fn) : fn();
  } finally {
    if (!IN_WEBCONTAINER) {
      sync_store = null;
    }
  }
}
var sync_store, als2;
var init_event = __esm({
  "../node_modules/.pnpm/@sveltejs+kit@2.70.3_@opentelemetry+api@1.9.0_@sveltejs+vite-plugin-svelte@7.3.0_svelte_07dee83374ba99f2424e63b515f8a75b/node_modules/@sveltejs/kit/src/exports/internal/event.js"() {
    init_constants();
    sync_store = null;
    import("node:async_hooks").then((hooks) => als2 = new hooks.AsyncLocalStorage()).catch(() => {
    });
    __name(with_request_store, "with_request_store");
  }
});

// ../node_modules/.pnpm/@sveltejs+kit@2.70.3_@opentelemetry+api@1.9.0_@sveltejs+vite-plugin-svelte@7.3.0_svelte_07dee83374ba99f2424e63b515f8a75b/node_modules/@sveltejs/kit/src/exports/internal/server.js
function merge_tracing(event_like, current2) {
  return {
    ...event_like,
    tracing: {
      ...event_like.tracing,
      current: current2
    }
  };
}
var init_server2 = __esm({
  "../node_modules/.pnpm/@sveltejs+kit@2.70.3_@opentelemetry+api@1.9.0_@sveltejs+vite-plugin-svelte@7.3.0_svelte_07dee83374ba99f2424e63b515f8a75b/node_modules/@sveltejs/kit/src/exports/internal/server.js"() {
    init_event();
    __name(merge_tracing, "merge_tracing");
  }
});

// .svelte-kit/output/server/chunks/shared-server.js
function set_private_env(environment) {
  private_env = environment;
}
function set_public_env(environment) {
  public_env = environment;
}
var private_env, public_env;
var init_shared_server = __esm({
  ".svelte-kit/output/server/chunks/shared-server.js"() {
    private_env = {};
    public_env = {};
    __name(set_private_env, "set_private_env");
    __name(set_public_env, "set_public_env");
  }
});

// .svelte-kit/output/server/chunks/exports.js
function compact(arr) {
  return arr.filter(
    /** @returns {val is NonNullable<T>} */
    (val) => val != null
  );
}
function has_data_suffix2(pathname) {
  return pathname.endsWith(DATA_SUFFIX) || pathname.endsWith(HTML_DATA_SUFFIX);
}
function add_data_suffix2(pathname) {
  if (pathname.endsWith(".html")) return pathname.replace(/\.html$/, HTML_DATA_SUFFIX);
  return pathname.replace(/\/$/, "") + DATA_SUFFIX;
}
function strip_data_suffix2(pathname) {
  if (pathname.endsWith(HTML_DATA_SUFFIX)) return pathname.slice(0, -16) + ".html";
  return pathname.slice(0, -12);
}
function has_resolution_suffix2(pathname) {
  return pathname.endsWith(ROUTE_SUFFIX);
}
function add_resolution_suffix2(pathname) {
  return pathname.replace(/\/$/, "") + ROUTE_SUFFIX;
}
function strip_resolution_suffix2(pathname) {
  return pathname.slice(0, -11);
}
function resolve(base2, path) {
  if (path[0] === "/" && path[1] === "/") return path;
  let url = new URL(base2, internal);
  url = new URL(path, url);
  return url.protocol === internal.protocol ? url.pathname + url.search + url.hash : url.href;
}
function normalize_path(path, trailing_slash) {
  if (path === "/" || trailing_slash === "ignore") return path;
  if (trailing_slash === "never") return path.endsWith("/") ? path.slice(0, -1) : path;
  else if (trailing_slash === "always" && !path.endsWith("/")) return path + "/";
  return path;
}
function decode_pathname(pathname) {
  return pathname.split("%25").map(decodeURI).join("%25");
}
function decode_params(params) {
  for (const key2 in params) params[key2] = decodeURIComponent(params[key2]);
  return params;
}
function make_trackable(url, callback, search_params_callback, allow_hash = false) {
  const tracked = new URL(url);
  Object.defineProperty(tracked, "searchParams", {
    value: new Proxy(tracked.searchParams, { get(obj, key2) {
      if (key2 === "get" || key2 === "getAll" || key2 === "has") return (param, ...rest) => {
        search_params_callback(param);
        return obj[key2](param, ...rest);
      };
      callback();
      const value = Reflect.get(obj, key2);
      return typeof value === "function" ? value.bind(obj) : value;
    } }),
    enumerable: true,
    configurable: true
  });
  const tracked_url_properties = [
    "href",
    "pathname",
    "search",
    "toString",
    "toJSON"
  ];
  if (allow_hash) tracked_url_properties.push("hash");
  for (const property of tracked_url_properties) Object.defineProperty(tracked, property, {
    get() {
      callback();
      return url[property];
    },
    enumerable: true,
    configurable: true
  });
  tracked[/* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom")] = (_depth, opts, inspect) => {
    return inspect(url, opts);
  };
  tracked.searchParams[/* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom")] = (_depth, opts, inspect) => {
    return inspect(url.searchParams, opts);
  };
  if (!allow_hash) disable_hash(tracked);
  return tracked;
}
function disable_hash(url) {
  allow_nodejs_console_log(url);
  Object.defineProperty(url, "hash", { get() {
    throw new Error("Cannot access event.url.hash. Consider using `page.url.hash` inside a component instead");
  } });
}
function disable_search(url) {
  allow_nodejs_console_log(url);
  for (const property of ["search", "searchParams"]) Object.defineProperty(url, property, { get() {
    throw new Error(`Cannot access url.${property} on a page with prerendering enabled`);
  } });
}
function allow_nodejs_console_log(url) {
  url[/* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom")] = (_depth, opts, inspect) => {
    return inspect(new URL(url), opts);
  };
}
function hash(...values) {
  let hash2 = 5381;
  for (const value of values) if (typeof value === "string") {
    let i = value.length;
    while (i) hash2 = hash2 * 33 ^ value.charCodeAt(--i);
  } else if (ArrayBuffer.isView(value)) {
    const buffer2 = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    let i = buffer2.length;
    while (i) hash2 = hash2 * 33 ^ buffer2[--i];
  } else throw new TypeError("value must be a string or TypedArray");
  return (hash2 >>> 0).toString(36);
}
function exec(match, params, matchers) {
  const result = {};
  const values = match.slice(1);
  const values_needing_match = values.filter((value) => value !== void 0);
  let buffered = 0;
  for (let i = 0; i < params.length; i += 1) {
    const param = params[i];
    let value = values[i - buffered];
    if (param.chained && param.rest && buffered) {
      value = values.slice(i - buffered, i + 1).filter((s3) => s3).join("/");
      buffered = 0;
    }
    if (value === void 0) {
      if (param.rest) value = "";
      else continue;
    }
    if (!param.matcher || matchers[param.matcher](value)) {
      result[param.name] = value;
      const next_param = params[i + 1];
      const next_value = values[i + 1];
      if (next_param && !next_param.rest && next_param.optional && next_value && param.chained) buffered = 0;
      if (!next_param && !next_value && Object.keys(result).length === values_needing_match.length) buffered = 0;
      continue;
    }
    if (param.optional && param.chained) {
      buffered++;
      continue;
    }
    return;
  }
  if (buffered) return;
  return result;
}
function find_route(path, routes, matchers) {
  for (const route of routes) {
    const match = route.pattern.exec(path);
    if (!match) continue;
    const matched = exec(match, route.params, matchers);
    if (matched) return {
      route,
      params: decode_params(matched)
    };
  }
  return null;
}
function validator(expected) {
  function validate(module, file) {
    if (!module) return;
    for (const key2 in module) {
      if (key2[0] === "_" || expected.has(key2)) continue;
      const values = [...expected.values()];
      const hint = hint_for_supported_files(key2, file?.slice(file.lastIndexOf("."))) ?? `valid exports are ${values.join(", ")}, or anything with a '_' prefix`;
      throw new Error(`Invalid export '${key2}'${file ? ` in ${file}` : ""} (${hint})`);
    }
  }
  __name(validate, "validate");
  return validate;
}
function hint_for_supported_files(key2, ext = ".js") {
  const supported_files = [];
  if (valid_layout_exports.has(key2)) supported_files.push(`+layout${ext}`);
  if (valid_page_exports.has(key2)) supported_files.push(`+page${ext}`);
  if (valid_layout_server_exports.has(key2)) supported_files.push(`+layout.server${ext}`);
  if (valid_page_server_exports.has(key2)) supported_files.push(`+page.server${ext}`);
  if (valid_server_exports.has(key2)) supported_files.push(`+server${ext}`);
  if (supported_files.length > 0) return `'${key2}' is a valid export in ${supported_files.slice(0, -1).join(", ")}${supported_files.length > 1 ? " or " : ""}${supported_files.at(-1)}`;
}
var DATA_SUFFIX, HTML_DATA_SUFFIX, ROUTE_SUFFIX, noop_span, noop_span_context, internal, valid_layout_exports, valid_page_exports, valid_layout_server_exports, valid_page_server_exports, valid_server_exports, validate_layout_exports, validate_page_exports, validate_layout_server_exports, validate_page_server_exports, validate_server_exports;
var init_exports2 = __esm({
  ".svelte-kit/output/server/chunks/exports.js"() {
    init_server();
    __name(compact, "compact");
    DATA_SUFFIX = "/__data.json";
    HTML_DATA_SUFFIX = ".html__data.json";
    __name(has_data_suffix2, "has_data_suffix");
    __name(add_data_suffix2, "add_data_suffix");
    __name(strip_data_suffix2, "strip_data_suffix");
    ROUTE_SUFFIX = "/__route.js";
    __name(has_resolution_suffix2, "has_resolution_suffix");
    __name(add_resolution_suffix2, "add_resolution_suffix");
    __name(strip_resolution_suffix2, "strip_resolution_suffix");
    noop_span = {
      spanContext() {
        return noop_span_context;
      },
      setAttribute() {
        return this;
      },
      setAttributes() {
        return this;
      },
      addEvent() {
        return this;
      },
      setStatus() {
        return this;
      },
      updateName() {
        return this;
      },
      end() {
        return this;
      },
      isRecording() {
        return false;
      },
      recordException() {
        return this;
      },
      addLink() {
        return this;
      },
      addLinks() {
        return this;
      }
    };
    noop_span_context = {
      traceId: "",
      spanId: "",
      traceFlags: 0
    };
    internal = new URL("sveltekit-internal://");
    __name(resolve, "resolve");
    __name(normalize_path, "normalize_path");
    __name(decode_pathname, "decode_pathname");
    __name(decode_params, "decode_params");
    __name(make_trackable, "make_trackable");
    __name(disable_hash, "disable_hash");
    __name(disable_search, "disable_search");
    __name(allow_nodejs_console_log, "allow_nodejs_console_log");
    __name(hash, "hash");
    __name(exec, "exec");
    __name(find_route, "find_route");
    __name(validator, "validator");
    __name(hint_for_supported_files, "hint_for_supported_files");
    valid_layout_exports = /* @__PURE__ */ new Set([
      "load",
      "prerender",
      "csr",
      "ssr",
      "trailingSlash",
      "config"
    ]);
    valid_page_exports = /* @__PURE__ */ new Set([...valid_layout_exports, "entries"]);
    valid_layout_server_exports = /* @__PURE__ */ new Set([...valid_layout_exports]);
    valid_page_server_exports = /* @__PURE__ */ new Set([
      ...valid_layout_server_exports,
      "actions",
      "entries"
    ]);
    valid_server_exports = /* @__PURE__ */ new Set([
      "GET",
      "POST",
      "PATCH",
      "PUT",
      "DELETE",
      "OPTIONS",
      "HEAD",
      "fallback",
      "prerender",
      "trailingSlash",
      "config",
      "entries"
    ]);
    validate_layout_exports = validator(valid_layout_exports);
    validate_page_exports = validator(valid_page_exports);
    validate_layout_server_exports = validator(valid_layout_server_exports);
    validate_page_server_exports = validator(valid_page_server_exports);
    validate_server_exports = validator(valid_server_exports);
  }
});

// .svelte-kit/output/server/entries/hooks.server.js
var hooks_server_exports = {};
__export(hooks_server_exports, {
  handle: () => handle
});
var handle;
var init_hooks_server = __esm({
  ".svelte-kit/output/server/entries/hooks.server.js"() {
    handle = /* @__PURE__ */ __name(async ({ event, resolve: resolve2 }) => {
      const token = event.cookies.get("kondis_session");
      const service = event.platform?.env.KONDIS_API;
      const upstreamFetch = service ? service.fetch.bind(service) : globalThis.fetch.bind(globalThis);
      event.locals.kondisFetch = (input, init2) => {
        const request = new Request(input, init2);
        const url = new URL(request.url);
        if (service && url.pathname.startsWith("/api/v1/")) url.pathname = url.pathname.slice(7);
        const headers2 = new Headers(request.headers);
        if (token) headers2.set("authorization", `Bearer ${token}`);
        return upstreamFetch(new Request(new Request(url, request), { headers: headers2 }));
      };
      return resolve2(event);
    }, "handle");
  }
});

// .svelte-kit/output/server/chunks/internal2.js
function set_read_implementation(fn) {
  read_implementation = fn;
}
function set_manifest(_) {
}
function handle_event_propagation(event) {
  var handler_element = this;
  var owner_document = handler_element.ownerDocument;
  var event_name = event.type;
  var path = event.composedPath?.() || [];
  var current_target = path[0] || event.target;
  last_propagated_event = event;
  if (!last_propagated_event_clear_scheduled) {
    last_propagated_event_clear_scheduled = true;
    setTimeout(() => {
      last_propagated_event_clear_scheduled = false;
      last_propagated_event = null;
    });
  }
  var path_idx = 0;
  var handled_at = last_propagated_event === event && event[event_symbol];
  if (handled_at) {
    var at_idx = path.indexOf(handled_at);
    if (at_idx !== -1 && (handler_element === document || handler_element === window)) {
      event[event_symbol] = handler_element;
      return;
    }
    var handler_idx = path.indexOf(handler_element);
    if (handler_idx === -1) return;
    if (at_idx <= handler_idx) path_idx = at_idx;
  }
  current_target = path[path_idx] || event.target;
  if (current_target === handler_element) return;
  define_property(event, "currentTarget", {
    configurable: true,
    get() {
      return current_target || owner_document;
    }
  });
  var previous_reaction = active_reaction;
  var previous_effect = active_effect;
  set_active_reaction(null);
  set_active_effect(null);
  try {
    var throw_error;
    var other_errors = [];
    while (current_target !== null) {
      if (current_target === handler_element) break;
      try {
        var delegated = current_target[event_symbol]?.[event_name];
        if (delegated != null && (!current_target.disabled || event.target === current_target)) delegated.call(current_target, event);
      } catch (error2) {
        if (throw_error) other_errors.push(error2);
        else throw_error = error2;
      }
      if (event.cancelBubble) break;
      path_idx++;
      current_target = path_idx < path.length ? path[path_idx] : null;
    }
    if (throw_error) {
      for (let error2 of other_errors) queueMicrotask(() => {
        throw error2;
      });
      throw throw_error;
    }
  } finally {
    event[event_symbol] = handler_element;
    delete event.currentTarget;
    set_active_reaction(previous_reaction);
    set_active_effect(previous_effect);
  }
}
function assign_nodes(start, end) {
  var effect = active_effect;
  if (effect.nodes === null) effect.nodes = {
    start,
    end,
    a: null,
    t: null
  };
}
function createSubscriber(start) {
  let subscribers = 0;
  let version2 = source(0);
  let stop;
  return () => {
    if (effect_tracking()) {
      get(version2);
      render_effect(() => {
        if (subscribers === 0) stop = untrack(() => start(() => increment(version2)));
        subscribers += 1;
        return () => {
          queue_micro_task(() => {
            subscribers -= 1;
            if (subscribers === 0) {
              stop?.();
              stop = void 0;
              increment(version2);
            }
          });
        };
      });
    }
  };
}
function boundary(node, props, children, transform_error) {
  new Boundary(node, props, children, transform_error);
}
function mount2(component22, options2) {
  return _mount(component22, options2);
}
function hydrate2(component22, options2) {
  init_operations();
  options2.intro = options2.intro ?? false;
  const target = options2.target;
  const was_hydrating = hydrating;
  const previous_hydrate_node = hydrate_node;
  try {
    var anchor = /* @__PURE__ */ get_first_child(target);
    while (anchor && (anchor.nodeType !== 8 || anchor.data !== "[")) anchor = /* @__PURE__ */ get_next_sibling(anchor);
    if (!anchor) throw HYDRATION_ERROR;
    set_hydrating(true);
    set_hydrate_node(anchor);
    const instance = _mount(component22, {
      ...options2,
      anchor
    });
    set_hydrating(false);
    return instance;
  } catch (error2) {
    if (error2 instanceof Error && error2.message.split("\n").some((line) => line.startsWith("https://svelte.dev/e/"))) throw error2;
    if (error2 !== HYDRATION_ERROR) console.warn("Failed to hydrate: ", error2);
    if (options2.recover === false) hydration_failed();
    init_operations();
    clear_text_content(target);
    set_hydrating(false);
    return mount2(component22, options2);
  } finally {
    set_hydrating(was_hydrating);
    set_hydrate_node(previous_hydrate_node);
  }
}
function _mount(Component, { target, anchor, props = {}, events, context: context3, intro = true, transformError }) {
  init_operations();
  var component22 = void 0;
  var unmount3 = component_root(() => {
    var anchor_node = anchor ?? target.appendChild(create_text());
    boundary(anchor_node, { pending: /* @__PURE__ */ __name(() => {
    }, "pending") }, (anchor_node2) => {
      push$1({});
      var ctx = component_context;
      if (context3) ctx.c = context3;
      if (events)
        props.$$events = events;
      if (hydrating) assign_nodes(anchor_node2, null);
      component22 = Component(anchor_node2, props) || mark_as_component();
      if (hydrating) {
        active_effect.nodes.end = hydrate_node;
        if (hydrate_node === null || hydrate_node.nodeType !== 8 || hydrate_node.data !== "]") {
          hydration_mismatch();
          throw HYDRATION_ERROR;
        }
      }
      pop$1();
    }, transformError);
    var registered_events = /* @__PURE__ */ new Set();
    var event_handle = /* @__PURE__ */ __name((events2) => {
      for (var i = 0; i < events2.length; i++) {
        var event_name = events2[i];
        if (registered_events.has(event_name)) continue;
        registered_events.add(event_name);
        var passive = is_passive_event(event_name);
        for (const node of [target, document]) {
          var counts = listeners.get(node);
          if (counts === void 0) {
            counts = /* @__PURE__ */ new Map();
            listeners.set(node, counts);
          }
          var count = counts.get(event_name);
          if (count === void 0) {
            node.addEventListener(event_name, handle_event_propagation, { passive });
            counts.set(event_name, 1);
          } else counts.set(event_name, count + 1);
        }
      }
    }, "event_handle");
    event_handle(array_from(all_registered_events));
    root_event_handles.add(event_handle);
    return () => {
      for (var event_name of registered_events) for (const node of [target, document]) {
        var counts = listeners.get(node);
        var count = counts.get(event_name);
        if (--count == 0) {
          node.removeEventListener(event_name, handle_event_propagation);
          counts.delete(event_name);
          if (counts.size === 0) listeners.delete(node);
        } else counts.set(event_name, count);
      }
      root_event_handles.delete(event_handle);
      if (anchor_node !== anchor) anchor_node.parentNode?.removeChild(anchor_node);
    };
  });
  mounted_components.set(component22, unmount3);
  return component22;
}
function unmount2(component22, options2) {
  const fn = mounted_components.get(component22);
  if (fn) {
    mounted_components.delete(component22);
    return fn(options2);
  }
  return Promise.resolve();
}
function asClassComponent$1(component22) {
  return class extends Svelte4Component {
    /** @param {any} options */
    constructor(options2) {
      super({
        component: component22,
        ...options2
      });
    }
  };
}
function asClassComponent(component22) {
  const component_constructor = asClassComponent$1(component22);
  const _render = /* @__PURE__ */ __name((props, { context: context3, csp, transformError } = {}) => {
    const result = render(component22, {
      props,
      context: context3,
      csp,
      transformError
    });
    const munged = Object.defineProperties({}, {
      css: { value: {
        code: "",
        map: null
      } },
      head: { get: /* @__PURE__ */ __name(() => result.head, "get") },
      html: { get: /* @__PURE__ */ __name(() => result.body, "get") },
      then: {
        /**
        * this is not type-safe, but honestly it's the best I can do right now, and it's a straightforward function.
        *
        * @template TResult1
        * @template [TResult2=never]
        * @param { (value: LegacyRenderResult) => TResult1 } onfulfilled
        * @param { (reason: unknown) => TResult2 } onrejected
        */
        value: /* @__PURE__ */ __name((onfulfilled, onrejected) => {
          if (!async_mode_flag) {
            const user_result = onfulfilled({
              css: munged.css,
              head: munged.head,
              html: munged.html
            });
            return Promise.resolve(user_result);
          }
          return result.then((result2) => {
            return onfulfilled({
              css: munged.css,
              head: result2.head,
              html: result2.body,
              hashes: result2.hashes
            });
          }, onrejected);
        }, "value")
      }
    });
    return munged;
  }, "_render");
  component_constructor.render = _render;
  return component_constructor;
}
function Root($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { stores, page: page3, constructors, components = [], form, data_0 = null, data_1 = null } = $$props;
    setContext("__svelte__", stores);
    stores.page.set(page3);
    const Pyramid_1 = derived(() => constructors[1]);
    if (constructors[1]) {
      $$renderer2.push("<!--[0-->");
      const Pyramid_0 = constructors[0];
      if (Pyramid_0) {
        $$renderer2.push("<!--[-->");
        Pyramid_0($$renderer2, {
          data: data_0,
          form,
          params: page3.params,
          children: /* @__PURE__ */ __name(($$renderer3) => {
            if (Pyramid_1()) {
              $$renderer3.push("<!--[-->");
              Pyramid_1()($$renderer3, {
                data: data_1,
                form,
                params: page3.params
              });
              $$renderer3.push("<!--]-->");
            } else {
              $$renderer3.push("<!--[!-->");
              $$renderer3.push("<!--]-->");
            }
          }, "children"),
          $$slots: { default: true }
        });
        $$renderer2.push("<!--]-->");
      } else {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push("<!--]-->");
      }
    } else {
      $$renderer2.push("<!--[-1-->");
      const Pyramid_0 = constructors[0];
      if (Pyramid_0) {
        $$renderer2.push("<!--[-->");
        Pyramid_0($$renderer2, {
          data: data_0,
          form,
          params: page3.params
        });
        $$renderer2.push("<!--]-->");
      } else {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push("<!--]-->");
      }
    }
    $$renderer2.push(`<!--]--> `);
    $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]-->`);
  });
}
async function get_hooks() {
  let handle2;
  let handleFetch;
  let handleError;
  let handleValidationError;
  let init2;
  ({ handle: handle2, handleFetch, handleError, handleValidationError, init: init2 } = await Promise.resolve().then(() => (init_hooks_server(), hooks_server_exports)));
  let reroute;
  let transport;
  return {
    handle: handle2,
    handleFetch,
    handleError,
    handleValidationError,
    init: init2,
    reroute,
    transport
  };
}
var read_implementation, event_symbol, all_registered_events, root_event_handles, last_propagated_event, last_propagated_event_clear_scheduled, flags, Boundary, listeners, mounted_components, Svelte4Component, root_default, error_template_default, options;
var init_internal22 = __esm({
  ".svelte-kit/output/server/chunks/internal2.js"() {
    init_index_server();
    init_internal2();
    init_server();
    read_implementation = null;
    __name(set_read_implementation, "set_read_implementation");
    __name(set_manifest, "set_manifest");
    event_symbol = /* @__PURE__ */ Symbol("events");
    all_registered_events = /* @__PURE__ */ new Set();
    root_event_handles = /* @__PURE__ */ new Set();
    last_propagated_event = null;
    last_propagated_event_clear_scheduled = false;
    __name(handle_event_propagation, "handle_event_propagation");
    globalThis?.window?.trustedTypes;
    __name(assign_nodes, "assign_nodes");
    __name(createSubscriber, "createSubscriber");
    flags = EFFECT_TRANSPARENT | EFFECT_PRESERVED;
    __name(boundary, "boundary");
    Boundary = class {
      static {
        __name(this, "Boundary");
      }
      /** @type {Boundary | null} */
      parent;
      is_pending = false;
      /**
      * API-level transformError transform function. Transforms errors before they reach the `failed` snippet.
      * Inherited from parent boundary, or defaults to identity.
      * @type {(error: unknown) => unknown}
      */
      transform_error;
      /** @type {TemplateNode} */
      #anchor;
      /** @type {TemplateNode | null} */
      #hydrate_open = hydrating ? hydrate_node : null;
      /** @type {BoundaryProps} */
      #props;
      /** @type {((anchor: Node) => void)} */
      #children;
      /** @type {Effect} */
      #effect;
      /** @type {Effect | null} */
      #main_effect = null;
      /** @type {Effect | null} */
      #pending_effect = null;
      /** @type {Effect | null} */
      #failed_effect = null;
      /** @type {DocumentFragment | null} */
      #offscreen_fragment = null;
      #local_pending_count = 0;
      #pending_count = 0;
      #pending_count_update_queued = false;
      /** @type {Set<Effect>} */
      #dirty_effects = /* @__PURE__ */ new Set();
      /** @type {Set<Effect>} */
      #maybe_dirty_effects = /* @__PURE__ */ new Set();
      /**
      * A source containing the number of pending async deriveds/expressions.
      * Only created if `$effect.pending()` is used inside the boundary,
      * otherwise updating the source results in needless `Batch.ensure()`
      * calls followed by no-op flushes
      * @type {Source<number> | null}
      */
      #effect_pending = null;
      #effect_pending_subscriber = createSubscriber(() => {
        this.#effect_pending = source(this.#local_pending_count);
        return () => {
          this.#effect_pending = null;
        };
      });
      /**
      * @param {TemplateNode} node
      * @param {BoundaryProps} props
      * @param {((anchor: Node) => void)} children
      * @param {((error: unknown) => unknown) | undefined} [transform_error]
      */
      constructor(node, props, children, transform_error) {
        this.#anchor = node;
        this.#props = props;
        this.#children = (anchor) => {
          var effect = active_effect;
          effect.b = this;
          effect.f |= 128;
          children(anchor);
        };
        this.parent = active_effect.b;
        this.transform_error = transform_error ?? this.parent?.transform_error ?? ((e3) => e3);
        this.#effect = block(() => {
          if (hydrating) {
            const comment = this.#hydrate_open;
            hydrate_next();
            const server_rendered_pending = comment.data === "[!";
            if (comment.data.startsWith("[?")) {
              const serialized_error = JSON.parse(comment.data.slice(2));
              this.#hydrate_failed_content(serialized_error);
            } else if (server_rendered_pending) this.#hydrate_pending_content();
            else this.#hydrate_resolved_content();
          } else this.#render();
        }, flags);
        if (hydrating) this.#anchor = hydrate_node;
      }
      #hydrate_resolved_content() {
        try {
          this.#main_effect = branch(() => this.#children(this.#anchor));
        } catch (error2) {
          this.error(error2);
        }
      }
      /**
      * @param {unknown} error The deserialized error from the server's hydration comment
      */
      #hydrate_failed_content(error2) {
        const failed = this.#props.failed;
        const { reset: reset2, invoke_onerror } = this.#create_reset(error2);
        queue_micro_task(invoke_onerror);
        if (!failed) return;
        this.#failed_effect = branch(() => {
          failed(this.#anchor, () => error2, () => reset2);
        });
      }
      /**
      * Creates the `reset` function for a failed boundary, along with a function
      * that invokes `onerror` with it (if provided)
      * @param {unknown} error
      * @returns {{ reset: () => void, invoke_onerror: () => void }}
      */
      #create_reset(error2) {
        var did_reset = false;
        var calling_on_error = false;
        const reset2 = /* @__PURE__ */ __name(() => {
          if (did_reset) {
            svelte_boundary_reset_noop();
            return;
          }
          did_reset = true;
          if (calling_on_error) svelte_boundary_reset_onerror();
          if (this.#failed_effect !== null) pause_effect(this.#failed_effect, () => {
            this.#failed_effect = null;
          });
          this.#run(() => {
            this.#render();
          });
        }, "reset");
        const invoke_onerror = /* @__PURE__ */ __name(() => {
          try {
            calling_on_error = true;
            this.#props.onerror?.(error2, reset2);
            calling_on_error = false;
          } catch (err) {
            invoke_error_boundary(err, this.#effect && this.#effect.parent);
          }
        }, "invoke_onerror");
        return {
          reset: reset2,
          invoke_onerror
        };
      }
      #hydrate_pending_content() {
        const pending = this.#props.pending;
        if (!pending) return;
        this.is_pending = true;
        this.#pending_effect = branch(() => pending(this.#anchor));
        queue_micro_task(() => {
          var fragment = this.#offscreen_fragment = document.createDocumentFragment();
          var anchor = create_text();
          var handled = false;
          fragment.append(anchor);
          this.#main_effect = this.#run(() => {
            try {
              return branch(() => this.#children(anchor));
            } catch (error2) {
              try {
                this.error(error2);
                handled = true;
              } catch (error3) {
                invoke_error_boundary(error3, this.#effect.parent);
              }
              return null;
            }
          });
          if (this.#main_effect === null) {
            this.#offscreen_fragment = null;
            if (handled) this.#resolve(current_batch);
            return;
          }
          if (this.#pending_count === 0) {
            this.#anchor.before(fragment);
            this.#offscreen_fragment = null;
            pause_effect(this.#pending_effect, () => {
              this.#pending_effect = null;
            });
            this.#resolve(current_batch);
          }
        });
      }
      #render() {
        try {
          this.is_pending = this.has_pending_snippet();
          this.#pending_count = 0;
          this.#local_pending_count = 0;
          this.#main_effect = branch(() => {
            this.#children(this.#anchor);
          });
          if (this.#pending_count > 0) {
            var fragment = this.#offscreen_fragment = document.createDocumentFragment();
            move_effect(this.#main_effect, fragment);
            const pending = this.#props.pending;
            this.#pending_effect = branch(() => pending(this.#anchor));
          } else this.#resolve(current_batch);
        } catch (error2) {
          this.error(error2);
        }
      }
      /**
      * @param {Batch} batch
      */
      #resolve(batch) {
        this.is_pending = false;
        batch.transfer_effects(this.#dirty_effects, this.#maybe_dirty_effects);
      }
      /**
      * Defer an effect inside a pending boundary until the boundary resolves
      * @param {Effect} effect
      */
      defer_effect(effect) {
        defer_effect(effect, this.#dirty_effects, this.#maybe_dirty_effects);
      }
      /**
      * Returns `false` if the effect exists inside a boundary whose pending snippet is shown
      * @returns {boolean}
      */
      is_rendered() {
        return !this.is_pending && (!this.parent || this.parent.is_rendered());
      }
      has_pending_snippet() {
        return !!this.#props.pending;
      }
      /**
      * @template T
      * @param {() => T} fn
      */
      #run(fn) {
        var previous_effect = active_effect;
        var previous_reaction = active_reaction;
        var previous_ctx = component_context;
        set_active_effect(this.#effect);
        set_active_reaction(this.#effect);
        set_component_context(this.#effect.ctx);
        try {
          Batch.ensure();
          return fn();
        } finally {
          set_active_effect(previous_effect);
          set_active_reaction(previous_reaction);
          set_component_context(previous_ctx);
        }
      }
      /**
      * Updates the pending count associated with the currently visible pending snippet,
      * if any, such that we can replace the snippet with content once work is done
      * @param {1 | -1} d
      * @param {Batch} batch
      */
      #update_pending_count(d2, batch) {
        if (!this.has_pending_snippet()) {
          if (this.parent) this.parent.#update_pending_count(d2, batch);
          return;
        }
        this.#pending_count += d2;
        if (this.#pending_count === 0) {
          this.#resolve(batch);
          if (this.#pending_effect) pause_effect(this.#pending_effect, () => {
            this.#pending_effect = null;
          });
          if (this.#offscreen_fragment) {
            this.#anchor.before(this.#offscreen_fragment);
            this.#offscreen_fragment = null;
          }
        }
      }
      /**
      * Update the source that powers `$effect.pending()` inside this boundary,
      * and controls when the current `pending` snippet (if any) is removed.
      * Do not call from inside the class
      * @param {1 | -1} d
      * @param {Batch} batch
      */
      update_pending_count(d2, batch) {
        this.#update_pending_count(d2, batch);
        this.#local_pending_count += d2;
        if (!this.#effect_pending || this.#pending_count_update_queued) return;
        this.#pending_count_update_queued = true;
        queue_micro_task(() => {
          this.#pending_count_update_queued = false;
          if (this.#effect_pending) internal_set(this.#effect_pending, this.#local_pending_count);
        });
      }
      get_effect_pending() {
        this.#effect_pending_subscriber();
        return get(this.#effect_pending);
      }
      /** @param {unknown} error */
      error(error2) {
        if (!this.#props.onerror && !this.#props.failed) throw error2;
        if (current_batch?.is_fork) {
          if (this.#main_effect) current_batch.skip_effect(this.#main_effect);
          if (this.#pending_effect) current_batch.skip_effect(this.#pending_effect);
          if (this.#failed_effect) current_batch.skip_effect(this.#failed_effect);
          current_batch.oncommit(() => {
            this.#handle_error(error2);
          });
        } else this.#handle_error(error2);
      }
      /**
      * @param {unknown} error
      */
      #handle_error(error2) {
        if (this.#main_effect) {
          destroy_effect(this.#main_effect);
          this.#main_effect = null;
        }
        if (this.#pending_effect) {
          destroy_effect(this.#pending_effect);
          this.#pending_effect = null;
        }
        if (this.#failed_effect) {
          destroy_effect(this.#failed_effect);
          this.#failed_effect = null;
        }
        if (hydrating) {
          set_hydrate_node(this.#hydrate_open);
          next();
          set_hydrate_node(skip_nodes());
        }
        let failed = this.#props.failed;
        const handle_error_result = /* @__PURE__ */ __name((transformed_error) => {
          const { reset: reset2, invoke_onerror } = this.#create_reset(transformed_error);
          invoke_onerror();
          if (failed) this.#failed_effect = this.#run(() => {
            try {
              return branch(() => {
                var effect = active_effect;
                effect.b = this;
                effect.f |= 128;
                failed(this.#anchor, () => transformed_error, () => reset2);
              });
            } catch (error3) {
              invoke_error_boundary(error3, this.#effect.parent);
              return null;
            }
          });
        }, "handle_error_result");
        queue_micro_task(() => {
          var result;
          try {
            result = this.transform_error(error2);
          } catch (e3) {
            invoke_error_boundary(e3, this.#effect && this.#effect.parent);
            return;
          }
          if (result !== null && typeof result === "object" && typeof result.then === "function")
            result.then(
              handle_error_result,
              /** @param {unknown} e */
              (e3) => invoke_error_boundary(e3, this.#effect && this.#effect.parent)
            );
          else handle_error_result(result);
        });
      }
    };
    __name(mount2, "mount");
    __name(hydrate2, "hydrate");
    listeners = /* @__PURE__ */ new Map();
    __name(_mount, "_mount");
    mounted_components = /* @__PURE__ */ new WeakMap();
    __name(unmount2, "unmount");
    __name(asClassComponent$1, "asClassComponent$1");
    Svelte4Component = class {
      static {
        __name(this, "Svelte4Component");
      }
      /** @type {any} */
      #events;
      /** @type {Record<string, any>} */
      #instance;
      /**
      * @param {ComponentConstructorOptions & {
      *  component: any;
      * }} options
      */
      constructor(options2) {
        var sources = /* @__PURE__ */ new Map();
        var add_source = /* @__PURE__ */ __name((key2, value) => {
          var s3 = /* @__PURE__ */ mutable_source(value, false, false);
          sources.set(key2, s3);
          return s3;
        }, "add_source");
        const props = new Proxy({
          ...options2.props || {},
          $$events: {}
        }, {
          get(target, prop) {
            return get(sources.get(prop) ?? add_source(prop, Reflect.get(target, prop)));
          },
          has(target, prop) {
            if (prop === LEGACY_PROPS) return true;
            get(sources.get(prop) ?? add_source(prop, Reflect.get(target, prop)));
            return Reflect.has(target, prop);
          },
          set(target, prop, value) {
            set(sources.get(prop) ?? add_source(prop, value), value);
            return Reflect.set(target, prop, value);
          }
        });
        this.#instance = (options2.hydrate ? hydrate2 : mount2)(options2.component, {
          target: options2.target,
          anchor: options2.anchor,
          props,
          context: options2.context,
          intro: options2.intro ?? false,
          recover: options2.recover,
          transformError: options2.transformError
        });
        if (!async_mode_flag && (!options2?.props?.$$host || options2.sync === false)) flushSync();
        this.#events = props.$$events;
        for (const key2 of Object.keys(this.#instance)) {
          if (key2 === "$set" || key2 === "$destroy" || key2 === "$on") continue;
          define_property(this, key2, {
            get() {
              return this.#instance[key2];
            },
            /** @param {any} value */
            set(value) {
              this.#instance[key2] = value;
            },
            enumerable: true
          });
        }
        this.#instance.$set = (next2) => {
          Object.assign(props, next2);
        };
        this.#instance.$destroy = () => {
          unmount2(this.#instance);
        };
      }
      /** @param {Record<string, any>} props */
      $set(props) {
        this.#instance.$set(props);
      }
      /**
      * @param {string} event
      * @param {(...args: any[]) => any} callback
      * @returns {any}
      */
      $on(event, callback) {
        this.#events[event] = this.#events[event] || [];
        const cb = /* @__PURE__ */ __name((...args) => callback.call(this, ...args), "cb");
        this.#events[event].push(cb);
        return () => {
          this.#events[event] = this.#events[event].filter(
            /** @param {any} fn */
            (fn) => fn !== cb
          );
        };
      }
      $destroy() {
        this.#instance.$destroy();
      }
    };
    __name(asClassComponent, "asClassComponent");
    __name(Root, "Root");
    root_default = asClassComponent(Root);
    error_template_default = /* @__PURE__ */ __name(({ status, message }) => '<!doctype html>\n<html lang="en">\n	<head>\n		<meta charset="utf-8" />\n		<title>' + message + `</title>

		<style>
			body {
				--bg: white;
				--fg: #222;
				--divider: #ccc;
				background: var(--bg);
				color: var(--fg);
				font-family:
					system-ui,
					-apple-system,
					BlinkMacSystemFont,
					'Segoe UI',
					Roboto,
					Oxygen,
					Ubuntu,
					Cantarell,
					'Open Sans',
					'Helvetica Neue',
					sans-serif;
				display: flex;
				align-items: center;
				justify-content: center;
				height: 100vh;
				margin: 0;
			}

			.error {
				display: flex;
				align-items: center;
				max-width: 32rem;
				margin: 0 1rem;
			}

			.status {
				font-weight: 200;
				font-size: 3rem;
				line-height: 1;
				position: relative;
				top: -0.05rem;
			}

			.message {
				border-left: 1px solid var(--divider);
				padding: 0 0 0 1rem;
				margin: 0 0 0 1rem;
				min-height: 2.5rem;
				display: flex;
				align-items: center;
			}

			.message h1 {
				font-weight: 400;
				font-size: 1em;
				margin: 0;
			}

			@media (prefers-color-scheme: dark) {
				body {
					--bg: #222;
					--fg: #ddd;
					--divider: #666;
				}
			}
		</style>
	</head>
	<body>
		<div class="error">
			<span class="status">` + status + '</span>\n			<div class="message">\n				<h1>' + message + "</h1>\n			</div>\n		</div>\n	</body>\n</html>\n", "error_template_default");
    options = {
      app_template_contains_nonce: false,
      async: false,
      csp: {
        "mode": "auto",
        "directives": {
          "upgrade-insecure-requests": false,
          "block-all-mixed-content": false
        },
        "reportOnly": {
          "upgrade-insecure-requests": false,
          "block-all-mixed-content": false
        }
      },
      csrf_check_origin: true,
      csrf_trusted_origins: [],
      embedded: false,
      env_public_prefix: "PUBLIC_",
      env_private_prefix: "",
      hash_routing: false,
      hooks: null,
      preload_strategy: "modulepreload",
      root: root_default,
      service_worker: false,
      service_worker_options: void 0,
      server_error_boundaries: false,
      templates: {
        app: /* @__PURE__ */ __name(({ head: head2, body, assets: assets2, nonce, env: env2 }) => '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <meta name="theme-color" content="#08111f" />\n    <link rel="icon" href="/favicon.svg" />\n    <script>\n      try {\n        const theme = localStorage.getItem("kondis-theme");\n        if (theme === "light" || theme === "dark") {\n          document.documentElement.dataset.theme = theme;\n        }\n      } catch {}\n    <\/script>\n    ' + head2 + '\n  </head>\n  <body data-sveltekit-preload-data="hover">\n    <div style="display: contents">' + body + "</div>\n  </body>\n</html>\n", "app"),
        error: error_template_default
      },
      version_hash: "t4rjkv"
    };
    __name(get_hooks, "get_hooks");
  }
});

// .svelte-kit/output/server/chunks/api.js
function apiUrl(path) {
  const apiBase = private_env.KONDIS_API_URL ?? "http://localhost:2293";
  return new URL(path.replace(/^\//, ""), `${apiBase.replace(/\/$/, "")}/`);
}
function getServerSdkRequestOptions(fetchImpl) {
  return {
    baseUrl: apiUrl(API_PREFIX).toString(),
    fetch: fetchImpl
  };
}
function apiEndpointUrl(path) {
  return apiUrl(`api/${path.replace(/^\//, "")}`);
}
function activityEventsUrl(requestUrl, forwardedProto, cfVisitor, forwardedHost) {
  const url = new URL(requestUrl);
  const cloudflareScheme = cfVisitor?.match(/"scheme"\s*:\s*"(https?)"/)?.[1];
  const proxyProto = forwardedProto?.split(",", 1)[0]?.trim().toLowerCase();
  const proxyHost = forwardedHost?.split(",", 1)[0]?.trim().toLowerCase();
  const secure = cloudflareScheme === "https" || cloudflareScheme == null && proxyProto === "https" || cloudflareScheme == null && proxyProto == null && url.protocol === "https:" || (proxyHost?.split(":", 1)[0] ?? url.hostname) === "kondis-dev.jogenfors.se";
  const configured = public_env.PUBLIC_KONDIS_EVENTS_URL;
  if (configured) {
    const eventsUrl = new URL(configured, requestUrl);
    if (eventsUrl.hostname === requestUrl.hostname) {
      eventsUrl.protocol = secure ? "wss:" : "ws:";
      eventsUrl.port = secure ? "" : "2293";
    }
    return eventsUrl.toString();
  }
  url.protocol = secure ? "wss:" : "ws:";
  if (!secure) url.port = "2293";
  url.pathname = "/events";
  url.search = "";
  url.hash = "";
  return url.toString();
}
var API_PREFIX;
var init_api = __esm({
  ".svelte-kit/output/server/chunks/api.js"() {
    init_shared_server();
    API_PREFIX = "api/v1";
    __name(apiUrl, "apiUrl");
    __name(getServerSdkRequestOptions, "getServerSdkRequestOptions");
    __name(apiEndpointUrl, "apiEndpointUrl");
    __name(activityEventsUrl, "activityEventsUrl");
  }
});

// .svelte-kit/output/server/chunks/build.js
function d(e3, t4 = ",") {
  const o3 = /* @__PURE__ */ __name((n2, r3) => {
    const c2 = e3[r3 % e3.length];
    return typeof n2 > "u" ? "" : typeof n2 == "object" ? Array.isArray(n2) ? n2.map(c2).join(t4) : Object.entries(n2).reduce((i, f) => [...i, ...f], []).map(c2).join(t4) : c2(l$1(n2));
  }, "o");
  return (n2, ...r3) => n2.reduce((c2, u, i) => `${c2}${u}${o3(r3[i], i)}`, "");
}
function R(e3 = ",") {
  return (t4, o3 = a) => Object.entries(t4).filter(([, n2]) => n2 !== void 0).map(([n2, r3]) => d(o3, e3)`${n2}=${r3}`).join("&");
}
function j$1(...e3) {
  return e3.filter(Boolean).map((t4, o3) => o3 === 0 ? t4 : t4.replace(/^\/+/, "")).map((t4, o3, n2) => o3 === n2.length - 1 ? t4 : t4.replace(/\/+$/, "")).join("/");
}
function l$1(e3) {
  return typeof e3 == "string" || typeof e3 == "number" || typeof e3 == "boolean" ? e3 : String(e3);
}
function q(...r3) {
  const n2 = r3.filter(Boolean).join("&");
  return n2 && `?${n2}`;
}
function y$1(r3, n2 = a) {
  const o3 = d(n2);
  return Object.entries(r3).filter(([, t4]) => t4 !== void 0).map(([t4, e3]) => Array.isArray(e3) ? e3.map((i) => o3`${t4}=${i}`).join("&") : typeof e3 == "object" ? y$1(e3, n2) : o3`${t4}=${e3}`).join("&");
}
function o(e3, r3) {
  const n2 = t(e3);
  return t(r3).forEach((i, s3) => {
    n2.set(s3, i);
  }), n2;
}
function t(e3) {
  return e3 && !(e3 instanceof Headers) && !Array.isArray(e3) ? new Headers(Object.fromEntries(Object.entries(e3).filter(([, r3]) => r3 != null).map(([r3, n2]) => [r3, String(n2)]))) : new Headers(e3);
}
function D(a2 = {}) {
  async function r3(e3, n2) {
    const t4 = await p(e3, n2);
    let s3;
    try {
      s3 = await t4.text();
    } catch {
    }
    return {
      status: t4.status,
      headers: t4.headers,
      contentType: t4.headers.get("content-type"),
      data: s3
    };
  }
  __name(r3, "r");
  async function i(e3, n2 = {}) {
    const { status: t4, headers: s3, contentType: u, data: c2 } = await r3(e3, {
      ...n2,
      headers: o({ Accept: "application/json" }, n2.headers)
    });
    return (u ? u.includes("json") : false) ? {
      status: t4,
      headers: s3,
      data: c2 ? JSON.parse(c2) : null
    } : {
      status: t4,
      headers: s3,
      data: c2
    };
  }
  __name(i, "i");
  async function f(e3, n2 = {}) {
    const t4 = await p(e3, n2);
    let s3;
    try {
      s3 = await t4.blob();
    } catch {
    }
    return {
      status: t4.status,
      headers: t4.headers,
      data: s3
    };
  }
  __name(f, "f");
  async function p(e3, n2 = {}) {
    const { baseUrl: t4, fetch: s3, ...u } = {
      ...a2,
      ...n2,
      headers: o(a2.headers, n2.headers)
    }, c2 = j$1(t4, e3);
    return await (s3 || fetch)(c2, u);
  }
  __name(p, "p");
  return {
    ok: y,
    fetchText: r3,
    fetchJson: i,
    fetchBlob: f,
    mergeHeaders: o,
    json({ body: e3, headers: n2, ...t4 }) {
      return {
        ...t4,
        ...e3 != null && { body: JSON.stringify(e3) },
        headers: o({ "Content-Type": "application/json" }, n2)
      };
    },
    form({ body: e3, headers: n2, ...t4 }) {
      return {
        ...t4,
        ...e3 != null && { body: A(e3) },
        headers: o({ "Content-Type": "application/x-www-form-urlencoded" }, n2)
      };
    },
    multipart({ body: e3, headers: n2, ...t$1 }) {
      if (e3 == null) return {
        ...t$1,
        body: e3,
        headers: t(n2)
      };
      const s3 = new (t$1.FormData || t$1.formDataConstructor || a2.FormData || a2.formDataConstructor || FormData)(), u = /* @__PURE__ */ __name((c2, o3) => {
        typeof o3 == "string" || o3 instanceof Blob ? s3.append(c2, o3) : typeof o3 == "number" || typeof o3 == "boolean" ? s3.append(c2, String(o3)) : s3.append(c2, new Blob([JSON.stringify(o3)], { type: "application/json" }));
      }, "u");
      return Object.entries(e3).forEach(([c2, o3]) => {
        Array.isArray(o3) ? o3.forEach((m) => u(c2, m)) : u(c2, o3);
      }), {
        ...t$1,
        body: s3,
        headers: t(n2)
      };
    }
  };
}
async function y(a2) {
  const r3 = await a2;
  if (j.some((i) => i == r3.status)) return r3.data;
  throw new l(r3.status, r3.data, r3.headers);
}
function jobControllerGetAllJobStatus(opts) {
  return oazapfts.ok(oazapfts.fetchJson("/jobs", { ...opts }));
}
function jobControllerGetJobHistory({ limit, offset }, opts) {
  return oazapfts.ok(oazapfts.fetchJson(`/jobs/history${q(y$1({
    limit,
    offset
  }))}`, { ...opts }));
}
function activityControllerListTypes(opts) {
  return oazapfts.ok(oazapfts.fetchJson("/activities/types", { ...opts }));
}
function activityControllerListBestEfforts({ sport, $type }, opts) {
  return oazapfts.ok(oazapfts.fetchJson(`/activities/best-efforts/${encodeURIComponent(sport)}/${encodeURIComponent($type)}`, { ...opts }));
}
function activityControllerGetById({ id }, opts) {
  return oazapfts.ok(oazapfts.fetchJson(`/activities/${encodeURIComponent(id)}`, { ...opts }));
}
function activityControllerListMatchedRoutes({ id }, opts) {
  return oazapfts.ok(oazapfts.fetchJson(`/activities/${encodeURIComponent(id)}/matched-routes`, { ...opts }));
}
function socialControllerFeed({ cursor, limit, search, tags, tagMatch }, opts) {
  return oazapfts.ok(oazapfts.fetchJson(`/feed${q(y$1({
    cursor,
    limit,
    search,
    tags,
    tagMatch
  }))}`, { ...opts }));
}
var a, A, j, l, oazapfts, Status, Sport, Tags, Kind, Kind2, Status2, Name, QueueName_Output, Status3, QueueName, Command, ActivityType_Output, Status4, ActivityType, Status5, ActivityTag_Output, BestEffortType_Output, Type, Status6, AverageMetric, BestEffortGroup, BestEffortSport, BestEffortType, BestEffortSport_Output, BestEffortValueKind_Output, ActivityTag, Role, Role2, Type2;
var init_build = __esm({
  ".svelte-kit/output/server/chunks/build.js"() {
    a = [encodeURIComponent, encodeURIComponent];
    __name(d, "d");
    __name(R, "R");
    __name(j$1, "j$1");
    __name(l$1, "l$1");
    __name(q, "q");
    __name(y$1, "y$1");
    A = R();
    __name(o, "o");
    __name(t, "t");
    __name(D, "D");
    j = [
      200,
      201,
      202,
      204
    ];
    __name(y, "y");
    l = class extends Error {
      static {
        __name(this, "l");
      }
      status;
      data;
      headers;
      constructor(r3, i, f) {
        super(`Error: ${r3}`), this.status = r3, this.data = i, this.headers = f;
      }
    };
    oazapfts = D({
      headers: {},
      baseUrl: "/api/v1"
    });
    __name(jobControllerGetAllJobStatus, "jobControllerGetAllJobStatus");
    __name(jobControllerGetJobHistory, "jobControllerGetJobHistory");
    __name(activityControllerListTypes, "activityControllerListTypes");
    __name(activityControllerListBestEfforts, "activityControllerListBestEfforts");
    __name(activityControllerGetById, "activityControllerGetById");
    __name(activityControllerListMatchedRoutes, "activityControllerListMatchedRoutes");
    __name(socialControllerFeed, "socialControllerFeed");
    (function(Status7) {
      Status7["Scanning"] = "scanning";
    })(Status || (Status = {}));
    (function(Sport2) {
      Sport2["AlpineSki"] = "alpine_ski";
      Sport2["BackcountrySki"] = "backcountry_ski";
      Sport2["Badminton"] = "badminton";
      Sport2["Basketball"] = "basketball";
      Sport2["Canoeing"] = "canoeing";
      Sport2["Cricket"] = "cricket";
      Sport2["CrossCountrySki"] = "cross_country_ski";
      Sport2["Crossfit"] = "crossfit";
      Sport2["Dance"] = "dance";
      Sport2["EBikeRide"] = "e_bike_ride";
      Sport2["Elliptical"] = "elliptical";
      Sport2["EMountainBikeRide"] = "e_mountain_bike_ride";
      Sport2["Golf"] = "golf";
      Sport2["GravelRide"] = "gravel_ride";
      Sport2["Handcycle"] = "handcycle";
      Sport2["HighIntensityIntervalTraining"] = "high_intensity_interval_training";
      Sport2["Hike"] = "hike";
      Sport2["IceSkate"] = "ice_skate";
      Sport2["InlineSkate"] = "inline_skate";
      Sport2["Kayaking"] = "kayaking";
      Sport2["Kitesurf"] = "kitesurf";
      Sport2["MountainBikeRide"] = "mountain_bike_ride";
      Sport2["Padel"] = "padel";
      Sport2["PhysicalTherapy"] = "physical_therapy";
      Sport2["Pickleball"] = "pickleball";
      Sport2["Pilates"] = "pilates";
      Sport2["Racquetball"] = "racquetball";
      Sport2["Ride"] = "ride";
      Sport2["RockClimbing"] = "rock_climbing";
      Sport2["RollerSki"] = "roller_ski";
      Sport2["Rowing"] = "rowing";
      Sport2["Run"] = "run";
      Sport2["Sail"] = "sail";
      Sport2["Skateboard"] = "skateboard";
      Sport2["Snowboard"] = "snowboard";
      Sport2["Snowshoe"] = "snowshoe";
      Sport2["Soccer"] = "soccer";
      Sport2["Squash"] = "squash";
      Sport2["StairStepper"] = "stair_stepper";
      Sport2["StandUpPaddling"] = "stand_up_paddling";
      Sport2["Surfing"] = "surfing";
      Sport2["Swim"] = "swim";
      Sport2["TableTennis"] = "table_tennis";
      Sport2["Tennis"] = "tennis";
      Sport2["TrailRun"] = "trail_run";
      Sport2["Velomobile"] = "velomobile";
      Sport2["VirtualRide"] = "virtual_ride";
      Sport2["VirtualRow"] = "virtual_row";
      Sport2["VirtualRun"] = "virtual_run";
      Sport2["Volleyball"] = "volleyball";
      Sport2["Walk"] = "walk";
      Sport2["WeightTraining"] = "weight_training";
      Sport2["Wheelchair"] = "wheelchair";
      Sport2["Windsurf"] = "windsurf";
      Sport2["Workout"] = "workout";
      Sport2["Yoga"] = "yoga";
      Sport2["Other"] = "other";
    })(Sport || (Sport = {}));
    (function(Tags2) {
      Tags2["Race"] = "race";
      Tags2["LongRun"] = "long_run";
      Tags2["Commute"] = "commute";
      Tags2["Workout"] = "workout";
      Tags2["Competition"] = "competition";
      Tags2["Recovery"] = "recovery";
      Tags2["WithPet"] = "with_pet";
      Tags2["WithKid"] = "with_kid";
      Tags2["ForACause"] = "for_a_cause";
    })(Tags || (Tags = {}));
    (function(Kind3) {
      Kind3["Activity"] = "activity";
    })(Kind || (Kind = {}));
    (function(Kind22) {
      Kind22["Manual"] = "manual";
    })(Kind2 || (Kind2 = {}));
    (function(Status22) {
      Status22["Scanning"] = "scanning";
      Status22["Uploading"] = "uploading";
      Status22["Processing"] = "processing";
      Status22["Completed"] = "completed";
      Status22["Failed"] = "failed";
      Status22["Cancelled"] = "cancelled";
    })(Status2 || (Status2 = {}));
    (function(Name2) {
      Name2["ReparseFailedUploads"] = "reparse-failed-uploads";
      Name2["ReparseAllUploads"] = "reparse-all-uploads";
    })(Name || (Name = {}));
    (function(QueueName_Output2) {
      QueueName_Output2["ActivityParsing"] = "activityParsing";
      QueueName_Output2["BackgroundTask"] = "backgroundTask";
      QueueName_Output2["ImageProcessing"] = "imageProcessing";
      QueueName_Output2["Storage"] = "storage";
    })(QueueName_Output || (QueueName_Output = {}));
    (function(Status32) {
      Status32["Queued"] = "queued";
      Status32["Running"] = "running";
      Status32["Succeeded"] = "succeeded";
      Status32["Failed"] = "failed";
      Status32["Skipped"] = "skipped";
    })(Status3 || (Status3 = {}));
    (function(QueueName2) {
      QueueName2["ActivityParsing"] = "activityParsing";
      QueueName2["BackgroundTask"] = "backgroundTask";
      QueueName2["ImageProcessing"] = "imageProcessing";
      QueueName2["Storage"] = "storage";
    })(QueueName || (QueueName = {}));
    (function(Command2) {
      Command2["Pause"] = "pause";
      Command2["Resume"] = "resume";
      Command2["Empty"] = "empty";
      Command2["ClearFailed"] = "clear-failed";
    })(Command || (Command = {}));
    (function(ActivityType_Output2) {
      ActivityType_Output2["AlpineSki"] = "alpine_ski";
      ActivityType_Output2["BackcountrySki"] = "backcountry_ski";
      ActivityType_Output2["Badminton"] = "badminton";
      ActivityType_Output2["Basketball"] = "basketball";
      ActivityType_Output2["Canoeing"] = "canoeing";
      ActivityType_Output2["Cricket"] = "cricket";
      ActivityType_Output2["CrossCountrySki"] = "cross_country_ski";
      ActivityType_Output2["Crossfit"] = "crossfit";
      ActivityType_Output2["Dance"] = "dance";
      ActivityType_Output2["EBikeRide"] = "e_bike_ride";
      ActivityType_Output2["Elliptical"] = "elliptical";
      ActivityType_Output2["EMountainBikeRide"] = "e_mountain_bike_ride";
      ActivityType_Output2["Golf"] = "golf";
      ActivityType_Output2["GravelRide"] = "gravel_ride";
      ActivityType_Output2["Handcycle"] = "handcycle";
      ActivityType_Output2["HighIntensityIntervalTraining"] = "high_intensity_interval_training";
      ActivityType_Output2["Hike"] = "hike";
      ActivityType_Output2["IceSkate"] = "ice_skate";
      ActivityType_Output2["InlineSkate"] = "inline_skate";
      ActivityType_Output2["Kayaking"] = "kayaking";
      ActivityType_Output2["Kitesurf"] = "kitesurf";
      ActivityType_Output2["MountainBikeRide"] = "mountain_bike_ride";
      ActivityType_Output2["Padel"] = "padel";
      ActivityType_Output2["PhysicalTherapy"] = "physical_therapy";
      ActivityType_Output2["Pickleball"] = "pickleball";
      ActivityType_Output2["Pilates"] = "pilates";
      ActivityType_Output2["Racquetball"] = "racquetball";
      ActivityType_Output2["Ride"] = "ride";
      ActivityType_Output2["RockClimbing"] = "rock_climbing";
      ActivityType_Output2["RollerSki"] = "roller_ski";
      ActivityType_Output2["Rowing"] = "rowing";
      ActivityType_Output2["Run"] = "run";
      ActivityType_Output2["Sail"] = "sail";
      ActivityType_Output2["Skateboard"] = "skateboard";
      ActivityType_Output2["Snowboard"] = "snowboard";
      ActivityType_Output2["Snowshoe"] = "snowshoe";
      ActivityType_Output2["Soccer"] = "soccer";
      ActivityType_Output2["Squash"] = "squash";
      ActivityType_Output2["StairStepper"] = "stair_stepper";
      ActivityType_Output2["StandUpPaddling"] = "stand_up_paddling";
      ActivityType_Output2["Surfing"] = "surfing";
      ActivityType_Output2["Swim"] = "swim";
      ActivityType_Output2["TableTennis"] = "table_tennis";
      ActivityType_Output2["Tennis"] = "tennis";
      ActivityType_Output2["TrailRun"] = "trail_run";
      ActivityType_Output2["Velomobile"] = "velomobile";
      ActivityType_Output2["VirtualRide"] = "virtual_ride";
      ActivityType_Output2["VirtualRow"] = "virtual_row";
      ActivityType_Output2["VirtualRun"] = "virtual_run";
      ActivityType_Output2["Volleyball"] = "volleyball";
      ActivityType_Output2["Walk"] = "walk";
      ActivityType_Output2["WeightTraining"] = "weight_training";
      ActivityType_Output2["Wheelchair"] = "wheelchair";
      ActivityType_Output2["Windsurf"] = "windsurf";
      ActivityType_Output2["Workout"] = "workout";
      ActivityType_Output2["Yoga"] = "yoga";
      ActivityType_Output2["Other"] = "other";
    })(ActivityType_Output || (ActivityType_Output = {}));
    (function(Status42) {
      Status42["Recording"] = "recording";
      Status42["Paused"] = "paused";
      Status42["Ended"] = "ended";
      Status42["Discarded"] = "discarded";
    })(Status4 || (Status4 = {}));
    (function(ActivityType2) {
      ActivityType2["AlpineSki"] = "alpine_ski";
      ActivityType2["BackcountrySki"] = "backcountry_ski";
      ActivityType2["Badminton"] = "badminton";
      ActivityType2["Basketball"] = "basketball";
      ActivityType2["Canoeing"] = "canoeing";
      ActivityType2["Cricket"] = "cricket";
      ActivityType2["CrossCountrySki"] = "cross_country_ski";
      ActivityType2["Crossfit"] = "crossfit";
      ActivityType2["Dance"] = "dance";
      ActivityType2["EBikeRide"] = "e_bike_ride";
      ActivityType2["Elliptical"] = "elliptical";
      ActivityType2["EMountainBikeRide"] = "e_mountain_bike_ride";
      ActivityType2["Golf"] = "golf";
      ActivityType2["GravelRide"] = "gravel_ride";
      ActivityType2["Handcycle"] = "handcycle";
      ActivityType2["HighIntensityIntervalTraining"] = "high_intensity_interval_training";
      ActivityType2["Hike"] = "hike";
      ActivityType2["IceSkate"] = "ice_skate";
      ActivityType2["InlineSkate"] = "inline_skate";
      ActivityType2["Kayaking"] = "kayaking";
      ActivityType2["Kitesurf"] = "kitesurf";
      ActivityType2["MountainBikeRide"] = "mountain_bike_ride";
      ActivityType2["Padel"] = "padel";
      ActivityType2["PhysicalTherapy"] = "physical_therapy";
      ActivityType2["Pickleball"] = "pickleball";
      ActivityType2["Pilates"] = "pilates";
      ActivityType2["Racquetball"] = "racquetball";
      ActivityType2["Ride"] = "ride";
      ActivityType2["RockClimbing"] = "rock_climbing";
      ActivityType2["RollerSki"] = "roller_ski";
      ActivityType2["Rowing"] = "rowing";
      ActivityType2["Run"] = "run";
      ActivityType2["Sail"] = "sail";
      ActivityType2["Skateboard"] = "skateboard";
      ActivityType2["Snowboard"] = "snowboard";
      ActivityType2["Snowshoe"] = "snowshoe";
      ActivityType2["Soccer"] = "soccer";
      ActivityType2["Squash"] = "squash";
      ActivityType2["StairStepper"] = "stair_stepper";
      ActivityType2["StandUpPaddling"] = "stand_up_paddling";
      ActivityType2["Surfing"] = "surfing";
      ActivityType2["Swim"] = "swim";
      ActivityType2["TableTennis"] = "table_tennis";
      ActivityType2["Tennis"] = "tennis";
      ActivityType2["TrailRun"] = "trail_run";
      ActivityType2["Velomobile"] = "velomobile";
      ActivityType2["VirtualRide"] = "virtual_ride";
      ActivityType2["VirtualRow"] = "virtual_row";
      ActivityType2["VirtualRun"] = "virtual_run";
      ActivityType2["Volleyball"] = "volleyball";
      ActivityType2["Walk"] = "walk";
      ActivityType2["WeightTraining"] = "weight_training";
      ActivityType2["Wheelchair"] = "wheelchair";
      ActivityType2["Windsurf"] = "windsurf";
      ActivityType2["Workout"] = "workout";
      ActivityType2["Yoga"] = "yoga";
      ActivityType2["Other"] = "other";
    })(ActivityType || (ActivityType = {}));
    (function(Status52) {
      Status52["Recording"] = "recording";
      Status52["Paused"] = "paused";
      Status52["Ended"] = "ended";
    })(Status5 || (Status5 = {}));
    (function(ActivityTag_Output2) {
      ActivityTag_Output2["Race"] = "race";
      ActivityTag_Output2["LongRun"] = "long_run";
      ActivityTag_Output2["Commute"] = "commute";
      ActivityTag_Output2["Workout"] = "workout";
      ActivityTag_Output2["Competition"] = "competition";
      ActivityTag_Output2["Recovery"] = "recovery";
      ActivityTag_Output2["WithPet"] = "with_pet";
      ActivityTag_Output2["WithKid"] = "with_kid";
      ActivityTag_Output2["ForACause"] = "for_a_cause";
    })(ActivityTag_Output || (ActivityTag_Output = {}));
    (function(BestEffortType_Output2) {
      BestEffortType_Output2["$400M"] = "400m";
      BestEffortType_Output2["$1K"] = "1k";
      BestEffortType_Output2["HalfMile"] = "half_mile";
      BestEffortType_Output2["$1Mile"] = "1_mile";
      BestEffortType_Output2["$2Miles"] = "2_miles";
      BestEffortType_Output2["$5K"] = "5k";
      BestEffortType_Output2["$10K"] = "10k";
      BestEffortType_Output2["$15K"] = "15k";
      BestEffortType_Output2["$10Miles"] = "10_miles";
      BestEffortType_Output2["$20K"] = "20k";
      BestEffortType_Output2["HalfMarathon"] = "half_marathon";
      BestEffortType_Output2["$30K"] = "30k";
      BestEffortType_Output2["Marathon"] = "marathon";
      BestEffortType_Output2["$50K"] = "50k";
      BestEffortType_Output2["LongestRide"] = "longest_ride";
      BestEffortType_Output2["BiggestClimb"] = "biggest_climb";
      BestEffortType_Output2["ElevationGain"] = "elevation_gain";
      BestEffortType_Output2["$5Miles"] = "5_miles";
      BestEffortType_Output2["$40K"] = "40k";
      BestEffortType_Output2["$80K"] = "80k";
      BestEffortType_Output2["$50Miles"] = "50_miles";
      BestEffortType_Output2["$90K"] = "90k";
      BestEffortType_Output2["$100K"] = "100k";
      BestEffortType_Output2["$100Miles"] = "100_miles";
      BestEffortType_Output2["$180K"] = "180k";
      BestEffortType_Output2["Power5S"] = "power_5s";
      BestEffortType_Output2["Power15S"] = "power_15s";
      BestEffortType_Output2["Power30S"] = "power_30s";
      BestEffortType_Output2["Power1M"] = "power_1m";
      BestEffortType_Output2["Power2M"] = "power_2m";
      BestEffortType_Output2["Power3M"] = "power_3m";
      BestEffortType_Output2["Power5M"] = "power_5m";
      BestEffortType_Output2["Power8M"] = "power_8m";
      BestEffortType_Output2["Power10M"] = "power_10m";
      BestEffortType_Output2["Power15M"] = "power_15m";
      BestEffortType_Output2["Power20M"] = "power_20m";
      BestEffortType_Output2["Power30M"] = "power_30m";
      BestEffortType_Output2["Power45M"] = "power_45m";
      BestEffortType_Output2["Power1H"] = "power_1h";
      BestEffortType_Output2["Power2H"] = "power_2h";
    })(BestEffortType_Output || (BestEffortType_Output = {}));
    (function(Type3) {
      Type3["LineString"] = "LineString";
    })(Type || (Type = {}));
    (function(Status62) {
      Status62["Pending"] = "pending";
      Status62["Ready"] = "ready";
      Status62["Failed"] = "failed";
    })(Status6 || (Status6 = {}));
    (function(AverageMetric2) {
      AverageMetric2["None"] = "none";
      AverageMetric2["Pace"] = "pace";
      AverageMetric2["SwimPace"] = "swim_pace";
      AverageMetric2["Speed"] = "speed";
    })(AverageMetric || (AverageMetric = {}));
    (function(BestEffortGroup2) {
      BestEffortGroup2["None"] = "none";
      BestEffortGroup2["Run"] = "run";
      BestEffortGroup2["Ride"] = "ride";
    })(BestEffortGroup || (BestEffortGroup = {}));
    (function(BestEffortSport2) {
      BestEffortSport2["Run"] = "run";
      BestEffortSport2["Ride"] = "ride";
    })(BestEffortSport || (BestEffortSport = {}));
    (function(BestEffortType2) {
      BestEffortType2["$400M"] = "400m";
      BestEffortType2["$1K"] = "1k";
      BestEffortType2["HalfMile"] = "half_mile";
      BestEffortType2["$1Mile"] = "1_mile";
      BestEffortType2["$2Miles"] = "2_miles";
      BestEffortType2["$5K"] = "5k";
      BestEffortType2["$10K"] = "10k";
      BestEffortType2["$15K"] = "15k";
      BestEffortType2["$10Miles"] = "10_miles";
      BestEffortType2["$20K"] = "20k";
      BestEffortType2["HalfMarathon"] = "half_marathon";
      BestEffortType2["$30K"] = "30k";
      BestEffortType2["Marathon"] = "marathon";
      BestEffortType2["$50K"] = "50k";
      BestEffortType2["LongestRide"] = "longest_ride";
      BestEffortType2["BiggestClimb"] = "biggest_climb";
      BestEffortType2["ElevationGain"] = "elevation_gain";
      BestEffortType2["$5Miles"] = "5_miles";
      BestEffortType2["$40K"] = "40k";
      BestEffortType2["$80K"] = "80k";
      BestEffortType2["$50Miles"] = "50_miles";
      BestEffortType2["$90K"] = "90k";
      BestEffortType2["$100K"] = "100k";
      BestEffortType2["$100Miles"] = "100_miles";
      BestEffortType2["$180K"] = "180k";
      BestEffortType2["Power5S"] = "power_5s";
      BestEffortType2["Power15S"] = "power_15s";
      BestEffortType2["Power30S"] = "power_30s";
      BestEffortType2["Power1M"] = "power_1m";
      BestEffortType2["Power2M"] = "power_2m";
      BestEffortType2["Power3M"] = "power_3m";
      BestEffortType2["Power5M"] = "power_5m";
      BestEffortType2["Power8M"] = "power_8m";
      BestEffortType2["Power10M"] = "power_10m";
      BestEffortType2["Power15M"] = "power_15m";
      BestEffortType2["Power20M"] = "power_20m";
      BestEffortType2["Power30M"] = "power_30m";
      BestEffortType2["Power45M"] = "power_45m";
      BestEffortType2["Power1H"] = "power_1h";
      BestEffortType2["Power2H"] = "power_2h";
    })(BestEffortType || (BestEffortType = {}));
    (function(BestEffortSport_Output2) {
      BestEffortSport_Output2["Run"] = "run";
      BestEffortSport_Output2["Ride"] = "ride";
    })(BestEffortSport_Output || (BestEffortSport_Output = {}));
    (function(BestEffortValueKind_Output2) {
      BestEffortValueKind_Output2["Duration"] = "duration";
      BestEffortValueKind_Output2["Distance"] = "distance";
      BestEffortValueKind_Output2["Elevation"] = "elevation";
      BestEffortValueKind_Output2["Power"] = "power";
    })(BestEffortValueKind_Output || (BestEffortValueKind_Output = {}));
    (function(ActivityTag2) {
      ActivityTag2["Race"] = "race";
      ActivityTag2["LongRun"] = "long_run";
      ActivityTag2["Commute"] = "commute";
      ActivityTag2["Workout"] = "workout";
      ActivityTag2["Competition"] = "competition";
      ActivityTag2["Recovery"] = "recovery";
      ActivityTag2["WithPet"] = "with_pet";
      ActivityTag2["WithKid"] = "with_kid";
      ActivityTag2["ForACause"] = "for_a_cause";
    })(ActivityTag || (ActivityTag = {}));
    (function(Role3) {
      Role3["Admin"] = "admin";
      Role3["User"] = "user";
    })(Role || (Role = {}));
    (function(Role22) {
      Role22["User"] = "user";
      Role22["Admin"] = "admin";
    })(Role2 || (Role2 = {}));
    (function(Type22) {
      Type22["ActivityLike"] = "activity_like";
      Type22["ActivityComment"] = "activity_comment";
      Type22["FollowRequest"] = "follow_request";
    })(Type2 || (Type2 = {}));
    if (!j.includes(206)) j.push(206);
  }
});

// .svelte-kit/output/server/chunks/api2.js
var init_api2 = __esm({
  ".svelte-kit/output/server/chunks/api2.js"() {
    init_build();
  }
});

// .svelte-kit/output/server/chunks/units.js
var UNIT_SYSTEMS, UNIT_SYSTEM_COOKIE, parseUnitSystem;
var init_units = __esm({
  ".svelte-kit/output/server/chunks/units.js"() {
    UNIT_SYSTEMS = ["metric", "imperial"];
    UNIT_SYSTEM_COOKIE = "kondis_units";
    parseUnitSystem = /* @__PURE__ */ __name((value) => UNIT_SYSTEMS.find((unitSystem) => unitSystem === value), "parseUnitSystem");
  }
});

// .svelte-kit/output/server/entries/pages/_layout.server.ts.js
var layout_server_ts_exports = {};
__export(layout_server_ts_exports, {
  load: () => load
});
var load;
var init_layout_server_ts = __esm({
  ".svelte-kit/output/server/entries/pages/_layout.server.ts.js"() {
    init_api();
    init_build();
    init_api2();
    init_units();
    init_exports();
    load = /* @__PURE__ */ __name(async ({ cookies, locals, request, url }) => {
      let user;
      const publicLiveView = url?.pathname.startsWith("/live/") ?? false;
      const publicAuthPage = url?.pathname === "/login" || url?.pathname === "/setup" || url?.pathname.startsWith("/setup/") || url?.pathname === "/register";
      const activityTypesPromise = activityControllerListTypes(getServerSdkRequestOptions(locals.kondisFetch));
      if (url && !publicAuthPage && !publicLiveView) {
        const me = await locals.kondisFetch(apiUrl("api/v1/auth/me"));
        if (!me.ok) {
          const setup = await locals.kondisFetch(apiUrl("api/v1/auth/setup"));
          if (setup.ok && (await setup.json()).setupRequired) throw redirect(303, "/setup");
          throw redirect(303, "/login");
        }
        user = await me.json();
      }
      let activityTypes = [];
      try {
        activityTypes = await activityTypesPromise;
      } catch {
      }
      const result = {
        user,
        authenticated: !url || !publicAuthPage && !publicLiveView,
        unitSystem: parseUnitSystem(cookies.get("kondis_units")) ?? "metric",
        activityTypes
      };
      if (!url) return result;
      return {
        ...result,
        eventsUrl: activityEventsUrl(url, request.headers.get("x-forwarded-proto"), request.headers.get("cf-visitor"), request.headers.get("x-forwarded-host") ?? request.headers.get("host"))
      };
    }, "load");
  }
});

// .svelte-kit/output/server/chunks/client.js
function goto(url, opts = {}) {
  throw new Error("Cannot call goto(...) on the server");
}
var PRELOAD_PRIORITIES, updated_listener, page, navigating, updated2, is_legacy, placeholder_url, onMount, tick2;
var init_client = __esm({
  ".svelte-kit/output/server/chunks/client.js"() {
    init_index_server();
    init_shared();
    init_internal2();
    init_exports2();
    init_server();
    init_internal22();
    init_internal();
    init_server2();
    PRELOAD_PRIORITIES = {
      tap: 1,
      hover: 2,
      viewport: 3,
      eager: 4,
      off: -1,
      false: -1
    };
    ({ ...PRELOAD_PRIORITIES }, PRELOAD_PRIORITIES.hover);
    updated_listener = { v: noop2 };
    is_legacy = noop.toString().includes("$$") || /function \w+\(\) \{\}/.test(noop.toString());
    placeholder_url = "a:";
    if (is_legacy) {
      page = {
        data: {},
        form: null,
        error: null,
        params: {},
        route: { id: null },
        state: {},
        status: -1,
        url: new URL(placeholder_url)
      };
      navigating = { current: null };
      updated2 = { current: false };
    } else {
      page = new class Page {
        static {
          __name(this, "Page");
        }
        data = {};
        form = null;
        error = null;
        params = {};
        route = { id: null };
        state = {};
        status = -1;
        url = new URL(placeholder_url);
      }();
      navigating = new class Navigating {
        static {
          __name(this, "Navigating");
        }
        current = null;
      }();
      updated2 = new class Updated {
        static {
          __name(this, "Updated");
        }
        current = false;
      }();
      updated_listener.v = () => updated2.current = true;
    }
    ({ onMount, tick: tick2 } = index_server_exports);
    __name(goto, "goto");
  }
});

// .svelte-kit/output/server/chunks/navigation.js
var init_navigation = __esm({
  ".svelte-kit/output/server/chunks/navigation.js"() {
    init_client();
  }
});

// .svelte-kit/output/server/chunks/Icon.js
function Icon($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const globalProps = getLucideContext() ?? {};
    const { name, color = globalProps.color ?? "currentColor", size = globalProps.size ?? 24, strokeWidth = globalProps.strokeWidth ?? 2, absoluteStrokeWidth = globalProps.absoluteStrokeWidth ?? false, iconNode = [], children, $$slots, $$events, ...props } = $$props;
    const calculatedStrokeWidth = derived(() => absoluteStrokeWidth ? Number(strokeWidth) * 24 / Number(size) : strokeWidth);
    $$renderer2.push(`<svg${attributes({
      ...defaultAttributes,
      ...!children && !hasA11yProp(props) && { "aria-hidden": "true" },
      ...props,
      width: size,
      height: size,
      stroke: color,
      "stroke-width": calculatedStrokeWidth(),
      class: clsx([
        "lucide-icon lucide",
        globalProps.class,
        name && `lucide-${name}`,
        props.class
      ])
    }, void 0, void 0, void 0, 3)}><!--[-->`);
    const each_array = ensure_array_like(iconNode);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let [tag, attrs] = each_array[$$index];
      element($$renderer2, tag, () => {
        $$renderer2.push(`${attributes({ ...attrs }, void 0, void 0, void 0, 3)}`);
      });
    }
    $$renderer2.push(`<!--]-->`);
    children?.($$renderer2);
    $$renderer2.push(`<!----></svg>`);
  });
}
var defaultAttributes, hasA11yProp, LucideContext, getLucideContext;
var init_Icon = __esm({
  ".svelte-kit/output/server/chunks/Icon.js"() {
    init_index_server();
    init_server();
    defaultAttributes = {
      xmlns: "http://www.w3.org/2000/svg",
      width: 24,
      height: 24,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 2,
      "stroke-linecap": "round",
      "stroke-linejoin": "round"
    };
    hasA11yProp = /* @__PURE__ */ __name((props) => {
      for (const prop in props) if (prop.startsWith("aria-") || prop === "role" || prop === "title") return true;
      return false;
    }, "hasA11yProp");
    LucideContext = /* @__PURE__ */ Symbol("lucide-context");
    getLucideContext = /* @__PURE__ */ __name(() => getContext(LucideContext), "getLucideContext");
    __name(Icon, "Icon");
  }
});

// .svelte-kit/output/server/chunks/activity.js
function Activity($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "activity" },
    props,
    { iconNode: [["path", { "d": "M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" }]] }
  ]));
}
var init_activity = __esm({
  ".svelte-kit/output/server/chunks/activity.js"() {
    init_server();
    init_Icon();
    __name(Activity, "Activity");
  }
});

// .svelte-kit/output/server/chunks/user-name.js
function UserAvatar($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { name, src = null, size = 48 } = $$props;
    const initial2 = derived(() => name.trim().slice(0, 1).toUpperCase() || "?");
    $$renderer2.push(`<span class="user-avatar"${attr_style(`--avatar-size: ${size}px`)}${attr("aria-label", name)}${attr("title", name)}>`);
    if (src && true) $$renderer2.push(`<!--[0--><img${attr("src", src)} alt="" onerror="this.__e=event"/>`);
    else $$renderer2.push(`<!--[-1--><span aria-hidden="true">${escape_html(initial2())}</span>`);
    $$renderer2.push(`<!--]--></span>`);
  });
}
function userDisplayName(user) {
  return `${user.firstName} ${user.lastName}`.trim();
}
function userPossessiveName(user) {
  return `${user.firstName}${user.firstName.endsWith("s") ? "'" : "'s"}`;
}
var init_user_name = __esm({
  ".svelte-kit/output/server/chunks/user-name.js"() {
    init_server();
    __name(UserAvatar, "UserAvatar");
    __name(userDisplayName, "userDisplayName");
    __name(userPossessiveName, "userPossessiveName");
  }
});

// .svelte-kit/output/server/chunks/notifications.js
function Bell($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "bell" },
    props,
    { iconNode: [["path", { "d": "M10.268 21a2 2 0 0 0 3.464 0" }], ["path", { "d": "M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" }]] }
  ]));
}
function notificationBadgeLabel(count) {
  if (typeof count !== "number" || !Number.isFinite(count) || count <= 0) return null;
  return count > 20 ? "20+" : String(count);
}
var init_notifications = __esm({
  ".svelte-kit/output/server/chunks/notifications.js"() {
    init_server();
    init_Icon();
    init_user_name();
    __name(Bell, "Bell");
    __name(notificationBadgeLabel, "notificationBadgeLabel");
  }
});

// .svelte-kit/output/server/chunks/file-up.js
function File_up($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "file-up" },
    props,
    { iconNode: [
      ["path", { "d": "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" }],
      ["path", { "d": "M14 2v5a1 1 0 0 0 1 1h5" }],
      ["path", { "d": "M12 12v6" }],
      ["path", { "d": "m15 15-3-3-3 3" }]
    ] }
  ]));
}
var init_file_up = __esm({
  ".svelte-kit/output/server/chunks/file-up.js"() {
    init_server();
    init_Icon();
    __name(File_up, "File_up");
  }
});

// .svelte-kit/output/server/chunks/list-checks.js
function List_checks($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "list-checks" },
    props,
    { iconNode: [
      ["path", { "d": "M13 5h8" }],
      ["path", { "d": "M13 12h8" }],
      ["path", { "d": "M13 19h8" }],
      ["path", { "d": "m3 17 2 2 4-4" }],
      ["path", { "d": "m3 7 2 2 4-4" }]
    ] }
  ]));
}
var init_list_checks = __esm({
  ".svelte-kit/output/server/chunks/list-checks.js"() {
    init_server();
    init_Icon();
    __name(List_checks, "List_checks");
  }
});

// .svelte-kit/output/server/chunks/trophy.js
function Trophy($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "trophy" },
    props,
    { iconNode: [
      ["path", { "d": "M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2" }],
      ["path", { "d": "M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2" }],
      ["path", { "d": "M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3" }],
      ["path", { "d": "M4 22h16" }],
      ["path", { "d": "M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z" }],
      ["path", { "d": "M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3" }]
    ] }
  ]));
}
var init_trophy = __esm({
  ".svelte-kit/output/server/chunks/trophy.js"() {
    init_server();
    init_Icon();
    __name(Trophy, "Trophy");
  }
});

// .svelte-kit/output/server/chunks/state.js
function context2() {
  return getContext("__request__");
}
var page2;
var init_state = __esm({
  ".svelte-kit/output/server/chunks/state.js"() {
    init_index_server();
    init_server();
    init_client();
    __name(context2, "context");
    page2 = {
      get data() {
        return context2().page.data;
      },
      get error() {
        return context2().page.error;
      },
      get form() {
        return context2().page.form;
      },
      get params() {
        return context2().page.params;
      },
      get route() {
        return context2().page.route;
      },
      get state() {
        return context2().page.state;
      },
      get status() {
        return context2().page.status;
      },
      get url() {
        return context2().page.url;
      }
    };
  }
});

// .svelte-kit/output/server/chunks/i18n.js
function t2(key2, values = {}) {
  let value = catalogs[preferredLocale()][key2];
  for (const [name, replacement] of Object.entries(values)) value = value.replaceAll(`{${name}}`, String(replacement));
  return value;
}
var catalogs, preferredLocale;
var init_i18n = __esm({
  ".svelte-kit/output/server/chunks/i18n.js"() {
    catalogs = {
      en: {
        app_name: "Kondis",
        recording_channel_name: "Activity recording",
        recording_channel_description: "Keeps location recording active during an activity",
        recording_notification_title: "Kondis is recording",
        common_cancel: "Cancel",
        common_close: "Close",
        common_confirm: "Confirm",
        common_delete: "Delete",
        common_save: "Save",
        common_retry: "Retry",
        comments: "Comments",
        discussion: "Discussion",
        activity_metadata_separator: " \xB7 ",
        loading_comments: "Loading comments...",
        edit_comment: "Edit comment",
        comment_actions: "Comment actions",
        edit: "Edit",
        add_a_comment: "Add a comment",
        comment: "Comment",
        send_comment: "Send comment",
        activity_image: "Activity image",
        activity_photo: "Activity photo",
        previous_image: "Previous image",
        next_image: "Next image",
        close_image_viewer: "Close image viewer",
        elevation_profile: "Elevation profile",
        elevation_by_distance: "Elevation by distance",
        dist_label: "Dist:",
        elev_label: "Elev:",
        pace_label: "Pace:",
        heart_rate_short_label: "HR:",
        activity_tags: "Activity tags",
        live_workout_route: "Live workout route",
        lifetime: "Lifetime",
        medal_title: "{label} medal",
        activity_density_map: "Activity density map",
        activity_route_map: "Activity route map",
        no_gps_route: "No GPS route",
        no_location_data: "This activity did not include location data.",
        done: "Done",
        error_label: "Error",
        error_generic_title: "Something went wrong",
        return_to_activities: "Return to activities",
        app_description: "Your self-hosted activity archive",
        live_tracking: "Live tracking",
        live_workout: "Live workout",
        requests: "Requests",
        follow_requests: "Follow requests",
        no_pending_requests: "No pending requests.",
        accept: "Accept",
        ignore: "Ignore",
        medals_count: "{count} medals",
        map_attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        auth_sign_in: "Sign in",
        auth_sign_out: "Sign out",
        auth_create_account: "Create account",
        email: "Email",
        password: "Password",
        account: "Account",
        activities: "Activities",
        activity: "Activity",
        activity_upload: "Upload activity",
        activity_upload_description: "Upload an activity file.",
        activity_import_strava: "Import Strava takeout",
        activity_import_strava_description: "Import your activities from a Strava .zip export.",
        notifications: "Notifications",
        notifications_empty: "Likes and comments on your activities will appear here.",
        recording_start: "Start recording",
        recording_pause: "Pause recording",
        recording_resume: "Resume recording",
        recording_stop: "Stop recording",
        settings: "Settings",
        error_generic: "Something went wrong. Please try again.",
        error_network: "Could not connect to the server.",
        error_not_found: "The requested item could not be found.",
        home: "Home",
        best_efforts: "Best efforts",
        people: "People",
        primary_navigation: "Primary navigation",
        mobile_navigation: "Mobile navigation",
        kondis_home: "Kondis home",
        development_build: "Development build",
        search_activities: "Search activities",
        clear_search: "Clear search",
        open_notifications: "Open notifications",
        view_all: "View all",
        loading: "Loading...",
        no_notifications_yet: "No notifications yet.",
        add_activity: "Add activity",
        add_manual_entry: "Add manual entry",
        open_account_menu: "Open account menu",
        switch_to_light_mode: "Switch to light mode",
        switch_to_dark_mode: "Switch to dark mode",
        log_out: "Log out",
        new_import: "New import",
        individual_activity_file: "Activity files",
        upload_files: "Upload .fit, .tcx, or .gpx files.",
        strava_takeout: "Strava takeout",
        upload_activity: "Upload activity",
        upload_activity_page_description: "Choose how you want to add workouts to your archive.",
        strava_imported_activities: "Imported {count} activities",
        strava_duplicate_activities: "{count} activities were duplicates",
        strava_failed_activities: "{count} failed",
        strava_import_failed: "Import failed.",
        strava_choose_zip: "Choose a Strava takeout .zip file.",
        strava_scanning: "Scanning the ZIP on this device\u2026",
        strava_uploading: "Uploading extracted activities\u2026",
        strava_server_processing: "Server is processing activities\u2026",
        strava_skipped_media: "Skipped for now: {photos} photos, {videos} videos, and {profiles} profile images.",
        strava_cancel: "Cancel import",
        strava_drop_takeout: "Drop your Strava takeout here",
        strava_browse_device: "or click to browse your device",
        strava_activities_processed: "{processed} of {total} activities processed",
        strava_import_takeout: "Import takeout",
        server_unavailable: "Server unavailable",
        start_api_to_load_activities: "Start the Kondis API to load your activities.",
        live_activities: "Live activities",
        live_recording: "Live recording",
        paused: "Paused",
        live: "Live",
        finished: "Finished",
        connection_lost: "Connection lost",
        catching_up: "Catching up",
        live_workout_finished: "{activity} finished",
        live_workout_in_progress: "{activity} in progress",
        waiting_for_gps: "Waiting for GPS",
        updated_seconds_ago: "Updated {seconds}s ago",
        could_not_create_share_link: "Could not create a share link",
        creating_share_link: "Creating...",
        new_share_link: "New share link",
        share_live: "Share live",
        beacon_link_copied: "Beacon link copied",
        gps_points: "GPS points",
        waiting_for_first_gps_position: "Waiting for the first GPS position...",
        distance: "Distance",
        elapsed: "Elapsed",
        pace: "Pace",
        moving_time: "Moving time",
        elevation: "Elevation",
        could_not_load_more: "Could not load more. Try again",
        no_matching_activities: "No matching activities",
        first_activity_starts_here: "Your first activity starts here",
        try_different_activity_search: "Try a different sport or activity name.",
        no_activities: "No activities yet. Get out there!",
        could_not_load_best_efforts: "Could not load your best efforts.",
        no_result_yet: "No result yet",
        social: "Social",
        follow_athletes_description: "Follow athletes and see their activities in your home feed.",
        incoming_requests: "Incoming requests",
        search_by_name: "Search by name",
        search_people: "Search people",
        search: "Search",
        following: "Following",
        requested: "Requested",
        follow: "Follow",
        no_people_found: "No people found",
        try_different_name: "Try a different name.",
        could_not_load_people: "Could not load people.",
        could_not_update_follow_request: "Could not update the follow request.",
        choose_activity_display: "Choose how Kondis displays your activity data.",
        your_name: "Your name",
        name_description: "This is the name shown on your activities and profile.",
        first_name: "First name",
        last_name: "Last name",
        saving: "Saving...",
        save_name: "Save name",
        you: "You",
        profile_picture: "Profile picture",
        profile_picture_description: "Shown next to your name on activities and profiles.",
        choose_picture: "Choose picture",
        units_of_measurement: "Units of measurement",
        display_units: "Display units",
        metric: "Metric",
        imperial: "Imperial",
        welcome_to_kondis: "Welcome to Kondis",
        setup_token_description: "Enter the setup token shown in the backend log to get started.",
        setup_token: "Setup token",
        see_latest_reactions: "See the latest reactions and comments on your activities.",
        no_notifications_description: "Likes and comments on your activities will appear here.",
        upload_activity_file: "Upload activity files",
        upload_activity_description: "Add activity files directly to your activity archive.",
        drop_activity_file: "Drop your activity file here",
        drop_activity_files: "Drop your activity files here",
        click_to_browse: "or click to browse your device",
        choose_activity_file: "Choose one or more .fit, .tcx, or .gpx activity files.",
        activity_uploaded: "Activity uploaded.",
        activities_uploaded: "{count} activities uploaded.",
        activities_upload_failed: "{uploaded} uploaded; {failed} failed.",
        activities_upload_progress: "{uploaded} / {total} uploaded",
        upload_queued: "Queued",
        upload_skipped: "Skipped",
        upload_workout: "Upload workout",
        upload_workouts: "Upload workouts",
        upload_failed: "Upload failed.",
        processing_taking_long: "Activity processing is taking longer than expected",
        dont_have_account: "Don't have an account?",
        create_one: "Create one",
        create_your_account: "Create your account",
        confirm_password: "Confirm password",
        already_have_account: "Already have an account?",
        search_results_for: "Search results for \u201C{query}\u201D",
        activities_found: "{count} activities found",
        activity_found: "{count} activity found",
        loading_more_activities: "Loading more activities\u2026",
        effort_progress_description: "Choose an effort to see how your performances have progressed over time.",
        run: "Run",
        ride: "Ride",
        remove: "Remove",
        save_preference: "Save preference",
        saved: "Saved",
        record: "Record",
        server_url: "Server URL",
        server_url_example: "For example http://192.168.1.10:2293 or https://kondis.example.com",
        server_url_settings_example: "For example http://192.168.0.10 or https://kondis.example.com",
        "continue": "Continue",
        retry: "Retry",
        opening_identity_provider: "Opening identity provider\u2026",
        retry_in_browser: "Retry in browser",
        server_requires_setup: "The Kondis server requires initial setup. Finish setup in your web browser and then return here to sign in.",
        share_live_tracking: "Share live tracking",
        activity_paused: "Activity paused",
        tap_to_view_activity: "Tap to view your activity",
        back: "Back",
        find_people: "Find people",
        record_a_activity: "Record a activity",
        sync_now: "Sync now",
        everything_uploaded: "Everything is uploaded",
        untitled_activity: "Untitled activity",
        try_again: "Try again",
        saved_waiting_to_sync: "Saved on this device and waiting to sync.",
        add_photos: "Add photos",
        activity_analysis: "Activity analysis",
        splits: "Splits",
        cycling_performance: "Cycling performance",
        running_performance: "Running performance",
        delete_activity: "Delete activity",
        delete_activity_confirmation: "This will permanently delete this activity and its analysis.",
        deleting: "Deleting\u2026",
        repeated_route: "Repeated route",
        activities_on_route: "{count} activities on this route",
        activity_on_route: "{count} activity on this route",
        compare_matched_efforts: "Compare your performance across every matched effort.",
        view_matched_rides: "View matched rides",
        view_matched_runs: "View matched runs",
        speed: "Speed",
        time: "Time",
        power: "Power",
        elevation_short: "Elev",
        average_speed: "Avg speed",
        average_heart_rate: "Avg heart rate",
        calories: "Calories",
        like_activity: "Like activity",
        unlike_activity: "Unlike activity",
        comments_count: "{count} comments",
        open_activity_photos: "Open activity photos",
        close_photos: "Close photos",
        photo_of: "Photo {current} of {total}",
        return_to_activity: "Return to activity",
        more_options: "More options",
        edit_activity: "Edit activity",
        name: "Name",
        activity_name: "Activity name",
        description: "Description",
        add_description: "Add a description",
        exclude_from_rankings: "Exclude from rankings",
        tags: "Tags",
        race: "Race",
        commute: "Commute",
        workout: "Workout",
        recovery: "Recovery",
        with_kid: "With Kid",
        with_pet: "With Pet",
        for_a_cause: "For a Cause",
        new_best_all_time: "New best of all time",
        new_second_best_all_time: "New 2nd best of all time",
        new_third_best_all_time: "New 3rd best of all time",
        new_best_year: "New best of {year}",
        new_second_best_year: "New 2nd best of {year}",
        new_third_best_year: "New 3rd best of {year}",
        no_matched_route_data: "No matched route data",
        back_to_activity: "Back to activity",
        progress_over_time: "PROGRESS OVER TIME",
        fastest: "Fastest",
        all_time_average: "All-time avg",
        slowest: "Slowest",
        trending_average: "- Trending average",
        each_effort: "- Each effort",
        every_effort: "Every effort",
        popular: "Popular",
        more_activities: "More activities",
        start_activity: "Start activity",
        pause: "Pause",
        resume: "Resume",
        finish: "Finish",
        saving_and_syncing_activity: "Saving and syncing activity...",
        activity_saved: "Activity saved",
        dismiss: "Dismiss",
        no_gps_trace: "No GPS trace was captured for this activity.",
        activity_title: "Activity title",
        uploading_activity: "Uploading activity...",
        save_activity: "Save activity",
        discard_activity: "Discard activity",
        discard_activity_confirmation: "This activity will be permanently deleted and cannot be recovered.",
        discard: "Discard",
        keep_activity: "Keep activity",
        choose_activity_type: "Choose activity type",
        choose_sport: "Choose a sport",
        select_sport_to_record: "Select what you're about to record",
        close: "Close",
        search_sports: "Search sports",
        selected: "Selected",
        nothing_to_see: "Nothing to see here!",
        try_different_name_or_sport: "Try a different name or sport.",
        activity_waiting_to_sync: "{count} activity waiting to sync",
        activities_waiting_to_sync: "{count} activities waiting to sync",
        activities_saved_on_device: "They are saved on this device and remain available below.",
        request_pending: "Request pending",
        unfollow: "Unfollow",
        checking: "Checking...",
        save_and_test_connection: "Save and test connection",
        sign_out_confirmation_title: "Sign out?",
        sign_out_confirmation: "You will sign out from your Kondis server",
        looking_for_gps: "Looking for GPS...",
        gps_signal_weak: "GPS signal is weak",
        recording_failed: "Recording failed",
        saved_will_upload_when_reachable: "Saved on this device. It will upload when your Kondis server is reachable.",
        no_sports_found: "No sports found",
        likes: "{count} likes",
        add_comment: "Add a comment",
        post: "Post",
        competition: "Competition",
        matched_rides: "Matched rides",
        matched_runs: "Matched runs",
        compare_route_activities: "Compare your performance across {count} activities on the same route",
        activities_count: "{count} activities",
        all_time_ranking: "All-time ranking",
        your_efforts: "Your {effort} efforts",
        every_result: "Every result",
        effort_history: "Effort history",
        effort: "Effort",
        kilometre_abbreviation: "KM",
        achievement_badge_description: "{effort}: {rank}",
        performance: "performance",
        best_efforts_progress: "See how your best {activities} have progressed over time.",
        best_effort_sport: "Best effort sport",
        higher_is_better: "Higher is better",
        higher_is_faster: "Higher is faster",
        all_time: "All time",
        no_efforts_yet: "No {effort} efforts yet",
        import_more_activities: "Import more {activities} with the required data to start tracking this effort.",
        create_kondis_account: "Create your Kondis account",
        setup_token_verified: "Your setup token has been verified.",
        set_up: "Set up",
        profile: "Profile",
        profile_unavailable: "Profile unavailable",
        person_not_found: "This person could not be found.",
        loading_profile: "Loading profile\u2026",
        your_profile: "Your profile",
        athlete: "Athlete",
        cancel_request: "Cancel request",
        unblock: "Unblock",
        block: "Block",
        your_activities: "Your activities",
        your_activities_description: "Your recorded and uploaded activities will appear here.",
        you_blocked_this_person: "You blocked this person",
        unblock_to_see_activities: "Unblock them to see their activity history.",
        follow_to_see_activities: "Follow to see activities",
        follow_to_see_activities_description: "When they accept your request, their activities and live sessions will appear here and in Home.",
        athlete_no_activity: "This athlete has not shared an activity yet.",
        activity_likes: "Activity likes",
        show_people_who_liked: "Show people who liked this activity",
        likes_label: "Likes",
        no_likes_yet: "No likes yet.",
        activity_type: "Activity type",
        activity_description_placeholder: "Activity description",
        activity_photos: "Activity photos",
        swipeable_activity_photos: "Swipeable activity photos",
        photo_carousel_controls: "Photo carousel controls",
        activity_kilometre_splits: "Activity kilometre splits",
        start: "Start",
        elevation_gain: "Elevation gain",
        average_power: "Average power",
        energy: "Energy",
        heart_rate: "Heart rate",
        view_matched: "View matched {activities}",
        cycling: "Cycling",
        running: "Running",
        excluded_from_rankings_note: "Shown for this activity only; excluded from rankings.",
        distance_best_efforts: "Distance best efforts",
        power_best_efforts: "Power best efforts",
        view_best_effort_history: "View best effort history",
        new_ranked_best_all_time: "New {rank} best of all time",
        new_ranked_best_year: "New {rank} best of {year}",
        could_not_save_activity: "Could not save the activity. Please try again.",
        delete_activity_confirmation_prompt: "Delete this activity? This cannot be undone.",
        could_not_delete_activity: "Could not delete the activity. Please try again.",
        matched_routes: "Matched routes",
        matched: "Matched {activities}",
        route_performance_over_time: "Route performance over time",
        performance_summary: "Performance summary",
        matched_route_activities: "Matched route activities",
        date: "Date",
        versus_average: "vs average",
        this_activity: "This {activity}",
        all_activities: "All activities",
        edit_activity_metadata: "Edit activity metadata",
        could_not_update_block: "Could not update the block.",
        jobs: "Jobs",
        job: "Job",
        queue: "Queue",
        job_name_activity_upload: "Uploaded activity",
        job_name_activity_metric_compute: "Computed metrics for activity",
        job_name_activity_best_effort_compute: "Computed best efforts for activity",
        job_name_activity_best_effort_rank: "Ranked best efforts for activity",
        job_name_activity_route_match_compute: "Matched routes for activity",
        job_name_activity_parse: "Parsed activity",
        job_name_activity_manual_create: "Created manual activity",
        job_name_activity_parse_queue_all: "Queued all activities for parsing",
        job_name_activity_delete: "Deleted activity",
        job_name_activity_image_ingest: "Ingested activity images",
        job_name_activity_image_attach: "Attached activity images",
        job_name_activity_image_generate_thumbnails: "Generated thumbnails for activity images",
        job_name_activity_image_generate_queue_all: "Queued all activity images for processing",
        job_name_user_avatar_upload: "Uploaded user avatar",
        job_name_file_delete: "Deleted file",
        job_name_temporary_file_cleanup: "Cleaned up temporary files",
        job_queues: "Job queues",
        administration: "Administration",
        job_queues_description: "Monitor background processing and review recent job history.",
        job_queue_status: "Job queue status",
        activity_processing: "Activity processing",
        activity_processing_description: "Parse workouts, calculate metrics, best efforts, and route matches.",
        imports_and_tasks: "Imports and background tasks",
        imports_and_tasks_description: "Stage uploads, expand takeouts, and coordinate follow-up work.",
        image_processing: "Image processing",
        image_processing_description: "Ingest activity images and generate display sizes.",
        storage_tasks: "Storage tasks",
        storage_tasks_description: "Delete files and clean up temporary uploads.",
        queue_running: "Running",
        active: "Active",
        waiting: "Waiting",
        failed: "Failed",
        pause_queue: "Pause queue",
        resume_queue: "Resume queue",
        refresh: "Refresh",
        recent_jobs: "Recent jobs",
        recent_jobs_description: "Queued and completed work retained by the server.",
        no_job_history: "No jobs recorded yet",
        no_job_history_description: "Background work will appear here after it is queued.",
        status: "Status",
        started: "Started",
        duration: "Duration",
        jobs_shown: "Showing {shown} of {total} jobs",
        load_more: "Load more",
        page: "Page",
        of_pages: "of {total}",
        go_to_page: "Go to page",
        previous_page: "Previous page",
        next_page: "Next page",
        attempt_number: "Attempt {number}",
        job_status_queued: "Queued",
        job_status_running: "Running",
        job_status_succeeded: "Succeeded",
        job_status_failed: "Failed",
        job_status_skipped: "Skipped",
        view_error: "View error",
        job_dashboard_load_error: "Could not refresh job status.",
        job_queue_action_error: "Could not update the queue."
      },
      sv: {
        app_name: "Kondis",
        recording_channel_name: "Tr\xE4ningsregistrering",
        recording_channel_description: "H\xE5ller platsregistreringen aktiv under ett tr\xE4ningspass",
        recording_notification_title: "Kondis registrerar",
        common_cancel: "Avbryt",
        common_close: "St\xE4ng",
        common_confirm: "Bekr\xE4fta",
        common_delete: "Ta bort",
        common_save: "Spara",
        common_retry: "F\xF6rs\xF6k igen",
        comments: "Kommentarer",
        discussion: "Diskussion",
        activity_metadata_separator: " \xB7 ",
        comments_count: "{count} kommentarer",
        loading_comments: "Laddar kommentarer...",
        edit_comment: "Redigera kommentar",
        comment_actions: "Kommentarshandlingar",
        edit: "Redigera",
        add_a_comment: "L\xE4gg till en kommentar",
        comment: "Kommentar",
        send_comment: "Skicka kommentar",
        activity_image: "Aktivitetsbild",
        activity_photo: "Aktivitetsfoto",
        previous_image: "F\xF6reg\xE5ende bild",
        next_image: "N\xE4sta bild",
        close_image_viewer: "St\xE4ng bildvisaren",
        elevation_profile: "H\xF6jdprofil",
        elevation_by_distance: "H\xF6jd efter distans",
        dist_label: "Dist:",
        elev_label: "H\xF6jd:",
        pace_label: "Tempo:",
        heart_rate_short_label: "Puls:",
        activity_tags: "Aktivitetstaggar",
        live_workout_route: "Rutt f\xF6r p\xE5g\xE5ende tr\xE4ningspass",
        lifetime: "Alla tider",
        medal_title: "{label}-medalj",
        activity_density_map: "Aktivitetsdensitetskarta",
        no_gps_route: "Ingen GPS-rutt",
        no_location_data: "Den h\xE4r aktiviteten inneh\xE5ller inga platsdata.",
        done: "Klar",
        error_label: "Fel",
        error_generic_title: "N\xE5got gick fel",
        return_to_activities: "Tillbaka till aktiviteter",
        app_description: "Ditt egenhostade aktivitetsarkiv",
        live_tracking: "Livesp\xE5rning",
        live_workout: "P\xE5g\xE5ende tr\xE4ningspass",
        requests: "F\xF6rfr\xE5gningar",
        follow_requests: "F\xF6ljf\xF6rfr\xE5gningar",
        no_pending_requests: "Inga v\xE4ntande f\xF6rfr\xE5gningar.",
        accept: "Acceptera",
        ignore: "Ignorera",
        medals_count: "{count} medaljer",
        map_attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        auth_sign_in: "Logga in",
        auth_sign_out: "Logga ut",
        auth_create_account: "Skapa konto",
        email: "E-post",
        password: "L\xF6senord",
        account: "Konto",
        activities: "Aktiviteter",
        activity_upload: "Ladda upp aktivitet",
        activity_upload_description: "Ladda upp en aktivitet via fil.",
        activity_import_strava: "Importera Strava-fil",
        activity_import_strava_description: "Importera dina aktiviteter fr\xE5n en Strava-export i .zip-format.",
        notifications: "Notiser",
        notifications_empty: "Gilla-markeringar och kommentarer p\xE5 dina aktiviteter visas h\xE4r.",
        recording_start: "Starta inspelning",
        recording_pause: "Pausa inspelning",
        recording_resume: "\xC5teruppta inspelning",
        recording_stop: "Avsluta inspelning",
        settings: "Inst\xE4llningar",
        error_generic: "N\xE5got gick fel. F\xF6rs\xF6k igen.",
        error_network: "Det gick inte att ansluta till servern.",
        error_not_found: "Det beg\xE4rda objektet hittades inte.",
        home: "Hem",
        best_efforts: "B\xE4sta resultat",
        people: "Personer",
        primary_navigation: "Huvudnavigering",
        mobile_navigation: "Mobilnavigering",
        kondis_home: "Kondis startsida",
        development_build: "Utvecklingsversion",
        search_activities: "S\xF6k aktiviteter",
        clear_search: "T\xF6m s\xF6kning",
        open_notifications: "\xD6ppna notiser",
        view_all: "Visa alla",
        loading: "Laddar...",
        no_notifications_yet: "Inga notiser \xE4nnu.",
        add_activity: "L\xE4gg till aktivitet",
        add_manual_entry: "L\xE4gg till manuellt",
        open_account_menu: "\xD6ppna kontomeny",
        switch_to_light_mode: "Byt till ljust l\xE4ge",
        switch_to_dark_mode: "Byt till m\xF6rkt l\xE4ge",
        log_out: "Logga ut",
        new_import: "Ny import",
        individual_activity_file: "Tr\xE4ningsfiler",
        upload_files: "Ladda upp .fit-, .tcx- eller .gpx-filer.",
        strava_takeout: "Strava-export",
        upload_activity: "Ladda upp aktivitet",
        upload_activity_page_description: "V\xE4lj hur du vill l\xE4gga till tr\xE4ningspass i ditt arkiv.",
        strava_imported_activities: "{count} aktiviteter importerades",
        strava_duplicate_activities: "{count} aktiviteter var dubbletter",
        strava_failed_activities: "{count} misslyckades",
        strava_import_failed: "Importen misslyckades.",
        strava_choose_zip: "V\xE4lj en Strava-exportfil i .zip-format.",
        strava_scanning: "ZIP-filen granskas p\xE5 den h\xE4r enheten\u2026",
        strava_uploading: "Extraherade aktiviteter laddas upp\u2026",
        strava_server_processing: "Servern bearbetar aktiviteter\u2026",
        strava_skipped_media: "Hoppas \xF6ver tills vidare: {photos} foton, {videos} videor och {profiles} profilbilder.",
        strava_cancel: "Avbryt import",
        strava_drop_takeout: "Sl\xE4pp Strava-exportfilen h\xE4r",
        strava_browse_device: "eller klicka f\xF6r att bl\xE4ddra p\xE5 din enhet",
        strava_activities_processed: "{processed} av {total} aktiviteter bearbetade",
        strava_import_takeout: "Importera exportfil",
        server_unavailable: "Servern \xE4r inte tillg\xE4nglig",
        start_api_to_load_activities: "Starta Kondis-servern f\xF6r att l\xE4sa in aktiviteter.",
        live_activities: "P\xE5g\xE5ende pass",
        live_recording: "P\xE5g\xE5ende inspelning",
        paused: "Pausad",
        live: "Live",
        finished: "Avslutat",
        connection_lost: "Anslutningen f\xF6rlorad",
        catching_up: "H\xE4mtar ikapp",
        live_workout_finished: "{activity} avslutat",
        live_workout_in_progress: "{activity} p\xE5g\xE5r",
        waiting_for_gps: "V\xE4ntar p\xE5 GPS",
        updated_seconds_ago: "Uppdaterad f\xF6r {seconds} sekunder sedan",
        could_not_create_share_link: "Kunde inte skapa en delningsl\xE4nk",
        creating_share_link: "Skapar...",
        new_share_link: "Ny delningsl\xE4nk",
        share_live: "Dela livepass",
        beacon_link_copied: "Beacon-l\xE4nken har kopierats",
        gps_points: "GPS-punkter",
        waiting_for_first_gps_position: "V\xE4ntar p\xE5 den f\xF6rsta GPS-positionen...",
        distance: "Distans",
        elapsed: "F\xF6rfluten tid",
        pace: "Tempo",
        moving_time: "R\xF6relsetid",
        elevation: "H\xF6jdskillnad",
        could_not_load_more: "Kunde inte l\xE4sa in fler. F\xF6rs\xF6k igen",
        no_matching_activities: "Inga matchande aktiviteter",
        first_activity_starts_here: "Din f\xF6rsta aktivitet b\xF6rjar h\xE4r",
        try_different_activity_search: "Prova en annan sport eller ett annat aktivitetsnamn.",
        no_activities: "Inga aktiviteter \xE4nnu. Upp ur soffan!",
        could_not_load_best_efforts: "Kunde inte l\xE4sa in dina b\xE4sta resultat.",
        no_result_yet: "Inget resultat \xE4nnu",
        social: "Socialt",
        follow_athletes_description: "F\xF6lj atleter och se deras aktiviteter i fl\xF6det.",
        incoming_requests: "Inkommande f\xF6rfr\xE5gningar",
        search_by_name: "S\xF6k efter namn",
        search_people: "S\xF6k personer",
        search: "S\xF6k",
        following: "F\xF6ljer",
        requested: "Beg\xE4rd",
        follow: "F\xF6lj",
        no_people_found: "Inga personer hittades",
        try_different_name: "Prova ett annat namn.",
        could_not_load_people: "Kunde inte l\xE4sa in personer.",
        could_not_update_follow_request: "Kunde inte uppdatera f\xF6ljf\xF6rfr\xE5gan.",
        choose_activity_display: "V\xE4lj hur Kondis visar dina aktivitetsdata.",
        your_name: "Ditt namn",
        name_description: "Det h\xE4r namnet visas p\xE5 dina aktiviteter och din profil.",
        first_name: "F\xF6rnamn",
        last_name: "Efternamn",
        saving: "Sparar...",
        save_name: "Spara namn",
        you: "Du",
        profile_picture: "Profilbild",
        profile_picture_description: "Visas bredvid ditt namn p\xE5 aktiviteter och profiler.",
        choose_picture: "V\xE4lj bild",
        units_of_measurement: "M\xE5ttenheter",
        display_units: "Visa enheter",
        metric: "Metriskt",
        imperial: "Imperialt",
        welcome_to_kondis: "V\xE4lkommen till Kondis",
        setup_token_description: "Ange installationskoden som visas i serverloggen f\xF6r att komma ig\xE5ng.",
        setup_token: "Installationskod",
        see_latest_reactions: "Se de senaste reaktionerna och kommentarerna p\xE5 dina aktiviteter.",
        no_notifications_description: "Gilla-markeringar och kommentarer p\xE5 dina aktiviteter visas h\xE4r.",
        upload_activity_file: "Ladda upp tr\xE4ningsfiler",
        upload_activity_description: "L\xE4gg till tr\xE4ningsfiler direkt i ditt aktivitetsarkiv.",
        drop_activity_file: "Sl\xE4pp din tr\xE4ningsfil h\xE4r",
        drop_activity_files: "Sl\xE4pp dina tr\xE4ningsfiler h\xE4r",
        click_to_browse: "eller klicka f\xF6r att bl\xE4ddra p\xE5 din enhet",
        choose_activity_file: "V\xE4lj en eller flera .fit-, .tcx- eller .gpx-filer.",
        activity_uploaded: "Tr\xE4ningspasset \xE4r uppladdat.",
        activities_uploaded: "{count} tr\xE4ningspass \xE4r uppladdade.",
        activities_upload_failed: "{uploaded} uppladdade, {failed} misslyckades.",
        activities_upload_progress: "{uploaded} / {total} uppladdade",
        upload_queued: "K\xF6ad",
        upload_skipped: "\xD6verhoppad",
        upload_workout: "Ladda upp tr\xE4ningspass",
        upload_workouts: "Ladda upp tr\xE4ningspass",
        upload_failed: "Uppladdningen misslyckades.",
        processing_taking_long: "Bearbetningen av aktiviteten tar l\xE4ngre tid \xE4n v\xE4ntat",
        dont_have_account: "Har du inget konto?",
        create_one: "Skapa ett",
        create_your_account: "Skapa ditt konto",
        confirm_password: "Bekr\xE4fta l\xF6senord",
        already_have_account: "Har du redan ett konto?",
        search_results_for: "S\xF6kresultat f\xF6r \u201D{query}\u201D",
        activities_found: "{count} aktiviteter hittades",
        activity_found: "{count} aktivitet hittades",
        loading_more_activities: "Laddar fler aktiviteter...",
        effort_progress_description: "V\xE4lj en prestation f\xF6r att se hur dina resultat har utvecklats \xF6ver tid.",
        run: "L\xF6pning",
        ride: "Cykling",
        remove: "Ta bort",
        save_preference: "Spara inst\xE4llning",
        saved: "Sparat",
        record: "Spela in",
        server_url: "Serveradress",
        server_url_example: "Till exempel http://192.168.1.10:2293 eller https://kondis.example.com",
        server_url_settings_example: "Till exempel http://192.168.0.10 eller https://kondis.example.com",
        "continue": "Forts\xE4tt",
        retry: "F\xF6rs\xF6k igen",
        opening_identity_provider: "\xD6ppnar identitetsleverant\xF6r...",
        retry_in_browser: "F\xF6rs\xF6k igen i webbl\xE4saren",
        server_requires_setup: "Kondis-servern kr\xE4ver en f\xF6rsta installation. Slutf\xF6r installationen i webbl\xE4saren och \xE5terv\xE4nd sedan hit f\xF6r att logga in.",
        share_live_tracking: "Dela livef\xF6ljning",
        activity_paused: "Tr\xE4ningspasset \xE4r pausat",
        tap_to_view_activity: "Tryck f\xF6r att visa ditt tr\xE4ningspass",
        back: "Tillbaka",
        find_people: "Hitta personer",
        record_a_activity: "Registrera ett tr\xE4ningspass",
        sync_now: "Synka nu",
        everything_uploaded: "Allt \xE4r uppladdat",
        untitled_activity: "Namnl\xF6st tr\xE4ningspass",
        activity_route_map: "Karta \xF6ver aktivitetens rutt",
        try_again: "F\xF6rs\xF6k igen",
        saved_waiting_to_sync: "Sparad p\xE5 den h\xE4r enheten och v\xE4ntar p\xE5 synkning.",
        add_photos: "L\xE4gg till bilder",
        activity_analysis: "Aktivitetsanalys",
        splits: "Splittar",
        cycling_performance: "Cykelprestation",
        running_performance: "L\xF6pprestation",
        delete_activity: "Ta bort aktivitet",
        delete_activity_confirmation: "Detta tar permanent bort tr\xE4ningspasset och dess analys.",
        deleting: "Tar bort...",
        repeated_route: "\xC5terkommande rutt",
        activities_on_route: "{count} aktiviteter p\xE5 den h\xE4r rutten",
        activity_on_route: "{count} aktivitet p\xE5 den h\xE4r rutten",
        compare_matched_efforts: "J\xE4mf\xF6r din prestation mellan alla matchande f\xF6rs\xF6k.",
        view_matched_rides: "Visa matchande cykelpass",
        view_matched_runs: "Visa matchande l\xF6ppass",
        speed: "Hastighet",
        time: "Tid",
        power: "Effekt",
        elevation_short: "H\xF6jd",
        average_speed: "Snitthastighet",
        average_heart_rate: "Snittpuls",
        calories: "Kalorier",
        like_activity: "Gilla aktivitet",
        unlike_activity: "Ta bort gilla-markering",
        open_activity_photos: "\xD6ppna aktivitetsbilder",
        close_photos: "St\xE4ng bilder",
        photo_of: "Bild {current} av {total}",
        return_to_activity: "\xC5terg\xE5 till aktivitet",
        more_options: "Fler alternativ",
        edit_activity: "Redigera aktivitet",
        name: "Namn",
        activity_name: "Aktivitetsnamn",
        description: "Beskrivning",
        add_description: "L\xE4gg till en beskrivning",
        exclude_from_rankings: "Uteslut fr\xE5n rankningar",
        tags: "Taggar",
        race: "T\xE4vling",
        commute: "Pendling",
        workout: "Tr\xE4ning",
        activity: "Tr\xE4ningspass",
        recovery: "\xC5terh\xE4mtning",
        with_kid: "Med barn",
        with_pet: "Med husdjur",
        for_a_cause: "F\xF6r v\xE4lg\xF6renhet",
        new_best_all_time: "Nytt personb\xE4sta",
        new_second_best_all_time: "N\xE4st b\xE4sta resultatet",
        new_third_best_all_time: "Tredje b\xE4sta resultatet",
        new_best_year: "Nytt b\xE4sta f\xF6r {year}",
        new_second_best_year: "N\xE4st b\xE4sta f\xF6r {year}",
        new_third_best_year: "Tredje b\xE4sta f\xF6r {year}",
        no_matched_route_data: "Det finns ingen data f\xF6r matchande rutter",
        back_to_activity: "Tillbaka till aktivitet",
        progress_over_time: "Utveckling \xF6ver tid",
        fastest: "Snabbast",
        all_time_average: "Snitt genom tiderna",
        slowest: "L\xE5ngsammast",
        trending_average: "- Trendande snitt",
        each_effort: "- Varje f\xF6rs\xF6k",
        every_effort: "Varje f\xF6rs\xF6k",
        popular: "Popul\xE4rt",
        more_activities: "Fler aktiviteter",
        start_activity: "Starta tr\xE4ningspass",
        pause: "Pausa",
        resume: "\xC5teruppta",
        finish: "Avsluta",
        saving_and_syncing_activity: "Sparar och synkar tr\xE4ningspass...",
        activity_saved: "Tr\xE4ningspasset \xE4r sparat",
        dismiss: "St\xE4ng",
        no_gps_trace: "Ingen GPS-rutt registrerades f\xF6r den h\xE4r aktiviteten.",
        activity_title: "Aktivitetens titel",
        uploading_activity: "Laddar upp aktivitet...",
        save_activity: "Spara aktivitet",
        discard_activity: "Ta bort aktivitet",
        discard_activity_confirmation: "Den h\xE4r aktiviteten tas bort permanent och kan inte \xE5terst\xE4llas.",
        discard: "Ta bort",
        keep_activity: "Beh\xE5ll aktiviteten",
        choose_activity_type: "V\xE4lj aktivitetstyp",
        choose_sport: "V\xE4lj en sport",
        select_sport_to_record: "V\xE4lj vad du ska registrera",
        close: "St\xE4ng",
        search_sports: "S\xF6k sporter",
        selected: "Vald",
        nothing_to_see: "Det finns inget att se h\xE4r!",
        try_different_name_or_sport: "Prova ett annat namn eller en annan sport.",
        activity_waiting_to_sync: "{count} tr\xE4ningspass v\xE4ntar p\xE5 synkning",
        activities_waiting_to_sync: "{count} tr\xE4ningspass v\xE4ntar p\xE5 synkning",
        activities_saved_on_device: "De \xE4r sparade p\xE5 den h\xE4r enheten och finns tillg\xE4ngliga nedan.",
        request_pending: "F\xF6rfr\xE5gan v\xE4ntar",
        unfollow: "Sluta f\xF6lja",
        checking: "Kontrollerar...",
        save_and_test_connection: "Spara och testa anslutningen",
        sign_out_confirmation_title: "Logga ut?",
        sign_out_confirmation: "Du kommer att loggas ut fr\xE5n din Kondis-server",
        looking_for_gps: "S\xF6ker GPS...",
        gps_signal_weak: "GPS-signalen \xE4r svag",
        recording_failed: "Registreringen misslyckades",
        saved_will_upload_when_reachable: "Sparad p\xE5 den h\xE4r enheten. Den laddas upp n\xE4r din Kondis-server g\xE5r att n\xE5.",
        no_sports_found: "Inga sporter hittades",
        likes: "{count} gilla-markeringar",
        add_comment: "L\xE4gg till en kommentar",
        post: "Publicera",
        competition: "T\xE4vling",
        matched_rides: "Matchande cykelpass",
        matched_runs: "Matchande l\xF6ppass",
        compare_route_activities: "J\xE4mf\xF6r din prestation mellan {count} aktiviteter p\xE5 samma rutt",
        activities_count: "{count} aktiviteter",
        all_time_ranking: "Rankning genom tiderna",
        your_efforts: "Dina {effort}-resultat",
        every_result: "VARJE RESULTAT",
        effort_history: "Resultathistorik",
        effort: "Resultat",
        kilometre_abbreviation: "KM",
        achievement_badge_description: "{effort}: {rank}",
        performance: "prestation",
        best_efforts_progress: "Se hur dina b\xE4sta {activities} har utvecklats \xF6ver tid.",
        best_effort_sport: "Gren f\xF6r b\xE4sta prestation",
        higher_is_better: "H\xF6gre \xE4r b\xE4ttre",
        higher_is_faster: "H\xF6gre \xE4r snabbare",
        all_time: "Alla tider",
        no_efforts_yet: "Inga {effort}-prestationer \xE4nnu",
        import_more_activities: "Importera fler {activities} med n\xF6dv\xE4ndiga data f\xF6r att f\xF6lja denna prestation.",
        create_kondis_account: "Skapa ditt Kondis-konto",
        setup_token_verified: "Din installationskod har verifierats.",
        set_up: "Konfigurera",
        profile: "Profil",
        profile_unavailable: "Profilen \xE4r inte tillg\xE4nglig",
        person_not_found: "Personen kunde inte hittas.",
        loading_profile: "Laddar profil\u2026",
        your_profile: "Din profil",
        athlete: "Idrottare",
        cancel_request: "Avbryt f\xF6rfr\xE5gan",
        unblock: "H\xE4v blockering",
        block: "Blockera",
        your_activities: "Dina aktiviteter",
        your_activities_description: "Dina registrerade och uppladdade aktiviteter visas h\xE4r.",
        you_blocked_this_person: "Du har blockerat denna person",
        unblock_to_see_activities: "H\xE4v blockeringen f\xF6r att se aktivitetshistoriken.",
        follow_to_see_activities: "F\xF6lj f\xF6r att se aktiviteter",
        follow_to_see_activities_description: "N\xE4r f\xF6rfr\xE5gan godk\xE4nns visas deras aktiviteter och livesessioner h\xE4r och p\xE5 startsidan.",
        athlete_no_activity: "Denna idrottare har inte delat n\xE5gon aktivitet \xE4nnu.",
        activity_likes: "Aktivitetens gilla-markeringar",
        show_people_who_liked: "Visa personer som gillade denna aktivitet",
        likes_label: "Gilla-markeringar",
        no_likes_yet: "Inga gilla-markeringar \xE4nnu.",
        activity_type: "Aktivitetstyp",
        activity_description_placeholder: "Aktivitetsbeskrivning",
        activity_photos: "Aktivitetsfoton",
        swipeable_activity_photos: "Svepbara aktivitetsfoton",
        photo_carousel_controls: "Kontroller f\xF6r fotokarusell",
        activity_kilometre_splits: "Aktivitetens kilometersplittar",
        start: "Start",
        elevation_gain: "H\xF6jd\xF6kning",
        average_power: "Genomsnittlig effekt",
        energy: "Energi",
        heart_rate: "Puls",
        view_matched: "Visa matchade {activities}",
        cycling: "Cykling",
        running: "L\xF6pning",
        excluded_from_rankings_note: "Visas endast f\xF6r denna aktivitet; undantagen fr\xE5n rankingen.",
        distance_best_efforts: "B\xE4sta distansprestationer",
        power_best_efforts: "B\xE4sta effektprestationer",
        view_best_effort_history: "Visa historik \xF6ver b\xE4sta prestationer",
        new_ranked_best_all_time: "Ny {rank} b\xE4sta genom tiderna",
        new_ranked_best_year: "Ny {rank} b\xE4sta f\xF6r {year}",
        could_not_save_activity: "Aktiviteten kunde inte sparas. F\xF6rs\xF6k igen.",
        delete_activity_confirmation_prompt: "Ta bort denna aktivitet? Detta kan inte \xE5ngras.",
        could_not_delete_activity: "Aktiviteten kunde inte tas bort. F\xF6rs\xF6k igen.",
        matched_routes: "Matchade rutter",
        matched: "Matchade {activities}",
        route_performance_over_time: "Ruttprestation \xF6ver tid",
        performance_summary: "Prestationssammanfattning",
        matched_route_activities: "Aktiviteter p\xE5 matchad rutt",
        date: "Datum",
        versus_average: "mot genomsnitt",
        this_activity: "Denna {activity}",
        all_activities: "Alla aktiviteter",
        edit_activity_metadata: "Redigera aktivitetsmetadata",
        could_not_update_block: "Blockeringen kunde inte uppdateras.",
        jobs: "Jobb",
        job: "Jobb",
        queue: "K\xF6",
        job_name_activity_upload: "Laddade upp aktivitet",
        job_name_activity_metric_compute: "Ber\xE4knade m\xE5tt f\xF6r aktivitet",
        job_name_activity_best_effort_compute: "Ber\xE4knade b\xE4sta resultat f\xF6r aktivitet",
        job_name_activity_best_effort_rank: "Rankade b\xE4sta resultat f\xF6r aktivitet",
        job_name_activity_route_match_compute: "Matchade rutter f\xF6r aktivitet",
        job_name_activity_parse: "Tolkade aktivitet",
        job_name_activity_manual_create: "Skapade manuell aktivitet",
        job_name_activity_parse_queue_all: "K\xF6ade alla aktiviteter f\xF6r tolkning",
        job_name_activity_delete: "Tog bort aktivitet",
        job_name_activity_image_ingest: "L\xE4ste in aktivitetsbilder",
        job_name_activity_image_attach: "Kopplade aktivitetsbilder",
        job_name_activity_image_generate_thumbnails: "Skapade miniatyrbilder f\xF6r aktivitetsbilder",
        job_name_activity_image_generate_queue_all: "K\xF6ade alla aktivitetsbilder f\xF6r bearbetning",
        job_name_user_avatar_upload: "Laddade upp anv\xE4ndaravatar",
        job_name_file_delete: "Tog bort fil",
        job_name_temporary_file_cleanup: "Rensade tillf\xE4lliga filer",
        job_queues: "Jobbk\xF6er",
        administration: "Administration",
        job_queues_description: "\xD6vervaka bakgrundsbearbetning och granska den senaste jobbhistoriken.",
        job_queue_status: "Status f\xF6r jobbk\xF6er",
        activity_processing: "Aktivitetsbearbetning",
        activity_processing_description: "Tolka tr\xE4ningspass och ber\xE4kna m\xE4tv\xE4rden, b\xE4sta resultat och ruttmatchningar.",
        imports_and_tasks: "Importer och bakgrundsuppgifter",
        imports_and_tasks_description: "F\xF6rbered uppladdningar, packa upp exporter och samordna f\xF6ljduppgifter.",
        image_processing: "Bildbearbetning",
        image_processing_description: "L\xE4s in aktivitetsbilder och skapa visningsstorlekar.",
        storage_tasks: "Lagringsuppgifter",
        storage_tasks_description: "Ta bort filer och rensa tillf\xE4lliga uppladdningar.",
        queue_running: "K\xF6rs",
        active: "Aktiva",
        waiting: "V\xE4ntar",
        failed: "Misslyckade",
        pause_queue: "Pausa k\xF6",
        resume_queue: "\xC5teruppta k\xF6",
        refresh: "Uppdatera",
        recent_jobs: "Senaste jobb",
        recent_jobs_description: "K\xF6at och slutf\xF6rt arbete som servern sparar.",
        no_job_history: "Inga jobb har registrerats \xE4nnu",
        no_job_history_description: "Bakgrundsarbete visas h\xE4r efter att det har k\xF6ats.",
        status: "Status",
        started: "Startat",
        duration: "Varaktighet",
        jobs_shown: "Visar {shown} av {total} jobb",
        load_more: "Visa fler",
        page: "Sida",
        of_pages: "av {total}",
        go_to_page: "G\xE5 till sida",
        previous_page: "F\xF6reg\xE5ende sida",
        next_page: "N\xE4sta sida",
        attempt_number: "F\xF6rs\xF6k {number}",
        job_status_queued: "K\xF6ad",
        job_status_running: "K\xF6rs",
        job_status_succeeded: "Slutf\xF6rd",
        job_status_failed: "Misslyckad",
        job_status_skipped: "\xD6verhoppad",
        view_error: "Visa fel",
        job_dashboard_load_error: "Kunde inte uppdatera jobbstatus.",
        job_queue_action_error: "Kunde inte uppdatera k\xF6n."
      }
    };
    preferredLocale = /* @__PURE__ */ __name(() => {
      return "en";
    }, "preferredLocale");
    __name(t2, "t");
  }
});

// .svelte-kit/output/server/chunks/format.js
function activityName(activity) {
  if (activity.name) return activity.name;
  return activity.sport.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function distance(value, unitSystem) {
  if (value == null) return "\u2014";
  const converted = unitSystem === "metric" ? value / 1e3 : value / METERS_PER_MILE;
  const unit = unitSystem === "metric" ? "km" : "mi";
  return `${converted.toFixed(converted >= 10 ? 1 : 2)} ${unit}`;
}
function elevation(value, unitSystem) {
  if (value == null) return "\u2014";
  return unitSystem === "metric" ? `${Math.round(value)} m` : `${Math.round(value * FEET_PER_METER)} ft`;
}
function duration(seconds) {
  if (seconds == null) return "\u2014";
  const rounded = Math.max(0, Math.round(seconds));
  return `${Math.floor(rounded / 60)}:${(rounded % 60).toString().padStart(2, "0")}`;
}
function ordinal(value) {
  const lastTwoDigits = value % 100;
  return `${value}${lastTwoDigits >= 11 && lastTwoDigits <= 13 ? "th" : value % 10 === 1 ? "st" : value % 10 === 2 ? "nd" : value % 10 === 3 ? "rd" : "th"}`;
}
function speed(value, unitSystem) {
  if (value == null) return "\u2014";
  return unitSystem === "metric" ? `${(value * 3.6).toFixed(1)} km/h` : `${(value * MILES_PER_HOUR_PER_METER_PER_SECOND).toFixed(1)} mph`;
}
function pace(value, unitSystem, swimming = false) {
  if (value == null || value <= 0 || !Number.isFinite(value)) return "\u2014";
  const distanceMeters = swimming ? unitSystem === "metric" ? 100 : 100 * METERS_PER_YARD : unitSystem === "metric" ? 1e3 : METERS_PER_MILE;
  const unit = swimming ? unitSystem === "metric" ? "100m" : "100yd" : unitSystem === "metric" ? "km" : "mi";
  const paceSeconds = Math.round(distanceMeters / value);
  return `${Math.floor(paceSeconds / 60)}:${(paceSeconds % 60).toString().padStart(2, "0")} min/${unit}`;
}
function effortDuration(seconds) {
  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor(rounded % 3600 / 60);
  const remainder = rounded % 60;
  return hours ? `${hours}:${minutes.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}` : `${minutes}:${remainder.toString().padStart(2, "0")}`;
}
function bestEffortValue(value, kind, unitSystem) {
  switch (kind) {
    case "duration":
      return effortDuration(value);
    case "distance":
      return distance(value, unitSystem);
    case "elevation":
      return elevation(value, unitSystem);
    case "power":
      return `${Math.round(value)} W`;
  }
}
function localDate(value) {
  const date = new Date(value);
  const today = /* @__PURE__ */ new Date();
  const dayStart = /* @__PURE__ */ __name((source2) => new Date(source2.getFullYear(), source2.getMonth(), source2.getDate()).getTime(), "dayStart");
  const dayDifference = Math.round((dayStart(today) - dayStart(date)) / 864e5);
  if (dayDifference === 0) return "Today";
  if (dayDifference === 1) return "Yesterday";
  if (dayDifference === -1) return "Tomorrow";
  return new Intl.DateTimeFormat(void 0, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}
function localTime(value) {
  return new Intl.DateTimeFormat(void 0, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
function relativeTime(value, now = /* @__PURE__ */ new Date(), options2 = {}) {
  const { justNowSeconds = 45, showSeconds = false } = options2;
  const seconds = Math.max(0, Math.floor((now.getTime() - new Date(value).getTime()) / 1e3));
  if (seconds < justNowSeconds) return "Just now";
  if (showSeconds && seconds < 60) return `${seconds} seconds ago`;
  if (seconds < 90) return "1 minute ago";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 45) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  if (minutes < 90) return "1 hour ago";
  const hours = Math.floor(minutes / 60);
  if (hours < 22) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  if (hours < 36) return "1 day ago";
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  if (days < 14) return "1 week ago";
  const weeks = Math.floor(days / 7);
  if (days < 28) return `${weeks} weeks ago`;
  if (days < 60) return "1 month ago";
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} months ago`;
  if (days < 730) return "1 year ago";
  return `${Math.floor(days / 365)} years ago`;
}
function relativeOrDateTime(value, now = /* @__PURE__ */ new Date(), options2 = {}) {
  const timestamp = new Date(value);
  const ageInSeconds = (now.getTime() - timestamp.getTime()) / 1e3;
  if (ageInSeconds > -60 && ageInSeconds < RELATIVE_TIME_MAX_AGE_SECONDS) return relativeTime(timestamp, now, options2);
  return new Intl.DateTimeFormat(void 0, {
    dateStyle: "medium",
    timeStyle: "medium"
  }).format(timestamp);
}
var METERS_PER_MILE, METERS_PER_YARD, FEET_PER_METER, MILES_PER_HOUR_PER_METER_PER_SECOND, RELATIVE_TIME_MAX_AGE_SECONDS;
var init_format = __esm({
  ".svelte-kit/output/server/chunks/format.js"() {
    METERS_PER_MILE = 1609.344;
    METERS_PER_YARD = 0.9144;
    FEET_PER_METER = 3.28084;
    MILES_PER_HOUR_PER_METER_PER_SECOND = 2.236936;
    RELATIVE_TIME_MAX_AGE_SECONDS = 604800;
    __name(activityName, "activityName");
    __name(distance, "distance");
    __name(elevation, "elevation");
    __name(duration, "duration");
    __name(ordinal, "ordinal");
    __name(speed, "speed");
    __name(pace, "pace");
    __name(effortDuration, "effortDuration");
    __name(bestEffortValue, "bestEffortValue");
    __name(localDate, "localDate");
    __name(localTime, "localTime");
    __name(relativeTime, "relativeTime");
    __name(relativeOrDateTime, "relativeOrDateTime");
  }
});

// .svelte-kit/output/server/chunks/realtime.js
var init_realtime = __esm({
  ".svelte-kit/output/server/chunks/realtime.js"() {
  }
});

// .svelte-kit/output/server/entries/pages/_layout.svelte.js
var layout_svelte_exports = {};
__export(layout_svelte_exports, {
  default: () => _layout
});
function Clipboard_pen_line($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "clipboard-pen-line" },
    props,
    { iconNode: [
      ["rect", {
        "width": "8",
        "height": "4",
        "x": "8",
        "y": "2",
        "rx": "1"
      }],
      ["path", { "d": "M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-.5" }],
      ["path", { "d": "M16 4h2a2 2 0 0 1 1.73 1" }],
      ["path", { "d": "M8 18h1" }],
      ["path", { "d": "M21.378 12.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z" }]
    ] }
  ]));
}
function Log_out($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "log-out" },
    props,
    { iconNode: [
      ["path", { "d": "m16 17 5-5-5-5" }],
      ["path", { "d": "M21 12H9" }],
      ["path", { "d": "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" }]
    ] }
  ]));
}
function Plus($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "plus" },
    props,
    { iconNode: [["path", { "d": "M5 12h14" }], ["path", { "d": "M12 5v14" }]] }
  ]));
}
function Search($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "search" },
    props,
    { iconNode: [["path", { "d": "m21 21-4.34-4.34" }], ["circle", {
      "cx": "11",
      "cy": "11",
      "r": "8"
    }]] }
  ]));
}
function Settings($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "settings" },
    props,
    { iconNode: [["path", { "d": "M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" }], ["circle", {
      "cx": "12",
      "cy": "12",
      "r": "3"
    }]] }
  ]));
}
function Sun($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "sun" },
    props,
    { iconNode: [
      ["circle", {
        "cx": "12",
        "cy": "12",
        "r": "4"
      }],
      ["path", { "d": "M12 2v2" }],
      ["path", { "d": "M12 20v2" }],
      ["path", { "d": "m4.93 4.93 1.41 1.41" }],
      ["path", { "d": "m17.66 17.66 1.41 1.41" }],
      ["path", { "d": "M2 12h2" }],
      ["path", { "d": "M20 12h2" }],
      ["path", { "d": "m6.34 17.66-1.41 1.41" }],
      ["path", { "d": "m19.07 4.93-1.41 1.41" }]
    ] }
  ]));
}
function Users($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "users" },
    props,
    { iconNode: [
      ["path", { "d": "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" }],
      ["path", { "d": "M16 3.128a4 4 0 0 1 0 7.744" }],
      ["path", { "d": "M22 21v-2a4 4 0 0 0-3-3.87" }],
      ["circle", {
        "cx": "9",
        "cy": "7",
        "r": "4"
      }]
    ] }
  ]));
}
function Sidebar($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { user } = $$props;
    const items = [
      {
        href: "/",
        label: t2("home"),
        icon: Activity,
        section: null
      },
      {
        href: "/best-efforts",
        label: t2("best_efforts"),
        icon: Trophy,
        section: "/best-efforts"
      },
      {
        href: "/people",
        label: t2("people"),
        icon: Users,
        section: "/people"
      }
    ];
    const adminItem = {
      href: "/admin/jobs",
      label: t2("job_queues"),
      icon: List_checks,
      section: "/admin/jobs"
    };
    $$renderer2.push(`<aside class="sidebar"><a class="brand" href="/" data-sveltekit-preload-data="hover"${attr("aria-label", t2("kondis_home"))}><span class="brand-mark" aria-hidden="true">\u{1F630}</span> <span>${escape_html(t2("app_name"))}</span></a> <nav${attr("aria-label", t2("primary_navigation"))}><!--[-->`);
    const each_array = ensure_array_like(items);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let item = each_array[$$index];
      $$renderer2.push(`<a${attr("href", item.href)}${attr("data-sveltekit-preload-data", item.href === "/" ? "hover" : void 0)}${attr_class("", void 0, { "active": item.section ? page2.url.pathname.startsWith(item.section) : page2.url.pathname === item.href })}>`);
      if (item.icon) {
        $$renderer2.push("<!--[-->");
        item.icon($$renderer2, { size: 19 });
        $$renderer2.push("<!--]-->");
      } else {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push("<!--]-->");
      }
      $$renderer2.push(` ${escape_html(item.label)}</a>`);
    }
    $$renderer2.push(`<!--]--> `);
    if (user?.role === "admin") {
      $$renderer2.push(`<!--[0--><a${attr("href", adminItem.href)}${attr_class("", void 0, { "active": page2.url.pathname.startsWith(adminItem.section) })}>`);
      if (adminItem.icon) {
        $$renderer2.push("<!--[-->");
        adminItem.icon($$renderer2, { size: 19 });
        $$renderer2.push("<!--]-->");
      } else {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push("<!--]-->");
      }
      $$renderer2.push(` ${escape_html(adminItem.label)}</a>`);
    } else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--></nav> <div class="build-notice"${attr("title", buildInfo.revision ? `${buildInfo.version} \xB7 ${buildInfo.revision}` : buildInfo.version)}><span class="build-version">v. ${escape_html(buildInfo.version)}</span> `);
    if (buildInfo.branch) $$renderer2.push(`<!--[0--><span class="build-revision">${escape_html(buildInfo.branch)}</span>`);
    else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--> `);
    if (buildInfo.commit) $$renderer2.push(`<!--[0--><span class="build-revision">${escape_html(buildInfo.commit)}</span>`);
    else if (buildInfo.buildType === "development") $$renderer2.push(`<!--[1--><span class="build-revision">${escape_html(t2("development_build"))}</span>`);
    else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--></div></aside> <nav class="mobile-nav"${attr("aria-label", t2("mobile_navigation"))}><a href="/" data-sveltekit-preload-data="hover"${attr_class("", void 0, { "active": page2.url.pathname === "/" })}>`);
    Activity($$renderer2, { size: 21 });
    $$renderer2.push(`<!----><span>${escape_html(t2("home"))}</span></a> <a href="/best-efforts"${attr_class("", void 0, { "active": page2.url.pathname.startsWith("/best-efforts") })}>`);
    Trophy($$renderer2, { size: 21 });
    $$renderer2.push(`<!----><span>${escape_html(t2("best_efforts"))}</span></a> <a href="/people"${attr_class("", void 0, { "active": page2.url.pathname.startsWith("/people") })}>`);
    Users($$renderer2, { size: 21 });
    $$renderer2.push(`<!----><span>${escape_html(t2("people"))}</span></a> `);
    if (user?.role === "admin") {
      $$renderer2.push(`<!--[0--><a href="/admin/jobs"${attr_class("", void 0, { "active": page2.url.pathname.startsWith("/admin/jobs") })}>`);
      List_checks($$renderer2, { size: 21 });
      $$renderer2.push(`<!----><span>${escape_html(t2("jobs"))}</span></a>`);
    } else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--></nav>`);
  });
}
function Topbar($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { user, eventsUrl, onUpload } = $$props;
    let menuOpen = false;
    let plusMenuOpen = false;
    let notificationsOpen = false;
    let notificationCount = 0;
    const accountName = derived(() => {
      const name = user ? userDisplayName(user) : "";
      const email = user?.email?.trim();
      if (name && (!email || name.toLowerCase() !== email.toLowerCase())) return name;
      const localPart = email?.split("@", 1)[0];
      if (localPart) return localPart.replace(/[._-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
      return t2("account");
    });
    derived(() => accountName().slice(0, 1).toUpperCase());
    $$renderer2.push(`<header class="topbar">`);
    $$renderer2.push(`<!--[-1--><button class="search-toggle" type="button"${attr("aria-label", t2("search_activities"))}>`);
    Search($$renderer2, { size: 21 });
    $$renderer2.push(`<!----></button>`);
    $$renderer2.push(`<!--]--> <button class="theme-toggle" type="button"${attr("aria-label", t2("switch_to_light_mode"))}${attr("title", t2("switch_to_light_mode"))}>`);
    $$renderer2.push("<!--[0-->");
    Sun($$renderer2, { size: 19 });
    $$renderer2.push(`<!--]--></button> <details${attr("open", notificationsOpen, true)} class="notification-menu"><summary${attr("aria-label", t2("open_notifications"))}>`);
    Bell($$renderer2, { size: 20 });
    $$renderer2.push(`<!----> `);
    if (notificationBadgeLabel(notificationCount)) $$renderer2.push(`<!--[0--><span class="notification-badge">${escape_html(notificationBadgeLabel(notificationCount))}</span>`);
    else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--></summary> <div class="notification-popover"><div class="notification-popover-heading"><strong>${escape_html(t2("notifications"))}</strong> <a href="/notifications">${escape_html(t2("view_all"))}</a></div> `);
    $$renderer2.push(`<!--[-1--><p class="notification-empty">${escape_html(t2("no_notifications_yet"))}</p>`);
    $$renderer2.push(`<!--]--></div></details> <details${attr("open", plusMenuOpen, true)} class="plus-menu"><summary${attr("aria-label", t2("add_activity"))}>`);
    Plus($$renderer2, { size: 20 });
    $$renderer2.push(`<!----></summary> <div class="plus-menu-popover"><button type="button">`);
    File_up($$renderer2, { size: 19 });
    $$renderer2.push(`<!----> ${escape_html(t2("upload_activity"))}</button> <button type="button">`);
    Clipboard_pen_line($$renderer2, { size: 19 });
    $$renderer2.push(`<!----> ${escape_html(t2("add_manual_entry"))}</button></div></details> <details${attr("open", menuOpen, true)} class="user-menu"><summary${attr("aria-label", t2("open_account_menu"))}>`);
    UserAvatar($$renderer2, {
      name: accountName(),
      src: user?.avatarUrl,
      size: 42
    });
    $$renderer2.push(`<!----></summary> <div class="user-menu-popover"><div class="user-menu-identity"><strong>${escape_html(accountName())}</strong> <small>${escape_html(user?.email)}</small></div> <a href="/settings">`);
    Settings($$renderer2, { size: 17 });
    $$renderer2.push(`<!----> ${escape_html(t2("settings"))}</a> <form method="POST" action="/logout"><button type="submit">`);
    Log_out($$renderer2, { size: 17 });
    $$renderer2.push(`<!----> ${escape_html(t2("log_out"))}</button></form></div></details></header>`);
  });
}
function _layout($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { children, data } = $$props;
    head("12qhfyh", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>${escape_html(t2("app_name"))}</title>`);
      });
      $$renderer3.push(`<meta name="description"${attr("content", t2("app_description"))}/>`);
    });
    if (!data.authenticated) {
      $$renderer2.push("<!--[0-->");
      children($$renderer2);
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[-1-->");
      Sidebar($$renderer2, { user: data.user });
      $$renderer2.push(`<!----> `);
      Topbar($$renderer2, {
        user: data.user,
        eventsUrl: data.eventsUrl,
        onUpload: /* @__PURE__ */ __name(() => void goto("/upload"), "onUpload")
      });
      $$renderer2.push(`<!----> <main class="app-main">`);
      children($$renderer2);
      $$renderer2.push(`<!----></main>`);
    }
    $$renderer2.push(`<!--]-->`);
  });
}
var version, commit, branch2, buildInfo;
var init_layout_svelte = __esm({
  ".svelte-kit/output/server/entries/pages/_layout.svelte.js"() {
    init_index_server();
    init_shared_server();
    init_server();
    init_client();
    init_navigation();
    init_Icon();
    init_activity();
    init_notifications();
    init_file_up();
    init_list_checks();
    init_trophy();
    init_state();
    init_i18n();
    init_user_name();
    init_build();
    init_api2();
    init_format();
    init_realtime();
    __name(Clipboard_pen_line, "Clipboard_pen_line");
    __name(Log_out, "Log_out");
    __name(Plus, "Plus");
    __name(Search, "Search");
    __name(Settings, "Settings");
    __name(Sun, "Sun");
    __name(Users, "Users");
    version = public_env.PUBLIC_KONDIS_VERSION?.trim() || {
      name: "kondis",
      "private": true,
      version: "0.0.0",
      type: "module",
      description: "Monorepo for Kondis",
      license: "AGPL-3.0-or-later",
      packageManager: "pnpm@11.25.0"
    }.version;
    commit = public_env.PUBLIC_KONDIS_COMMIT?.trim() || "";
    branch2 = public_env.PUBLIC_KONDIS_BRANCH?.trim() || "";
    buildInfo = {
      version,
      commit,
      branch: branch2,
      buildType: public_env.PUBLIC_KONDIS_BUILD_TYPE?.trim() || "",
      revision: [branch2, commit].filter(Boolean).join(" \xB7 ")
    };
    __name(Sidebar, "Sidebar");
    __name(Topbar, "Topbar");
    __name(_layout, "_layout");
  }
});

// .svelte-kit/output/server/nodes/0.js
var __exports = {};
__export(__exports, {
  component: () => component,
  fonts: () => fonts,
  imports: () => imports,
  index: () => index,
  server: () => layout_server_ts_exports,
  server_id: () => server_id,
  stylesheets: () => stylesheets
});
var index, component_cache, component, server_id, imports, stylesheets, fonts;
var init__ = __esm({
  ".svelte-kit/output/server/nodes/0.js"() {
    init_layout_server_ts();
    index = 0;
    component = /* @__PURE__ */ __name(async () => component_cache ??= (await Promise.resolve().then(() => (init_layout_svelte(), layout_svelte_exports))).default, "component");
    server_id = "src/routes/+layout.server.ts";
    imports = ["_app/immutable/nodes/0.MJCG3bUF.js", "_app/immutable/chunks/TqmLiPd2.js", "_app/immutable/chunks/B90Er9NH.js", "_app/immutable/chunks/xihTtKlq.js", "_app/immutable/chunks/LlbaMzKX.js", "_app/immutable/chunks/D5mC9s7c.js", "_app/immutable/chunks/CiSxC57J.js", "_app/immutable/chunks/IqFp0kpg.js", "_app/immutable/chunks/CL7EZexq.js", "_app/immutable/chunks/BcsRuf6u.js", "_app/immutable/chunks/DzOiouzx.js", "_app/immutable/chunks/CqyzYzP_.js", "_app/immutable/chunks/CBfwGKJV.js", "_app/immutable/chunks/DnWgfvLw.js", "_app/immutable/chunks/COo21xW_.js", "_app/immutable/chunks/BNBsMhO5.js", "_app/immutable/chunks/CAMS0kRz.js", "_app/immutable/chunks/B4Kzzj8V.js"];
    stylesheets = ["_app/immutable/assets/0.Bq25TgHu.css"];
    fonts = [];
  }
});

// .svelte-kit/output/server/chunks/arrow-left.js
function Arrow_left($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "arrow-left" },
    props,
    { iconNode: [["path", { "d": "m12 19-7-7 7-7" }], ["path", { "d": "M19 12H5" }]] }
  ]));
}
var init_arrow_left = __esm({
  ".svelte-kit/output/server/chunks/arrow-left.js"() {
    init_server();
    init_Icon();
    __name(Arrow_left, "Arrow_left");
  }
});

// .svelte-kit/output/server/entries/pages/_error.svelte.js
var error_svelte_exports = {};
__export(error_svelte_exports, {
  default: () => _error
});
function Route_off($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "route-off" },
    props,
    { iconNode: [
      ["circle", {
        "cx": "6",
        "cy": "19",
        "r": "3"
      }],
      ["path", { "d": "M9 19h8.5c.4 0 .9-.1 1.3-.2" }],
      ["path", { "d": "M5.2 5.2A3.5 3.53 0 0 0 6.5 12H12" }],
      ["path", { "d": "m2 2 20 20" }],
      ["path", { "d": "M21 15.3a3.5 3.5 0 0 0-3.3-3.3" }],
      ["path", { "d": "M15 5h-4.3" }],
      ["circle", {
        "cx": "18",
        "cy": "5",
        "r": "3"
      }]
    ] }
  ]));
}
function _error($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    $$renderer2.push(`<div class="empty-state error-page"><span class="empty-icon">`);
    Route_off($$renderer2, { size: 28 });
    $$renderer2.push(`<!----></span> <span class="eyebrow">${escape_html(t2("error_label"))} ${escape_html(page2.status)}</span> <h1>${escape_html(page2.error?.message ?? t2("error_generic_title"))}</h1> <a class="back-link" href="/">`);
    Arrow_left($$renderer2, { size: 18 });
    $$renderer2.push(`<!----> ${escape_html(t2("return_to_activities"))}</a></div>`);
  });
}
var init_error_svelte = __esm({
  ".svelte-kit/output/server/entries/pages/_error.svelte.js"() {
    init_server();
    init_Icon();
    init_arrow_left();
    init_state();
    init_i18n();
    __name(Route_off, "Route_off");
    __name(_error, "_error");
  }
});

// .svelte-kit/output/server/nodes/1.js
var __exports2 = {};
__export(__exports2, {
  component: () => component2,
  fonts: () => fonts2,
  imports: () => imports2,
  index: () => index2,
  stylesheets: () => stylesheets2
});
var index2, component_cache2, component2, imports2, stylesheets2, fonts2;
var init__2 = __esm({
  ".svelte-kit/output/server/nodes/1.js"() {
    index2 = 1;
    component2 = /* @__PURE__ */ __name(async () => component_cache2 ??= (await Promise.resolve().then(() => (init_error_svelte(), error_svelte_exports))).default, "component");
    imports2 = ["_app/immutable/nodes/1.CCgni1NS.js", "_app/immutable/chunks/TqmLiPd2.js", "_app/immutable/chunks/xihTtKlq.js", "_app/immutable/chunks/D5mC9s7c.js", "_app/immutable/chunks/Cb18XCVn.js", "_app/immutable/chunks/DnWgfvLw.js", "_app/immutable/chunks/B90Er9NH.js", "_app/immutable/chunks/COo21xW_.js", "_app/immutable/chunks/CEcIxoMy.js"];
    stylesheets2 = [];
    fonts2 = [];
  }
});

// .svelte-kit/output/server/entries/pages/_page.server.ts.js
var page_server_ts_exports = {};
__export(page_server_ts_exports, {
  load: () => load2
});
var load2;
var init_page_server_ts = __esm({
  ".svelte-kit/output/server/entries/pages/_page.server.ts.js"() {
    init_api();
    init_build();
    init_api2();
    load2 = /* @__PURE__ */ __name(async ({ locals, request, url }) => {
      const eventsUrl = activityEventsUrl(url, request.headers.get("x-forwarded-proto"), request.headers.get("cf-visitor"), request.headers.get("x-forwarded-host") ?? request.headers.get("host"));
      try {
        const [liveResponse, body] = await Promise.all([locals.kondisFetch(apiUrl("api/v1/live-workouts")), socialControllerFeed({}, getServerSdkRequestOptions(locals.kondisFetch))]);
        const liveWorkouts = liveResponse.ok ? await liveResponse.json() : [];
        return {
          ...body,
          unavailable: false,
          eventsUrl,
          liveWorkouts
        };
      } catch {
        return {
          activities: [],
          nextCursor: null,
          total: 0,
          unavailable: true,
          eventsUrl,
          liveWorkouts: []
        };
      }
    }, "load");
  }
});

// .svelte-kit/output/server/chunks/activity-types.js
function Bike($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "bike" },
    props,
    { iconNode: [
      ["circle", {
        "cx": "18.5",
        "cy": "17.5",
        "r": "3.5"
      }],
      ["circle", {
        "cx": "5.5",
        "cy": "17.5",
        "r": "3.5"
      }],
      ["circle", {
        "cx": "15",
        "cy": "5",
        "r": "1"
      }],
      ["path", { "d": "M12 17.5V14l-3-3 4-3 2 3h2" }]
    ] }
  ]));
}
function Dumbbell($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "dumbbell" },
    props,
    { iconNode: [
      ["path", { "d": "M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z" }],
      ["path", { "d": "m2.5 21.5 1.4-1.4" }],
      ["path", { "d": "m20.1 3.9 1.4-1.4" }],
      ["path", { "d": "M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z" }],
      ["path", { "d": "m9.6 14.4 4.8-4.8" }]
    ] }
  ]));
}
function Footprints($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "footprints" },
    props,
    { iconNode: [
      ["path", { "d": "M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z" }],
      ["path", { "d": "M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z" }],
      ["path", { "d": "M16 17h4" }],
      ["path", { "d": "M4 13h4" }]
    ] }
  ]));
}
function Heart_pulse($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "heart-pulse" },
    props,
    { iconNode: [["path", { "d": "M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" }], ["path", { "d": "M3.22 13H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" }]] }
  ]));
}
function Mountain($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "mountain" },
    props,
    { iconNode: [["path", { "d": "m8 3 4 8 5-5 5 15H2L8 3z" }]] }
  ]));
}
function Snowflake($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "snowflake" },
    props,
    { iconNode: [
      ["path", { "d": "m10 20-1.25-2.5L6 18" }],
      ["path", { "d": "M10 4 8.75 6.5 6 6" }],
      ["path", { "d": "m14 20 1.25-2.5L18 18" }],
      ["path", { "d": "m14 4 1.25 2.5L18 6" }],
      ["path", { "d": "m17 21-3-6h-4" }],
      ["path", { "d": "m17 3-3 6 1.5 3" }],
      ["path", { "d": "M2 12h6.5L10 9" }],
      ["path", { "d": "m20 10-1.5 2 1.5 2" }],
      ["path", { "d": "M22 12h-6.5L14 15" }],
      ["path", { "d": "m4 10 1.5 2L4 14" }],
      ["path", { "d": "m7 21 3-6-1.5-3" }],
      ["path", { "d": "m7 3 3 6h4" }]
    ] }
  ]));
}
function Sport_shoe($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "sport-shoe" },
    props,
    { iconNode: [
      ["path", { "d": "m15 10.42 4.8-5.07" }],
      ["path", { "d": "M19 18h3" }],
      ["path", { "d": "M9.5 22 21.414 9.415A2 2 0 0 0 21.2 6.4l-5.61-4.208A1 1 0 0 0 14 3v2a2 2 0 0 1-1.394 1.906L8.677 8.053A1 1 0 0 0 8 9c-.155 6.393-2.082 9-4 9a2 2 0 0 0 0 4h14" }]
    ] }
  ]));
}
function Waves_horizontal($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "waves-horizontal" },
    props,
    { iconNode: [
      ["path", { "d": "M2 12q2.5 2 5 0t5 0 5 0 5 0" }],
      ["path", { "d": "M2 19q2.5 2 5 0t5 0 5 0 5 0" }],
      ["path", { "d": "M2 5q2.5 2 5 0t5 0 5 0 5 0" }]
    ] }
  ]));
}
var ActivityMapStyle, presentation, ACTIVITY_TYPE_PRESENTATION, activityTypeSettings, activityTypeOptions, activityTypeLabel, sportIcon;
var init_activity_types = __esm({
  ".svelte-kit/output/server/chunks/activity-types.js"() {
    init_server();
    init_Icon();
    init_build();
    init_api2();
    __name(Bike, "Bike");
    __name(Dumbbell, "Dumbbell");
    __name(Footprints, "Footprints");
    __name(Heart_pulse, "Heart_pulse");
    __name(Mountain, "Mountain");
    __name(Snowflake, "Snowflake");
    __name(Sport_shoe, "Sport_shoe");
    __name(Waves_horizontal, "Waves_horizontal");
    ActivityMapStyle = /* @__PURE__ */ (function(ActivityMapStyle2) {
      ActivityMapStyle2["Route"] = "route";
      ActivityMapStyle2["Heatmap"] = "heatmap";
      return ActivityMapStyle2;
    })({});
    presentation = /* @__PURE__ */ __name((label, icon, mapStyle = ActivityMapStyle.Route) => ({
      label,
      icon,
      mapStyle
    }), "presentation");
    ACTIVITY_TYPE_PRESENTATION = {
      [ActivityType_Output.AlpineSki]: presentation("Alpine skiing", Snowflake),
      [ActivityType_Output.BackcountrySki]: presentation("Backcountry skiing", Snowflake),
      [ActivityType_Output.Badminton]: presentation("Badminton", Heart_pulse),
      [ActivityType_Output.Basketball]: presentation("Basketball", Heart_pulse),
      [ActivityType_Output.Canoeing]: presentation("Canoeing", Waves_horizontal),
      [ActivityType_Output.Cricket]: presentation("Cricket", Heart_pulse),
      [ActivityType_Output.CrossCountrySki]: presentation("Cross-country skiing", Snowflake),
      [ActivityType_Output.Crossfit]: presentation("CrossFit", Dumbbell),
      [ActivityType_Output.Dance]: presentation("Dance", Heart_pulse),
      [ActivityType_Output.EBikeRide]: presentation("E-bike ride", Bike),
      [ActivityType_Output.Elliptical]: presentation("Elliptical", Heart_pulse),
      [ActivityType_Output.EMountainBikeRide]: presentation("E-mountain bike ride", Bike),
      [ActivityType_Output.Golf]: presentation("Golf", Heart_pulse, ActivityMapStyle.Heatmap),
      [ActivityType_Output.GravelRide]: presentation("Gravel ride", Bike),
      [ActivityType_Output.Handcycle]: presentation("Handcycle", Bike),
      [ActivityType_Output.HighIntensityIntervalTraining]: presentation("HIIT", Dumbbell),
      [ActivityType_Output.Hike]: presentation("Hike", Footprints),
      [ActivityType_Output.IceSkate]: presentation("Ice skating", Snowflake),
      [ActivityType_Output.InlineSkate]: presentation("Inline skating", Sport_shoe),
      [ActivityType_Output.Kayaking]: presentation("Kayaking", Waves_horizontal),
      [ActivityType_Output.Kitesurf]: presentation("Kitesurfing", Waves_horizontal),
      [ActivityType_Output.MountainBikeRide]: presentation("Mountain bike ride", Bike),
      [ActivityType_Output.Padel]: presentation("Padel", Heart_pulse),
      [ActivityType_Output.PhysicalTherapy]: presentation("Physical therapy", Heart_pulse),
      [ActivityType_Output.Pickleball]: presentation("Pickleball", Heart_pulse),
      [ActivityType_Output.Pilates]: presentation("Pilates", Heart_pulse),
      [ActivityType_Output.Racquetball]: presentation("Racquetball", Heart_pulse),
      [ActivityType_Output.Ride]: presentation("Ride", Bike),
      [ActivityType_Output.RockClimbing]: presentation("Rock climbing", Mountain),
      [ActivityType_Output.RollerSki]: presentation("Roller skiing", Mountain),
      [ActivityType_Output.Rowing]: presentation("Rowing", Waves_horizontal),
      [ActivityType_Output.Run]: presentation("Run", Sport_shoe),
      [ActivityType_Output.Sail]: presentation("Sailing", Waves_horizontal, ActivityMapStyle.Heatmap),
      [ActivityType_Output.Skateboard]: presentation("Skateboarding", Sport_shoe, ActivityMapStyle.Heatmap),
      [ActivityType_Output.Snowboard]: presentation("Snowboarding", Snowflake),
      [ActivityType_Output.Snowshoe]: presentation("Snowshoeing", Snowflake),
      [ActivityType_Output.Soccer]: presentation("Football (soccer)", Heart_pulse, ActivityMapStyle.Heatmap),
      [ActivityType_Output.Squash]: presentation("Squash", Heart_pulse),
      [ActivityType_Output.StairStepper]: presentation("Stair stepper", Heart_pulse),
      [ActivityType_Output.StandUpPaddling]: presentation("Stand-up paddling", Waves_horizontal),
      [ActivityType_Output.Surfing]: presentation("Surfing", Waves_horizontal, ActivityMapStyle.Heatmap),
      [ActivityType_Output.Swim]: presentation("Swim", Waves_horizontal),
      [ActivityType_Output.TableTennis]: presentation("Table tennis", Heart_pulse),
      [ActivityType_Output.Tennis]: presentation("Tennis", Heart_pulse),
      [ActivityType_Output.TrailRun]: presentation("Trail run", Sport_shoe),
      [ActivityType_Output.Velomobile]: presentation("Velomobile", Bike),
      [ActivityType_Output.VirtualRide]: presentation("Virtual ride", Bike),
      [ActivityType_Output.VirtualRow]: presentation("Virtual row", Waves_horizontal),
      [ActivityType_Output.VirtualRun]: presentation("Virtual run", Sport_shoe),
      [ActivityType_Output.Volleyball]: presentation("Volleyball", Heart_pulse),
      [ActivityType_Output.Walk]: presentation("Walk", Footprints),
      [ActivityType_Output.WeightTraining]: presentation("Weight training", Dumbbell),
      [ActivityType_Output.Wheelchair]: presentation("Wheelchair", Footprints),
      [ActivityType_Output.Windsurf]: presentation("Windsurfing", Waves_horizontal),
      [ActivityType_Output.Workout]: presentation("Workout", Heart_pulse),
      [ActivityType_Output.Yoga]: presentation("Yoga", Heart_pulse),
      [ActivityType_Output.Other]: presentation("Other", Heart_pulse)
    };
    activityTypeSettings = /* @__PURE__ */ __name((types, type) => {
      const settings = types.find((candidate) => candidate.type === type);
      if (!settings) throw new Error(`Missing backend settings for ${type}`);
      return {
        ...settings,
        ...ACTIVITY_TYPE_PRESENTATION[type]
      };
    }, "activityTypeSettings");
    activityTypeOptions = /* @__PURE__ */ __name((types) => types.map(({ type }) => ({
      value: type,
      label: ACTIVITY_TYPE_PRESENTATION[type].label
    })), "activityTypeOptions");
    activityTypeLabel = /* @__PURE__ */ __name((types, type) => activityTypeSettings(types, type).label, "activityTypeLabel");
    sportIcon = /* @__PURE__ */ __name((type) => ACTIVITY_TYPE_PRESENTATION[type].icon, "sportIcon");
  }
});

// .svelte-kit/output/server/chunks/cloud-off.js
function Cloud_off($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "cloud-off" },
    props,
    { iconNode: [
      ["path", { "d": "M10.94 5.274A7 7 0 0 1 15.71 10h1.79a4.5 4.5 0 0 1 4.222 6.057" }],
      ["path", { "d": "M18.796 18.81A4.5 4.5 0 0 1 17.5 19H9A7 7 0 0 1 5.79 5.78" }],
      ["path", { "d": "m2 2 20 20" }]
    ] }
  ]));
}
var init_cloud_off = __esm({
  ".svelte-kit/output/server/chunks/cloud-off.js"() {
    init_server();
    init_Icon();
    __name(Cloud_off, "Cloud_off");
  }
});

// .svelte-kit/output/server/chunks/RouteMap.js
function Heart($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "heart" },
    props,
    { iconNode: [["path", { "d": "M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" }]] }
  ]));
}
function Map_pin_off($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "map-pin-off" },
    props,
    { iconNode: [
      ["path", { "d": "M12.75 7.09a3 3 0 0 1 2.16 2.16" }],
      ["path", { "d": "M17.072 17.072c-1.634 2.17-3.527 3.912-4.471 4.727a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 1.432-4.568" }],
      ["path", { "d": "m2 2 20 20" }],
      ["path", { "d": "M8.475 2.818A8 8 0 0 1 20 10c0 1.183-.31 2.377-.81 3.533" }],
      ["path", { "d": "M9.13 9.13a3 3 0 0 0 3.74 3.74" }]
    ] }
  ]));
}
function RouteMap($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { coordinates, mode = ActivityMapStyle.Route, compact: compact2 = false, showEndpoints = true, route = [], medals = [], highlight = null, onPointHover } = $$props;
    if (coordinates && coordinates.length >= 2) $$renderer2.push(`<!--[0--><div${attr_class("route-map", void 0, { "route-map-compact": compact2 })}${attr("aria-label", mode === ActivityMapStyle.Heatmap ? t2("activity_density_map") : t2("activity_route_map"))}></div>`);
    else {
      $$renderer2.push(`<!--[-1--><div class="map-empty">`);
      Map_pin_off($$renderer2, { size: 27 });
      $$renderer2.push(`<!----><strong>${escape_html(t2("no_gps_route"))}</strong><span>${escape_html(t2("no_location_data"))}</span></div>`);
    }
    $$renderer2.push(`<!--]-->`);
  });
}
var init_RouteMap = __esm({
  ".svelte-kit/output/server/chunks/RouteMap.js"() {
    init_index_server();
    init_server();
    init_Icon();
    init_activity_types();
    init_i18n();
    __name(Heart, "Heart");
    __name(Map_pin_off, "Map_pin_off");
    __name(RouteMap, "RouteMap");
  }
});

// .svelte-kit/output/server/chunks/arrow-up-right.js
function Arrow_up_right($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "arrow-up-right" },
    props,
    { iconNode: [["path", { "d": "M7 7h10v10" }], ["path", { "d": "M7 17 17 7" }]] }
  ]));
}
var init_arrow_up_right = __esm({
  ".svelte-kit/output/server/chunks/arrow-up-right.js"() {
    init_server();
    init_Icon();
    __name(Arrow_up_right, "Arrow_up_right");
  }
});

// .svelte-kit/output/server/chunks/medal.js
function Medal($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "medal" },
    props,
    { iconNode: [
      ["path", { "d": "M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15" }],
      ["path", { "d": "M11 12 5.12 2.2" }],
      ["path", { "d": "m13 12 5.88-9.8" }],
      ["path", { "d": "M8 7h8" }],
      ["circle", {
        "cx": "12",
        "cy": "17",
        "r": "5"
      }],
      ["path", { "d": "M12 18v-2h-.5" }]
    ] }
  ]));
}
var init_medal = __esm({
  ".svelte-kit/output/server/chunks/medal.js"() {
    init_server();
    init_Icon();
    __name(Medal, "Medal");
  }
});

// .svelte-kit/output/server/chunks/best-efforts.js
function bestEffortLabel(type) {
  return BEST_EFFORT_LABELS[type] ?? type;
}
function bestEffortRecordName(type) {
  const label = bestEffortLabel(type);
  return type === "1_mile" ? "mile" : label;
}
function bestEffortDistance(type) {
  return BEST_EFFORT_DISTANCES[type] ?? 0;
}
var BEST_EFFORT_LABELS, BEST_EFFORT_DISTANCES;
var init_best_efforts = __esm({
  ".svelte-kit/output/server/chunks/best-efforts.js"() {
    BEST_EFFORT_LABELS = {
      "400m": "400 m",
      "1k": "1K",
      half_mile: "1/2 mile",
      "1_mile": "1 mile",
      "2_miles": "2 miles",
      "5k": "5K",
      "10k": "10K",
      "15k": "15K",
      "10_miles": "10 miles",
      "20k": "20K",
      half_marathon: "Half marathon",
      "30k": "30K",
      marathon: "Marathon",
      "50k": "50K",
      longest_ride: "Longest ride",
      biggest_climb: "Biggest climb",
      elevation_gain: "Elevation gain",
      "5_miles": "5 miles",
      "40k": "40K",
      "80k": "80K",
      "50_miles": "50 miles",
      "90k": "90K",
      "100k": "100K",
      "100_miles": "100 miles",
      "180k": "180K",
      power_5s: "5 sec power",
      power_15s: "15 sec power",
      power_30s: "30 sec power",
      power_1m: "1 min power",
      power_2m: "2 min power",
      power_3m: "3 min power",
      power_5m: "5 min power",
      power_8m: "8 min power",
      power_10m: "10 min power",
      power_15m: "15 min power",
      power_20m: "20 min power",
      power_30m: "30 min power",
      power_45m: "45 min power",
      power_1h: "1 hour power",
      power_2h: "2 hour power"
    };
    __name(bestEffortLabel, "bestEffortLabel");
    __name(bestEffortRecordName, "bestEffortRecordName");
    BEST_EFFORT_DISTANCES = {
      "400m": 400,
      "1k": 1e3,
      half_mile: 804.672,
      "1_mile": 1609.344,
      "2_miles": 3218.688,
      "5k": 5e3,
      "10k": 1e4,
      "15k": 15e3,
      "10_miles": 16093.44,
      "20k": 2e4,
      half_marathon: 21097.5,
      "30k": 3e4,
      marathon: 42195,
      "50k": 5e4,
      longest_ride: Number.POSITIVE_INFINITY
    };
    __name(bestEffortDistance, "bestEffortDistance");
  }
});

// .svelte-kit/output/server/chunks/ActivityCard.js
function Message_circle($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "message-circle" },
    props,
    { iconNode: [["path", { "d": "M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" }]] }
  ]));
}
function achievementRank(effort) {
  return effort.overallRank <= 3 ? effort.overallRank : effort.yearRank;
}
function achievementMedalLabel(rank) {
  return rank === 1 ? "Gold medal" : rank === 2 ? "Silver medal" : "Bronze medal";
}
function distinctAchievementEfforts(efforts) {
  const seenRanks = /* @__PURE__ */ new Set();
  return [...efforts].sort((a2, b) => achievementRank(a2) - achievementRank(b)).filter((effort) => {
    const rank = achievementRank(effort);
    if (seenRanks.has(rank)) return false;
    seenRanks.add(rank);
    return true;
  }).slice(0, 3);
}
function shouldShowAchievementCount(count, efforts) {
  if (count <= 1) return false;
  const ranks = new Set(distinctAchievementEfforts(efforts).map(achievementRank));
  if (count === 2 && ranks.has(2) && ranks.has(3)) return false;
  if (count === 3 && [
    1,
    2,
    3
  ].every((rank) => ranks.has(rank))) return false;
  return true;
}
function ActivityCard($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { activity, activityTypes, unitSystem, viewerId } = $$props;
    let liked = false;
    let likeCount = 0;
    let likeBusy = false;
    let descriptionExpanded = false;
    const Icon2 = derived(() => sportIcon(activity.sport));
    const descriptionExpandable = derived(() => (activity.description?.length ?? 0) > 320);
    const settings = derived(() => activityTypeSettings(activityTypes, activity.sport));
    const average = derived(() => settings().averageMetric === AverageMetric.Speed ? {
      label: "Avg speed",
      value: speed(activity.metrics?.avgSpeed ?? null, unitSystem)
    } : settings().averageMetric === AverageMetric.None ? null : {
      label: "Pace",
      value: pace(activity.metrics?.avgSpeed ?? null, unitSystem, settings().averageMetric === AverageMetric.SwimPace)
    });
    const stats = derived(() => [
      {
        label: "Distance",
        value: distance(activity.metrics?.distance ?? null, unitSystem)
      },
      ...average() ? [average()] : [],
      {
        label: "Moving time",
        value: activity.metrics ? duration(activity.metrics.movingTime ?? activity.metrics.elapsedTime) : "\u2014"
      },
      {
        label: "Elevation",
        value: elevation(activity.metrics?.elevationGain ?? null, unitSystem)
      }
    ]);
    const achievementCount = derived(() => activity.achievementCount ?? activity.topBestEfforts?.length ?? 0);
    const personalRecord = derived(() => (() => {
      const records = activity.topBestEfforts?.slice().filter(({ overallRank }) => overallRank >= 1 && overallRank <= 3) ?? [];
      const powerRecords = records.filter(({ type }) => type.startsWith("power_"));
      return (powerRecords.length ? powerRecords : records).sort((left, right) => powerDuration(right.type) - powerDuration(left.type) || bestEffortDistance(right.type) - bestEffortDistance(left.type) || left.overallRank - right.overallRank)[0] ?? null;
    })());
    const activityOwner = derived(() => viewerId && (activity.userId === viewerId || activity.athlete?.id === viewerId) ? "Your" : activity.athlete ? userPossessiveName(activity.athlete) : "This athlete's");
    function achievementText(effort) {
      const { type } = effort;
      const label = bestEffortLabel(type);
      const rank = personalRecord()?.overallRank ?? 1;
      const rankLabel = rank === 1 ? "" : `${ordinal(rank)} `;
      if (type === "longest_ride") return `${activityOwner()} ${rankLabel}longest ride!`;
      if (type === "biggest_climb") return `${activityOwner()} ${rankLabel}biggest climb!`;
      if (type.startsWith("power_")) return `${activityOwner()} ${rankLabel}highest power output for ${powerDurationLabel(type)} ever!`;
      return type.includes("power") || type === "elevation_gain" ? `${activityOwner()} ${rankLabel}best ${label}!` : `${activityOwner()} ${rankLabel}fastest ${label}!`;
    }
    __name(achievementText, "achievementText");
    function powerDuration(type) {
      const match = /^power_(\d+)(s|m|h)$/.exec(type);
      if (!match) return 0;
      const [, amount, unit] = match;
      return Number(amount) * (unit === "h" ? 3600 : unit === "m" ? 60 : 1);
    }
    __name(powerDuration, "powerDuration");
    function powerDurationLabel(type) {
      const match = /^power_(\d+)(s|m|h)$/.exec(type);
      if (!match) return bestEffortLabel(type).replace(" power", "");
      const [, amount, unit] = match;
      return `${amount} ${unit === "h" ? "hour" : unit === "m" ? "minute" : "second"}${amount === "1" ? "" : "s"}`;
    }
    __name(powerDurationLabel, "powerDurationLabel");
    $$renderer2.push(`<article class="activity-card"><a${attr_class("activity-card-summary", void 0, { "has-description": Boolean(activity.description) })}${attr("href", `/activities/${activity.id}`)}><div class="activity-card-identity">`);
    UserAvatar($$renderer2, {
      name: activity.athlete ? userDisplayName(activity.athlete) : t2("you"),
      src: activity.athlete?.avatarUrl,
      size: 54
    });
    $$renderer2.push(`<!----></div> <div class="activity-primary"><div class="activity-title activity-name-title"><h3>${escape_html(activityName(activity))}</h3> `);
    Arrow_up_right($$renderer2, { size: 17 });
    $$renderer2.push(`<!----></div> <p><span>${escape_html(localDate(activity.startedAt))} \xB7 ${escape_html(localTime(activity.startedAt))}</span><span${attr_class("activity-sport-inline", void 0, { "running-sport": [
      "run",
      "trail_run",
      "virtual_run"
    ].includes(activity.sport) })}${attr("aria-label", activityTypeLabel(activityTypes, activity.sport))}>`);
    if (Icon2()) {
      $$renderer2.push("<!--[-->");
      Icon2()($$renderer2, {
        size: 16,
        strokeWidth: 1.8
      });
      $$renderer2.push("<!--]-->");
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push("<!--]-->");
    }
    $$renderer2.push(`</span></p> `);
    if (activity.tags?.length) {
      $$renderer2.push(`<!--[0--><div class="activity-tags"${attr("aria-label", t2("activity_tags"))}><!--[-->`);
      const each_array = ensure_array_like(activity.tags);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let tag = each_array[$$index];
        $$renderer2.push(`<span class="activity-tag">${escape_html(tag.replaceAll("_", " "))}</span>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    } else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--></div> `);
    if (activity.description) $$renderer2.push(`<!--[0--><p${attr_class("activity-card-description", void 0, { "expanded": descriptionExpanded })}>${escape_html(activity.description)}</p>`);
    else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--> <div class="activity-feed-stats"><div class="activity-stat activity-medal-stat"${attr("aria-label", t2("medals_count", { count: achievementCount() }))}><div class="activity-medal-value">`);
    if (shouldShowAchievementCount(achievementCount(), activity.topBestEfforts ?? [])) $$renderer2.push(`<!--[0--><strong>${escape_html(achievementCount())}</strong>`);
    else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--> <!--[-->`);
    const each_array_1 = ensure_array_like(distinctAchievementEfforts(activity.topBestEfforts ?? []));
    for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
      let effort = each_array_1[$$index_1];
      $$renderer2.push(`<span${attr_class(`activity-achievement rank-${achievementRank(effort)}`)}${attr("title", `${achievementMedalLabel(achievementRank(effort))}: ${bestEffortLabel(effort.type)}`)}${attr("aria-label", `${achievementMedalLabel(achievementRank(effort))}: ${bestEffortLabel(effort.type)}`)}>`);
      Medal($$renderer2, { size: 20 });
      $$renderer2.push(`<!----></span>`);
    }
    $$renderer2.push(`<!--]--></div></div> <!--[-->`);
    const each_array_2 = ensure_array_like(stats());
    for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
      let stat = each_array_2[$$index_2];
      $$renderer2.push(`<div class="activity-stat"><strong>${escape_html(stat.value)}</strong><small>${escape_html(stat.label)}</small></div>`);
    }
    $$renderer2.push(`<!--]--></div></a> `);
    if (activity.description && descriptionExpandable()) $$renderer2.push(`<!--[0--><button class="activity-card-description-toggle" type="button"${attr("aria-expanded", descriptionExpanded)}>${escape_html("Show more")}</button>`);
    else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--> `);
    if (personalRecord()) {
      $$renderer2.push(`<!--[0--><div class="activity-pr-banner"${attr("aria-label", `Overall rank ${personalRecord().overallRank}: ${achievementText(personalRecord())}`)}><span${attr_class(`activity-pr-badge rank-${personalRecord().overallRank}`)} aria-hidden="true">`);
      Medal($$renderer2, { size: 25 });
      $$renderer2.push(`<!----><small>${escape_html(personalRecord().overallRank === 1 ? "PR" : personalRecord().overallRank)}</small></span> <strong>${escape_html(achievementText(personalRecord()))}</strong></div>`);
    } else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--> `);
    if (activity.track || activity.images?.length) {
      $$renderer2.push(`<!--[0--><a class="activity-card-media-link"${attr("href", `/activities/${activity.id}`)}><div${attr_class("activity-card-media", void 0, { "activity-card-media-split": Boolean(activity.track && activity.images?.length === 1) })}>`);
      if (activity.track) {
        $$renderer2.push(`<!--[0--><div class="activity-card-map">`);
        RouteMap($$renderer2, {
          coordinates: activity.track.coordinates,
          compact: true,
          showEndpoints: false
        });
        $$renderer2.push(`<!----></div>`);
      } else $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<!--]--> `);
      if (activity.images?.length) {
        $$renderer2.push(`<!--[0--><div${attr_class("activity-card-images", void 0, {
          "activity-card-images-with-map": Boolean(activity.track),
          "activity-card-images-two": activity.images.length === 2
        })}${attr("aria-label", `${activity.images.length} activity ${activity.images.length === 1 ? "image" : "images"}`)}><!--[-->`);
        const each_array_3 = ensure_array_like(activity.images.slice(0, 6));
        for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
          let image = each_array_3[$$index_3];
          const imageUrl = image.preview ?? image.original ?? image.thumbnail;
          if (imageUrl) $$renderer2.push(`<!--[0--><span class="activity-card-image"><img${attr("src", imageUrl)}${attr("alt", image.caption ?? "")}${attr("width", image.width ?? void 0)}${attr("height", image.height ?? void 0)} loading="lazy"/></span>`);
          else $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<!--]-->`);
        }
        $$renderer2.push(`<!--]--></div>`);
      } else $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<!--]--></div></a>`);
    } else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--> `);
    if (activity.commentCount !== void 0) {
      $$renderer2.push(`<!--[0--><div class="activity-social-row"><button type="button"${attr_class("activity-social-button", void 0, { "liked": liked })}${attr("disabled", likeBusy, true)}${attr("aria-label", "Like activity")}>`);
      Heart($$renderer2, {
        size: 17,
        fill: "none"
      });
      $$renderer2.push(`<!----> ${escape_html(likeCount)}</button> <a class="activity-social-button"${attr("href", `/activities/${activity.id}#comments`)}>`);
      Message_circle($$renderer2, { size: 17 });
      $$renderer2.push(`<!----> ${escape_html(activity.commentCount ?? 0)}</a></div>`);
    } else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--></article>`);
  });
}
var init_ActivityCard = __esm({
  ".svelte-kit/output/server/chunks/ActivityCard.js"() {
    init_server();
    init_navigation();
    init_Icon();
    init_arrow_up_right();
    init_activity_types();
    init_RouteMap();
    init_medal();
    init_i18n();
    init_user_name();
    init_build();
    init_api2();
    init_format();
    init_best_efforts();
    __name(Message_circle, "Message_circle");
    __name(achievementRank, "achievementRank");
    __name(achievementMedalLabel, "achievementMedalLabel");
    __name(distinctAchievementEfforts, "distinctAchievementEfforts");
    __name(shouldShowAchievementCount, "shouldShowAchievementCount");
    __name(ActivityCard, "ActivityCard");
  }
});

// .svelte-kit/output/server/entries/pages/_page.svelte.js
var page_svelte_exports = {};
__export(page_svelte_exports, {
  default: () => _page
});
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    let query = page2.url.searchParams.get("search") ?? "";
    let appendedActivities = [];
    let cursorOverride = void 0;
    let totalOverride = void 0;
    let searchAppendedActivities = [];
    let searchCursor = null;
    const activities = derived(() => {
      const byUpload = new Map(data.activities.map((activity) => [activity.uploadId, activity]));
      for (const activity of appendedActivities) byUpload.set(activity.uploadId, activity);
      return [...byUpload.values()].sort((a2, b) => b.startedAt.localeCompare(a2.startedAt) || b.id.localeCompare(a2.id));
    });
    const nextCursor = derived(() => cursorOverride === void 0 ? data.nextCursor : cursorOverride);
    const total = derived(() => totalOverride ?? data.total);
    const hasSearch = derived(() => query.trim().length > 0);
    const displayedActivities = derived(() => hasSearch() ? [...[], ...searchAppendedActivities] : activities());
    const displayedNextCursor = derived(() => hasSearch() ? searchCursor : nextCursor());
    const displayedTotal = derived(() => hasSearch() ? 0 : total());
    const heading = derived(() => hasSearch() ? t2("search_results_for", { query: query.trim() }) : t2("home"));
    const resultSummary = derived(() => displayedTotal() === 1 ? t2("activity_found", { count: displayedTotal() }) : t2("activities_found", { count: displayedTotal() }));
    const snapshot = {
      capture: /* @__PURE__ */ __name(() => ({
        appendedActivities,
        cursorOverride,
        totalOverride,
        query,
        scrollY: window.scrollY
      }), "capture"),
      restore: /* @__PURE__ */ __name((value) => {
        appendedActivities = value.appendedActivities;
        cursorOverride = value.cursorOverride;
        totalOverride = value.totalOverride;
        query = value.query;
        (/* @__PURE__ */ tick()).then(() => requestAnimationFrame(() => window.scrollTo({ top: value.scrollY })));
      }, "restore")
    };
    head("1uha8ag", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>${escape_html(t2("activities"))} \xB7 Kondis</title>`);
      });
    });
    $$renderer2.push(`<div class="page-shell home-page">`);
    if (hasSearch()) $$renderer2.push(`<!--[0--><header class="page-header"><div><h1>${escape_html(heading())}</h1> <p>${escape_html(resultSummary())}</p></div></header>`);
    else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--> `);
    if (data.unavailable) {
      $$renderer2.push(`<!--[0--><div class="notice">`);
      Cloud_off($$renderer2, { size: 20 });
      $$renderer2.push(`<!----><span><strong>${escape_html(t2("server_unavailable"))}</strong> ${escape_html(t2("start_api_to_load_activities"))}</span></div>`);
    } else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--> `);
    if (data.liveWorkouts.length) {
      $$renderer2.push(`<!--[0--><section class="live-workout-list"${attr("aria-label", t2("live_activities"))}><!--[-->`);
      const each_array = ensure_array_like(data.liveWorkouts);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let workout = each_array[$$index];
        const Icon2 = sportIcon(workout.sport);
        const averageSpeed = workout.elapsedSeconds > 0 ? workout.distanceMeters / workout.elapsedSeconds : null;
        $$renderer2.push(`<article class="activity-card live-activity-card"><a class="activity-card-summary"${attr("href", `/live/session/${workout.id}`)}><div class="sport-badge">`);
        if (Icon2) {
          $$renderer2.push("<!--[-->");
          Icon2($$renderer2, {
            size: 24,
            strokeWidth: 1.8
          });
          $$renderer2.push("<!--]-->");
        } else {
          $$renderer2.push("<!--[!-->");
          $$renderer2.push("<!--]-->");
        }
        $$renderer2.push(` <span${attr_class("live-beacon", void 0, { "paused": workout.status === "paused" })}${attr("aria-label", t2("live_recording"))}></span></div> <div class="activity-primary"><div class="activity-title"><h3>${escape_html(activityTypeLabel(data.activityTypes, workout.sport))}</h3></div> <p>${escape_html(localDate(workout.startedAt))} \xB7 ${escape_html(localTime(workout.startedAt))} \xB7
                ${escape_html(workout.status === "paused" ? t2("paused") : t2("live"))}</p></div> <div class="activity-feed-stats"><div class="activity-stat"><strong>${escape_html(distance(workout.distanceMeters, data.unitSystem))}</strong><small>${escape_html(t2("distance"))}</small></div> <div class="activity-stat"><strong>${escape_html(pace(averageSpeed, data.unitSystem))}</strong><small>${escape_html(t2("pace"))}</small></div> <div class="activity-stat"><strong>${escape_html(duration(workout.elapsedSeconds))}</strong><small>${escape_html(t2("moving_time"))}</small></div> <div class="activity-stat"><strong>${escape_html(elevation(null, data.unitSystem))}</strong><small>${escape_html(t2("elevation"))}</small></div></div></a> `);
        if (workout.route.length >= 2) {
          $$renderer2.push(`<!--[0--><a class="activity-card-media-link"${attr("href", `/live/session/${workout.id}`)}><div class="activity-card-media"><div class="activity-card-map live-list-map">`);
          RouteMap($$renderer2, {
            coordinates: workout.route,
            compact: true,
            showEndpoints: false
          });
          $$renderer2.push(`<!----></div></div></a>`);
        } else $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<!--]--></article>`);
      }
      $$renderer2.push(`<!--]--></section>`);
    } else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--> `);
    if (displayedActivities().length) {
      $$renderer2.push(`<!--[0--><div class="activity-list"><!--[-->`);
      const each_array_1 = ensure_array_like(displayedActivities());
      for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
        let activity = each_array_1[$$index_1];
        ActivityCard($$renderer2, {
          activity,
          activityTypes: data.activityTypes,
          unitSystem: data.unitSystem,
          viewerId: data.user?.id
        });
      }
      $$renderer2.push(`<!--]--></div> `);
      if (displayedNextCursor()) {
        $$renderer2.push(`<!--[0--><div class="load-more" aria-live="polite">`);
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<!--]--></div>`);
      } else $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<!--]-->`);
    } else if (!data.unavailable && true) {
      $$renderer2.push(`<!--[1--><div class="empty-state"><span class="empty-icon">`);
      Activity($$renderer2, { size: 28 });
      $$renderer2.push(`<!----></span> <h2>${escape_html(query ? t2("no_matching_activities") : t2("first_activity_starts_here"))}</h2> <p>${escape_html(query ? t2("try_different_activity_search") : t2("no_activities"))}</p></div>`);
    } else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--></div>`);
    bind_props($$props, { snapshot });
  });
}
var init_page_svelte = __esm({
  ".svelte-kit/output/server/entries/pages/_page.svelte.js"() {
    init_index_server();
    init_server();
    init_navigation();
    init_activity();
    init_activity_types();
    init_cloud_off();
    init_RouteMap();
    init_ActivityCard();
    init_state();
    init_i18n();
    init_api2();
    init_format();
    __name(_page, "_page");
  }
});

// .svelte-kit/output/server/nodes/2.js
var __exports3 = {};
__export(__exports3, {
  component: () => component3,
  fonts: () => fonts3,
  imports: () => imports3,
  index: () => index3,
  server: () => page_server_ts_exports,
  server_id: () => server_id2,
  stylesheets: () => stylesheets3
});
var index3, component_cache3, component3, server_id2, imports3, stylesheets3, fonts3;
var init__3 = __esm({
  ".svelte-kit/output/server/nodes/2.js"() {
    init_page_server_ts();
    index3 = 2;
    component3 = /* @__PURE__ */ __name(async () => component_cache3 ??= (await Promise.resolve().then(() => (init_page_svelte(), page_svelte_exports))).default, "component");
    server_id2 = "src/routes/+page.server.ts";
    imports3 = ["_app/immutable/nodes/2.aewHJRvi.js", "_app/immutable/chunks/TqmLiPd2.js", "_app/immutable/chunks/B90Er9NH.js", "_app/immutable/chunks/xihTtKlq.js", "_app/immutable/chunks/LlbaMzKX.js", "_app/immutable/chunks/CiSxC57J.js", "_app/immutable/chunks/D5mC9s7c.js", "_app/immutable/chunks/N8DLpoKl.js", "_app/immutable/chunks/BNBsMhO5.js", "_app/immutable/chunks/ItcJ_Du-.js", "_app/immutable/chunks/jeJNHXOu.js", "_app/immutable/chunks/HclGiUj8.js", "_app/immutable/chunks/COo21xW_.js", "_app/immutable/chunks/BQ8XCk7I.js", "_app/immutable/chunks/DOWdbKEB.js", "_app/immutable/chunks/BpqxhcYW.js", "_app/immutable/chunks/BNDfWvQn.js", "_app/immutable/chunks/CL7EZexq.js", "_app/immutable/chunks/CAMS0kRz.js", "_app/immutable/chunks/CtcJAU9W.js", "_app/immutable/chunks/DnWgfvLw.js", "_app/immutable/chunks/B4Kzzj8V.js"];
    stylesheets3 = [];
    fonts3 = [];
  }
});

// .svelte-kit/output/server/entries/pages/activities/_id_/_page.server.ts.js
var page_server_ts_exports2 = {};
__export(page_server_ts_exports2, {
  load: () => load3
});
var load3;
var init_page_server_ts2 = __esm({
  ".svelte-kit/output/server/entries/pages/activities/_id_/_page.server.ts.js"() {
    init_api();
    init_build();
    init_api2();
    init_exports();
    load3 = /* @__PURE__ */ __name(async ({ locals, params }) => {
      try {
        return { activity: await activityControllerGetById({ id: params.id }, getServerSdkRequestOptions(locals.kondisFetch)) };
      } catch (requestError) {
        if (requestError.status === 404) error(404, "Activity not found");
        error(503, "Could not load this activity");
      }
    }, "load");
  }
});

// .svelte-kit/output/server/chunks/chevron-left.js
function Chevron_left($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "chevron-left" },
    props,
    { iconNode: [["path", { "d": "m15 18-6-6 6-6" }]] }
  ]));
}
var init_chevron_left = __esm({
  ".svelte-kit/output/server/chunks/chevron-left.js"() {
    init_server();
    init_Icon();
    __name(Chevron_left, "Chevron_left");
  }
});

// .svelte-kit/output/server/chunks/chevron-right.js
function Chevron_right($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "chevron-right" },
    props,
    { iconNode: [["path", { "d": "m9 18 6-6-6-6" }]] }
  ]));
}
var init_chevron_right = __esm({
  ".svelte-kit/output/server/chunks/chevron-right.js"() {
    init_server();
    init_Icon();
    __name(Chevron_right, "Chevron_right");
  }
});

// .svelte-kit/output/server/chunks/clock-3.js
function Clock_3($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "clock-3" },
    props,
    { iconNode: [["circle", {
      "cx": "12",
      "cy": "12",
      "r": "10"
    }], ["path", { "d": "M12 6v6h4" }]] }
  ]));
}
var init_clock_3 = __esm({
  ".svelte-kit/output/server/chunks/clock-3.js"() {
    init_server();
    init_Icon();
    __name(Clock_3, "Clock_3");
  }
});

// .svelte-kit/output/server/chunks/trash-2.js
function Gauge($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "gauge" },
    props,
    { iconNode: [["path", { "d": "m12 14 4-4" }], ["path", { "d": "M3.34 19a10 10 0 1 1 17.32 0" }]] }
  ]));
}
function Trash_2($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "trash-2" },
    props,
    { iconNode: [
      ["path", { "d": "M10 11v6" }],
      ["path", { "d": "M14 11v6" }],
      ["path", { "d": "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" }],
      ["path", { "d": "M3 6h18" }],
      ["path", { "d": "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }]
    ] }
  ]));
}
var init_trash_2 = __esm({
  ".svelte-kit/output/server/chunks/trash-2.js"() {
    init_server();
    init_Icon();
    __name(Gauge, "Gauge");
    __name(Trash_2, "Trash_2");
  }
});

// .svelte-kit/output/server/chunks/map-pinned.js
function Map_pinned($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "map-pinned" },
    props,
    { iconNode: [
      ["path", { "d": "M18 8c0 3.613-3.869 7.429-5.393 8.795a1 1 0 0 1-1.214 0C9.87 15.429 6 11.613 6 8a6 6 0 0 1 12 0" }],
      ["circle", {
        "cx": "12",
        "cy": "8",
        "r": "2"
      }],
      ["path", { "d": "M8.714 14h-3.71a1 1 0 0 0-.948.683l-2.004 6A1 1 0 0 0 3 22h18a1 1 0 0 0 .948-1.316l-2-6a1 1 0 0 0-.949-.684h-3.712" }]
    ] }
  ]));
}
var init_map_pinned = __esm({
  ".svelte-kit/output/server/chunks/map-pinned.js"() {
    init_server();
    init_Icon();
    __name(Map_pinned, "Map_pinned");
  }
});

// .svelte-kit/output/server/chunks/timer.js
function Timer($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "timer" },
    props,
    { iconNode: [
      ["line", {
        "x1": "10",
        "x2": "14",
        "y1": "2",
        "y2": "2"
      }],
      ["line", {
        "x1": "12",
        "x2": "15",
        "y1": "14",
        "y2": "11"
      }],
      ["circle", {
        "cx": "12",
        "cy": "14",
        "r": "8"
      }]
    ] }
  ]));
}
var init_timer = __esm({
  ".svelte-kit/output/server/chunks/timer.js"() {
    init_server();
    init_Icon();
    __name(Timer, "Timer");
  }
});

// .svelte-kit/output/server/entries/pages/activities/_id_/_page.svelte.js
var page_svelte_exports2 = {};
__export(page_svelte_exports2, {
  default: () => _page2
});
function Flame($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "flame" },
    props,
    { iconNode: [["path", { "d": "M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4" }]] }
  ]));
}
function Pencil($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "pencil" },
    props,
    { iconNode: [["path", { "d": "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" }], ["path", { "d": "m15 5 4 4" }]] }
  ]));
}
function Send($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "send" },
    props,
    { iconNode: [["path", { "d": "M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" }], ["path", { "d": "m21.854 2.147-10.94 10.939" }]] }
  ]));
}
function X($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "x" },
    props,
    { iconNode: [["path", { "d": "M18 6 6 18" }], ["path", { "d": "m6 6 12 12" }]] }
  ]));
}
function Zap($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "zap" },
    props,
    { iconNode: [["path", { "d": "M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z" }]] }
  ]));
}
function ActivityProfile($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { points, selection = null, pointTime = null, onPointHover } = $$props;
    const width = 820;
    const height = 250;
    const padding = {
      top: 22,
      right: 18,
      bottom: 30,
      left: 46
    };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const validPoints = derived(() => points.filter((point) => Number.isFinite(point.distance) && Number.isFinite(point.altitude)));
    const minDistance = derived(() => validPoints().at(0)?.distance ?? 0);
    const maxDistance = derived(() => validPoints().at(-1)?.distance ?? 1);
    const rawMinAltitude = derived(() => validPoints().length === 0 ? 0 : Math.min(...validPoints().map((point) => point.altitude)));
    const rawMaxAltitude = derived(() => validPoints().length === 0 ? 1 : Math.max(...validPoints().map((point) => point.altitude)));
    const altitudePadding = derived(() => Math.max((rawMaxAltitude() - rawMinAltitude()) * 0.12, 4));
    const minAltitude = derived(() => rawMinAltitude() - altitudePadding());
    const maxAltitude = derived(() => rawMaxAltitude() + altitudePadding());
    const x = /* @__PURE__ */ __name((distance2) => padding.left + (distance2 - minDistance()) / Math.max(maxDistance() - minDistance(), 1) * chartWidth, "x");
    const y2 = /* @__PURE__ */ __name((altitude) => padding.top + (maxAltitude() - altitude) / Math.max(maxAltitude() - minAltitude(), 1) * chartHeight, "y");
    const profilePath = derived(() => validPoints().map((point, index23) => `${index23 === 0 ? "M" : "L"} ${x(point.distance)} ${y2(point.altitude)}`).join(" "));
    const areaPath = derived(() => validPoints().length === 0 ? "" : `${profilePath()} L ${x(validPoints().at(-1).distance)} ${padding.top + chartHeight} L ${x(validPoints()[0].distance)} ${padding.top + chartHeight} Z`);
    const selectedPoints = derived(() => selection ? validPoints().filter((point) => point.time >= selection.startTime && point.time <= selection.endTime) : []);
    const selectionStart = derived(() => selectedPoints().at(0));
    const selectionEnd = derived(() => selectedPoints().at(-1));
    const ticks = derived(() => [
      0,
      0.5,
      1
    ].map((ratio) => Math.round(minAltitude() + (maxAltitude() - minAltitude()) * ratio)));
    const kilometerLines = derived(() => Array.from({ length: Math.floor(maxDistance() / 1e3) }, (_, index23) => ({
      kilometer: index23 + 1,
      distance: (index23 + 1) * 1e3
    })));
    let hoveredPoint = null;
    const externalPoint = derived(() => pointTime == null ? null : validPoints().reduce((closest, point) => Math.abs(point.time - pointTime) < Math.abs(closest.time - pointTime) ? point : closest));
    const displayedPoint = derived(() => externalPoint() ?? hoveredPoint);
    const hoveredX = derived(() => displayedPoint() ? x(displayedPoint().distance) : 0);
    const hoveredY = derived(() => displayedPoint() ? y2(displayedPoint().altitude) : 0);
    const tooltipX = derived(() => hoveredX() + 170 > width - padding.right ? Math.max(hoveredX() - 170 - 12, padding.left + 8) : Math.min(hoveredX() + 12, 650));
    const tooltipY = derived(() => Math.max(hoveredY() - 84, padding.top + 8));
    const previousPoint = derived(() => displayedPoint() && validPoints().length > 1 ? validPoints()[Math.max(validPoints().indexOf(displayedPoint()) - 1, 0)] : null);
    const pointPace = derived(() => displayedPoint() && previousPoint() && displayedPoint().distance > previousPoint().distance && displayedPoint().time > previousPoint().time ? (displayedPoint().time - previousPoint().time) / ((displayedPoint().distance - previousPoint().distance) / 1e3) : null);
    const paceText = /* @__PURE__ */ __name((seconds) => {
      if (seconds == null || !Number.isFinite(seconds)) return "\u2014";
      return `${Math.floor(seconds / 60)}:${Math.round(seconds % 60).toString().padStart(2, "0")} /km`;
    }, "paceText");
    $$renderer2.push(`<section class="activity-profile"${attr("aria-label", t2("elevation_profile"))}>`);
    if (validPoints().length > 1) {
      $$renderer2.push(`<!--[0--><svg${attr("viewBox", `0 0 ${width} ${height}`)} role="img"${attr("aria-label", t2("elevation_by_distance"))}><defs><linearGradient id="profile-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#8bae94" stop-opacity="0.48"></stop><stop offset="1" stop-color="#e5f2e8" stop-opacity="0.1"></stop></linearGradient></defs><!--[-->`);
      const each_array = ensure_array_like(ticks());
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let tick3 = each_array[$$index];
        $$renderer2.push(`<line class="profile-grid"${attr("x1", padding.left)}${attr("x2", width - padding.right)}${attr("y1", y2(tick3))}${attr("y2", y2(tick3))}></line><text class="profile-axis"${attr("x", padding.left - 9)}${attr("y", y2(tick3) + 4)} text-anchor="end">${escape_html(tick3)} m</text>`);
      }
      $$renderer2.push(`<!--]--><!--[-->`);
      const each_array_1 = ensure_array_like(kilometerLines());
      for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
        let line = each_array_1[$$index_1];
        $$renderer2.push(`<line class="profile-kilometer-grid"${attr("x1", x(line.distance))}${attr("x2", x(line.distance))}${attr("y1", padding.top)}${attr("y2", padding.top + chartHeight)}></line><text class="profile-kilometer-label"${attr("x", x(line.distance))}${attr("y", 242)} text-anchor="middle">${escape_html(line.kilometer)}</text>`);
      }
      $$renderer2.push(`<!--]-->`);
      if (selectionStart() && selectionEnd()) $$renderer2.push(`<!--[0--><rect class="profile-selection"${attr("x", x(selectionStart().distance))}${attr("y", padding.top)}${attr("width", Math.max(x(selectionEnd().distance) - x(selectionStart().distance), 3))}${attr("height", chartHeight)}></rect>`);
      else $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<!--]--><path class="profile-area"${attr("d", areaPath())}></path><path class="profile-line"${attr("d", profilePath())}></path>`);
      if (selectionStart() && selectionEnd()) $$renderer2.push(`<!--[0--><path class="profile-selected-line"${attr("d", selectedPoints().map((point, index23) => `${index23 === 0 ? "M" : "L"} ${x(point.distance)} ${y2(point.altitude)}`).join(" "))}></path>`);
      else $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<!--]-->`);
      if (displayedPoint()) {
        $$renderer2.push(`<!--[0--><line class="profile-hover-line"${attr("x1", hoveredX())}${attr("x2", hoveredX())}${attr("y1", padding.top)}${attr("y2", padding.top + chartHeight)}></line><circle class="profile-hover-point"${attr("cx", hoveredX())}${attr("cy", hoveredY())} r="5"></circle><g class="profile-tooltip"${attr("transform", `translate(${tooltipX()} ${tooltipY()})`)}><rect width="158"${attr("height", displayedPoint().heartRate == null ? 73 : 91)} rx="3"></rect><text x="10" y="19"><tspan class="profile-tooltip-label">${escape_html(t2("dist_label"))}</tspan><tspan class="profile-tooltip-value">${escape_html((displayedPoint().distance / 1e3).toFixed(2))} km</tspan></text><text x="10" y="37"><tspan class="profile-tooltip-label">${escape_html(t2("elev_label"))}</tspan><tspan class="profile-tooltip-value">${escape_html(Math.round(displayedPoint().altitude))} m</tspan></text><text x="10" y="55"><tspan class="profile-tooltip-label">${escape_html(t2("pace_label"))}</tspan><tspan class="profile-tooltip-value">${escape_html(paceText(pointPace()))}</tspan></text>`);
        if (displayedPoint().heartRate != null) $$renderer2.push(`<!--[0--><text x="10" y="73"><tspan class="profile-tooltip-label">${escape_html(t2("heart_rate_short_label"))}</tspan><tspan class="profile-tooltip-value">${escape_html(displayedPoint().heartRate)} bpm</tspan></text>`);
        else $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<!--]--></g>`);
      } else $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<!--]--><line class="profile-axis-line"${attr("x1", padding.left)}${attr("x2", width - padding.right)}${attr("y1", padding.top + chartHeight)}${attr("y2", padding.top + chartHeight)}></line><text class="profile-distance-label"${attr("x", padding.left)}${attr("y", 242)}>0 km</text></svg>`);
    } else $$renderer2.push(`<!--[-1--><div class="activity-profile-empty">No elevation samples available for this activity.</div>`);
    $$renderer2.push(`<!--]--></section>`);
  });
}
function ActivityComments($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { activity, viewerId, eventsUrl, viewerName = "You", viewerAvatarUrl } = $$props;
    let body = "";
    $$renderer2.push(`<section id="comments" class="activity-comments"${attr("aria-label", t2("comments"))}>`);
    $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--> `);
    $$renderer2.push(`<!--[0--><p class="muted-copy">${escape_html(t2("loading_comments"))}</p>`);
    $$renderer2.push(`<!--]--> <div class="comment-composer">`);
    UserAvatar($$renderer2, {
      name: viewerName,
      src: viewerAvatarUrl,
      size: 44
    });
    $$renderer2.push(`<!----> <form class="comment-form"><input${attr("value", body)} maxlength="2000"${attr("placeholder", t2("add_a_comment"))}${attr("aria-label", t2("comment"))}/> <button type="submit"${attr("disabled", !body.trim(), true)}${attr("aria-label", t2("send_comment"))}${attr("title", t2("send_comment"))}>`);
    Send($$renderer2, { size: 16 });
    $$renderer2.push(`<!----></button></form></div></section>`);
  });
}
function ImageLightbox($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { images, initialIndex, onClose } = $$props;
    let currentIndex = 0;
    const image = derived(() => images[currentIndex]);
    const imageUrl = derived(() => image()?.original ?? image()?.preview ?? image()?.thumbnail);
    if (imageUrl()) {
      $$renderer2.push(`<!--[0--><div class="image-lightbox" role="dialog" aria-modal="true" tabindex="-1"${attr("aria-label", image()?.caption ?? t2("activity_image"))}><div class="image-lightbox-content">`);
      if (images.length > 1) {
        $$renderer2.push(`<!--[0--><button class="image-lightbox-nav image-lightbox-prev" type="button"${attr("aria-label", t2("previous_image"))}>`);
        Chevron_left($$renderer2, { size: 28 });
        $$renderer2.push(`<!----></button>`);
      } else $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<!--]--> <button class="image-lightbox-close" type="button"${attr("aria-label", t2("close_image_viewer"))}>`);
      X($$renderer2, { size: 22 });
      $$renderer2.push(`<!----></button> `);
      if (images.length > 1) {
        $$renderer2.push(`<!--[0--><button class="image-lightbox-nav image-lightbox-next" type="button"${attr("aria-label", t2("next_image"))}>`);
        Chevron_right($$renderer2, { size: 28 });
        $$renderer2.push(`<!----></button>`);
      } else $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<!--]--> <img${attr("src", imageUrl())}${attr("alt", image()?.caption ?? t2("activity_photo"))}${attr("width", image()?.width ?? void 0)}${attr("height", image()?.height ?? void 0)}/> `);
      if (images.length > 1) $$renderer2.push(`<!--[0--><span class="image-lightbox-counter">${escape_html(1)} / ${escape_html(images.length)}</span>`);
      else $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<!--]--> `);
      if (image()?.caption) $$renderer2.push(`<!--[0--><p>${escape_html(image().caption)}</p>`);
      else $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<!--]--></div></div>`);
    } else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]-->`);
  });
}
function canEditActivity(activityUserId, viewerId) {
  return Boolean(activityUserId && viewerId && activityUserId === viewerId);
}
function _page2($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    const activity = derived(() => ({ ...data.activity }));
    let likersHovered = false;
    const likersVisible = derived(() => likersHovered);
    const canEditCurrentActivity = derived(() => canEditActivity(activity().userId, data.user?.id));
    const tagLabels = {
      race: "Race",
      long_run: "Long Run",
      commute: "Commute",
      workout: "Workout",
      competition: "Competition",
      recovery: "Recovery",
      with_pet: "With Pet",
      with_kid: "With Kid",
      for_a_cause: "For a Cause"
    };
    derived(() => Object.keys(tagLabels).filter((tag) => tag !== "long_run" || [
      "run",
      "trail_run",
      "virtual_run"
    ].includes(draftSport)));
    derived(() => activityTypeOptions(data.activityTypes));
    let draftSport = ActivityType_Output.Other;
    const Icon2 = derived(() => sportIcon(activity().sport));
    const excludedFromRankings = derived(() => activity().excludeFromRankings);
    const activitySettings = derived(() => activityTypeSettings(data.activityTypes, activity().sport));
    const averageMetric = derived(() => activitySettings().averageMetric);
    const mapStyle = derived(() => activitySettings().mapStyle);
    const isCyclingEffort = derived(() => [
      "ride",
      "gravel_ride",
      "mountain_bike_ride",
      "virtual_ride",
      "e_bike_ride",
      "e_mountain_bike_ride"
    ].includes(activity().sport));
    const hasBestEffortAchievements = derived(() => !excludedFromRankings() && (activity().bestEfforts?.some((effort) => bestEffortAchievement(effort) !== null) ?? false));
    const hasHeartRate = derived(() => activity().metrics?.avgHr != null);
    const hasElevation = derived(() => activity().metrics?.elevationGain != null || activity().metrics?.elevationLoss != null);
    const hasGpsRoute = derived(() => (activity().track?.coordinates.length ?? 0) > 0);
    const hasBestEffortHeartRate = derived(() => activity().bestEfforts?.some((effort) => effort.avgHr != null) ?? false);
    const distanceBestEfforts = derived(() => activity().bestEfforts?.filter((effort) => !effort.type.startsWith("power_")) ?? []);
    const powerBestEfforts = derived(() => activity().bestEfforts?.filter((effort) => effort.type.startsWith("power_")) ?? []);
    const mapMedals = derived(() => excludedFromRankings() ? [] : (activity().bestEfforts ?? []).filter((effort) => effort.overallRank >= 1 && effort.overallRank <= 3).flatMap((effort) => {
      const achievement = bestEffortAchievement(effort);
      return achievement && achievement.rank === effort.overallRank ? [{
        type: effort.type,
        rank: effort.overallRank,
        endTime: effort.endTime,
        distance: effort.distance,
        isPower: effort.type.startsWith("power_"),
        label: effort.type === "biggest_climb" || effort.type === "elevation_gain" || effort.type === "longest_ride" ? bestEffortLabel(effort.type) : effort.type.startsWith("power_") ? `Best power - ${bestEffortLabel(effort.type).replace(" power", "")}` : `${effort.overallRank === 1 ? "Fastest" : effort.overallRank === 2 ? "2nd fastest" : "3rd fastest"} ${bestEffortLabel(effort.type)}`
      }] : [];
    }));
    const hasActivityAnalysis = derived(() => activity().analysis !== null);
    const hasSplitHeartRate = derived(() => activity().analysis?.splits.some((split) => split.avgHr != null) ?? false);
    let highlightedRange = null;
    let graphPointTime = null;
    let imagePage = 0;
    const viewableImages = derived(() => activity().images.filter((image) => image.preview || image.original || image.thumbnail));
    let selectedImageIndex = null;
    const imagePageCount = derived(() => viewableImages().length);
    const averageMetricStats = derived(() => averageMetric() === AverageMetric.None ? [] : averageMetric() === AverageMetric.Speed ? [{
      label: t2("average_speed"),
      value: speed(activity().metrics?.avgSpeed ?? null, data.unitSystem),
      icon: Gauge
    }] : [{
      label: t2("pace"),
      value: pace(activity().metrics?.avgSpeed ?? (activity().metrics?.distance != null ? activity().metrics.distance / (activity().metrics.movingTime ?? activity().metrics.elapsedTime) : null), data.unitSystem, averageMetric() === AverageMetric.SwimPace),
      icon: Gauge
    }]);
    const stats = derived(() => [
      {
        label: t2("distance"),
        value: distance(activity().metrics?.distance ?? null, data.unitSystem),
        icon: Gauge
      },
      {
        label: "Moving time",
        value: activity().metrics ? duration(activity().metrics.movingTime ?? activity().metrics.elapsedTime) : "\u2014",
        icon: Timer
      },
      {
        label: "Elapsed time",
        value: activity().metrics ? duration(activity().metrics.elapsedTime) : "\u2014",
        icon: Clock_3
      },
      ...hasElevation() ? [{
        label: t2("elevation_gain"),
        value: elevation(activity().metrics?.elevationGain ?? null, data.unitSystem),
        icon: Mountain
      }] : [],
      ...averageMetricStats(),
      ...hasHeartRate() ? [{
        label: t2("average_heart_rate"),
        value: `${activity().metrics?.avgHr} bpm`,
        icon: Heart_pulse
      }] : [],
      ...activitySettings().showAveragePower ? [{
        label: t2("average_power"),
        value: activity().metrics?.avgPower == null ? "\u2014" : `${activity().metrics.avgPower} W`,
        icon: Zap
      }] : [],
      {
        label: t2("energy"),
        value: activity().metrics?.calories == null ? "\u2014" : `${activity().metrics.calories} kcal`,
        icon: Flame
      }
    ]);
    function rankOrdinal(rank) {
      return rank === 2 ? "2nd" : "3rd";
    }
    __name(rankOrdinal, "rankOrdinal");
    function bestEffortAchievement(effort) {
      bestEffortRecordName(effort.type);
      if (effort.overallRank === 1) return {
        rank: 1,
        text: t2("new_best_all_time")
      };
      if (effort.overallRank <= 3) return {
        rank: effort.overallRank,
        text: t2("new_ranked_best_all_time", { rank: rankOrdinal(effort.overallRank) })
      };
      if (effort.yearRank === 1) return {
        rank: 1,
        text: t2("new_best_year", { year: effort.year })
      };
      if (effort.yearRank <= 3) return {
        rank: effort.yearRank,
        text: t2("new_ranked_best_year", {
          rank: rankOrdinal(effort.yearRank),
          year: effort.year
        })
      };
      return null;
    }
    __name(bestEffortAchievement, "bestEffortAchievement");
    function highlightGraphPoint(point) {
      if (!point) {
        graphPointTime = null;
        return;
      }
      graphPointTime = point.time;
    }
    __name(highlightGraphPoint, "highlightGraphPoint");
    function splitRate(distanceMeters, elapsedTime) {
      return isCyclingEffort() ? speed(distanceMeters / elapsedTime, data.unitSystem) : pace(distanceMeters / elapsedTime, data.unitSystem).replace(" min/", " /");
    }
    __name(splitRate, "splitRate");
    const mapHighlight = derived(() => graphPointTime !== null ? {
      startTime: 0,
      endTime: 0,
      label: "",
      pointTime: graphPointTime ?? void 0
    } : null);
    head("1vb1e6", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>${escape_html(activityName(activity()))} \xB7 Kondis</title>`);
      });
    });
    $$renderer2.push(`<div class="detail-page"><header class="detail-header"><a class="back-link" href="/" data-sveltekit-preload-data="hover">`);
    Arrow_left($$renderer2, { size: 18 });
    $$renderer2.push(`<!----> ${escape_html(t2("all_activities"))}</a> <div class="detail-heading">`);
    UserAvatar($$renderer2, {
      name: activity().athlete ? userDisplayName(activity().athlete) : "You",
      src: activity().athlete?.avatarUrl,
      size: 54
    });
    $$renderer2.push(`<!----> <div class="detail-title"><h1>${escape_html(activityName(activity()))}</h1> <p class="detail-timestamp">${escape_html(localDate(activity().startedAt))} \xB7 ${escape_html(localTime(activity().startedAt))} <span${attr_class("activity-sport-inline", void 0, { "running-sport": [
      "run",
      "trail_run",
      "virtual_run"
    ].includes(activity().sport) })}${attr("aria-label", activityTypeLabel(data.activityTypes, activity().sport))}>`);
    if (Icon2()) {
      $$renderer2.push("<!--[-->");
      Icon2()($$renderer2, { size: 17 });
      $$renderer2.push("<!--]-->");
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push("<!--]-->");
    }
    $$renderer2.push(`</span></p></div> `);
    if (canEditCurrentActivity()) {
      $$renderer2.push(`<!--[0--><button class="edit-metadata-button" type="button"${attr("aria-label", t2("edit_activity_metadata"))}>`);
      Pencil($$renderer2, { size: 16 });
      $$renderer2.push(`<!----> ${escape_html(t2("edit"))}</button>`);
    } else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--> <div class="detail-likes" role="group"${attr("aria-label", t2("activity_likes"))}><button type="button"${attr("aria-expanded", likersVisible())}${attr("aria-label", t2("show_people_who_liked"))}>`);
    Heart($$renderer2, {
      size: 16,
      fill: "currentColor"
    });
    $$renderer2.push(`<!----> ${escape_html(activity().likeCount ?? 0)}</button> `);
    if (likersVisible()) {
      $$renderer2.push(`<!--[0--><div class="detail-likers-popover" role="tooltip"><strong>${escape_html(t2("likes_label"))}</strong> `);
      $$renderer2.push(`<!--[-1--><span>${escape_html(t2("no_likes_yet"))}</span>`);
      $$renderer2.push(`<!--]--></div>`);
    } else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--></div></div> `);
    $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--> `);
    if (activity().tags?.length) {
      $$renderer2.push(`<!--[0--><div class="activity-tags"${attr("aria-label", t2("activity_tags"))}><!--[-->`);
      const each_array_3 = ensure_array_like(activity().tags);
      for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
        let tag = each_array_3[$$index_3];
        $$renderer2.push(`<span class="activity-tag">${escape_html(tagLabels[tag])}</span>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    } else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--> `);
    if (activity().description) $$renderer2.push(`<!--[0--><p class="activity-description">${escape_html(activity().description)}</p>`);
    else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--></header> `);
    if (viewableImages().length > 0) {
      $$renderer2.push(`<!--[0--><section${attr_class("activity-image-carousel", void 0, { "activity-image-carousel-locked": selectedImageIndex !== null })}${attr("inert", selectedImageIndex !== null, true)}${attr("aria-label", t2("activity_photos"))}><div class="activity-visual-carousel-track" role="region"${attr("aria-label", t2("swipeable_activity_photos"))}><!--[-->`);
      const each_array_4 = ensure_array_like(viewableImages());
      for (let imageIndex = 0, $$length = each_array_4.length; imageIndex < $$length; imageIndex++) {
        let image = each_array_4[imageIndex];
        $$renderer2.push(`<div class="activity-visual-slide activity-photo-slide"><figure><button type="button" class="activity-photo-open"${attr("aria-label", image.caption ?? t2("open_activity_photos"))}><img${attr("src", image.preview ?? image.thumbnail ?? image.original)}${attr("alt", image.caption ?? t2("activity_photo"))}/></button> `);
        if (image.caption) $$renderer2.push(`<!--[0--><figcaption>${escape_html(image.caption)}</figcaption>`);
        else $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<!--]--></figure></div>`);
      }
      $$renderer2.push(`<!--]--></div> `);
      if (imagePageCount() > 1) {
        $$renderer2.push(`<!--[0--><div class="activity-visual-controls"${attr("aria-label", t2("photo_carousel_controls"))}><button type="button"${attr("aria-label", t2("previous_image"))}${attr("disabled", true, true)}>`);
        Chevron_left($$renderer2, { size: 17 });
        $$renderer2.push(`<!----></button> <span aria-live="polite">${escape_html(1)} / ${escape_html(imagePageCount())}</span> <button type="button"${attr("aria-label", t2("next_image"))}${attr("disabled", imagePage === imagePageCount() - 1, true)}>`);
        Chevron_right($$renderer2, { size: 17 });
        $$renderer2.push(`<!----></button></div>`);
      } else $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<!--]--></section>`);
    } else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--> `);
    if (hasGpsRoute()) {
      $$renderer2.push(`<!--[0--><div${attr_class("", void 0, { "activity-visuals": !isCyclingEffort() && hasActivityAnalysis() && (activity().analysis?.splits.length ?? 0) > 0 })}>`);
      if (!isCyclingEffort() && hasActivityAnalysis() && activity().analysis && activity().analysis.splits.length > 0) {
        $$renderer2.push(`<!--[0--><section class="splits-section splits-section-visual"><div class="split-table-wrap"><div class="split-table" role="table"${attr("aria-label", t2("activity_kilometre_splits"))}><div${attr_class("split-header", void 0, { "no-heart-rate": !hasSplitHeartRate() })} role="row"><div role="columnheader"><strong>${escape_html(t2("kilometre_abbreviation"))}</strong></div> <div role="columnheader"><strong>${escape_html(isCyclingEffort() ? t2("speed") : t2("pace"))}</strong></div> `);
        if (hasSplitHeartRate()) $$renderer2.push(`<!--[0--><div role="columnheader"><strong>${escape_html(t2("heart_rate_short_label"))}</strong></div>`);
        else $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<!--]--> <div role="columnheader"><strong>${escape_html(t2("elevation_short"))}</strong></div></div> <!--[-->`);
        const each_array_5 = ensure_array_like(activity().analysis.splits);
        for (let index23 = 0, $$length = each_array_5.length; index23 < $$length; index23++) {
          let split = each_array_5[index23];
          const splitLabel = index23 === activity().analysis.splits.length - 1 && split.distance < 995 ? (split.distance / 1e3).toFixed(2) : `${index23 + 1}`;
          $$renderer2.push(`<div${attr_class("split-row", void 0, {
            "no-heart-rate": !hasSplitHeartRate(),
            "highlighted": void 0 === split.startTime && void 0 === split.endTime
          })} role="row" tabindex="0"><div role="cell"><strong>${escape_html(splitLabel)}</strong></div> <div role="cell">${escape_html(splitRate(split.distance, split.elapsedTime))}</div> `);
          if (hasSplitHeartRate()) $$renderer2.push(`<!--[0--><div role="cell">${escape_html(split.avgHr == null ? "\u2014" : `${split.avgHr}`)}</div>`);
          else $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<!--]--> <div role="cell">${escape_html(elevation(split.elevationChange, data.unitSystem))}</div></div>`);
        }
        $$renderer2.push(`<!--]--></div></div></section>`);
      } else $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<!--]--> <section class="activity-map-section"${attr("aria-label", t2("activity_route_map"))}><section class="map-panel"><!---->`);
      RouteMap($$renderer2, {
        coordinates: activity().track?.coordinates ?? null,
        mode: mapStyle(),
        route: activity().analysis?.route ?? [],
        medals: mapMedals(),
        highlight: mapHighlight(),
        onPointHover: highlightGraphPoint
      });
      $$renderer2.push(`<!----> `);
      if (activity().track && mapStyle() === ActivityMapStyle.Route) $$renderer2.push(`<!--[0--><div class="map-key"><span><i class="start-dot"></i> ${escape_html(t2("start"))}</span><span><i class="finish-dot"></i> ${escape_html(t2("finish"))}</span></div>`);
      else $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<!--]--></section></section> `);
      if (hasGpsRoute() && hasActivityAnalysis()) {
        $$renderer2.push("<!--[0-->");
        ActivityProfile($$renderer2, {
          points: activity().analysis?.profile ?? [],
          selection: highlightedRange,
          pointTime: graphPointTime,
          onPointHover: highlightGraphPoint
        });
      } else $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<!--]--></div>`);
    } else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--> `);
    if (!isCyclingEffort() && !hasGpsRoute() && hasActivityAnalysis() && activity().analysis && activity().analysis.splits.length > 0) {
      $$renderer2.push(`<!--[0--><section class="splits-section"><div class="split-table-wrap"><div class="split-table" role="table"${attr("aria-label", t2("activity_kilometre_splits"))}><div${attr_class("split-header", void 0, { "no-heart-rate": !hasSplitHeartRate() })} role="row"><div role="columnheader"><strong>${escape_html(t2("kilometre_abbreviation"))}</strong></div> <div role="columnheader"><strong>${escape_html(isCyclingEffort() ? t2("speed") : t2("pace"))}</strong></div> `);
      if (hasSplitHeartRate()) $$renderer2.push(`<!--[0--><div role="columnheader"><strong>${escape_html(t2("heart_rate"))}</strong></div>`);
      else $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<!--]--> <div role="columnheader"><strong>${escape_html(t2("elevation_short"))}</strong></div></div> <!--[-->`);
      const each_array_6 = ensure_array_like(activity().analysis.splits);
      for (let index23 = 0, $$length = each_array_6.length; index23 < $$length; index23++) {
        let split = each_array_6[index23];
        const splitLabel = index23 === activity().analysis.splits.length - 1 && split.distance < 995 ? (split.distance / 1e3).toFixed(2) : `${index23 + 1}`;
        $$renderer2.push(`<div${attr_class("split-row", void 0, {
          "no-heart-rate": !hasSplitHeartRate(),
          "highlighted": void 0 === split.startTime && void 0 === split.endTime
        })} role="row" tabindex="0"><div role="cell"><strong>${escape_html(splitLabel)}</strong></div> <div role="cell">${escape_html(splitRate(split.distance, split.elapsedTime))}</div> `);
        if (hasSplitHeartRate()) $$renderer2.push(`<!--[0--><div role="cell">${escape_html(split.avgHr == null ? "\u2014" : `${split.avgHr} bpm`)}</div>`);
        else $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<!--]--> <div role="cell">${escape_html(elevation(split.elevationChange, data.unitSystem))}</div></div>`);
      }
      $$renderer2.push(`<!--]--></div></div></section>`);
    } else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--> `);
    if (activity().matchedRouteCount !== null && activity().matchedRouteCount > 1) {
      $$renderer2.push(`<!--[0--><section class="route-match-summary"><div class="route-match-summary-icon">`);
      Map_pinned($$renderer2, { size: 23 });
      $$renderer2.push(`<!----></div> <div><span class="eyebrow">${escape_html(t2("repeated_route"))}</span> <h2>${escape_html(activity().matchedRouteCount)}
          ${escape_html(activity().matchedRouteCount === 1 ? t2("activity") : t2("activities"))} on
          this route</h2> <p>${escape_html(t2("compare_matched_efforts"))}</p></div> <a${attr("href", `/activities/${activity().id}/matched-routes`)}>${escape_html(t2("view_matched", { activities: isCyclingEffort() ? t2("matched_rides") : t2("matched_runs") }))} `);
      Chevron_right($$renderer2, { size: 17 });
      $$renderer2.push(`<!----></a></section>`);
    } else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--> <section class="metrics-section"><div class="metric-grid"><!--[-->`);
    const each_array_7 = ensure_array_like(stats());
    for (let $$index_7 = 0, $$length = each_array_7.length; $$index_7 < $$length; $$index_7++) {
      let stat = each_array_7[$$index_7];
      $$renderer2.push(`<article class="metric"><span>`);
      if (stat.icon) {
        $$renderer2.push("<!--[-->");
        stat.icon($$renderer2, { size: 19 });
        $$renderer2.push("<!--]-->");
      } else {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push("<!--]-->");
      }
      $$renderer2.push(`</span> <div><small>${escape_html(stat.label)}</small><strong>${escape_html(stat.value)}</strong></div></article>`);
    }
    $$renderer2.push(`<!--]--></div></section> `);
    if (activity().bestEfforts && activity().bestEfforts.length > 0) {
      $$renderer2.push(`<!--[0--><section class="best-efforts-section"><div class="section-heading"><div><span class="eyebrow">${escape_html(isCyclingEffort() ? t2("cycling") : t2("running"))}
            ${escape_html(t2("performance"))}</span> <h2>${escape_html(t2("best_efforts"))}</h2> `);
      if (excludedFromRankings()) $$renderer2.push(`<!--[0--><p class="best-efforts-excluded-note">${escape_html(t2("excluded_from_rankings_note"))}</p>`);
      else $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<!--]--></div></div> `);
      if (distanceBestEfforts().length > 0) {
        $$renderer2.push(`<!--[0--><div class="best-effort-table-wrap"><div class="best-effort-table" role="table"${attr("aria-label", t2("distance_best_efforts"))}><div${attr_class("best-effort-header", void 0, { "no-heart-rate": !hasBestEffortHeartRate() })} role="row"><div role="columnheader"><strong>${escape_html(t2("distance"))}</strong></div> <div role="columnheader"><strong>${escape_html(t2("time"))}</strong></div> <div role="columnheader"><strong>${escape_html(isCyclingEffort() ? t2("speed") : t2("pace"))}</strong></div> `);
        if (hasBestEffortHeartRate()) $$renderer2.push(`<!--[0--><div role="columnheader"><strong>${escape_html(t2("heart_rate"))}</strong></div>`);
        else $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<!--]--> <div role="columnheader"><strong>${escape_html(t2("elevation_short"))}</strong></div></div> <!--[-->`);
        const each_array_8 = ensure_array_like(distanceBestEfforts());
        for (let $$index_8 = 0, $$length = each_array_8.length; $$index_8 < $$length; $$index_8++) {
          let effort = each_array_8[$$index_8];
          const achievement = excludedFromRankings() ? null : bestEffortAchievement(effort);
          $$renderer2.push(`<a${attr_class("best-effort-row", void 0, {
            "no-heart-rate": !hasBestEffortHeartRate(),
            "highlighted": void 0 === effort.startTime && void 0 === effort.endTime
          })} role="row"${attr("href", `/best-efforts/${isCyclingEffort() ? "ride" : "run"}/${effort.type}`)}${attr("aria-label", `${bestEffortLabel(effort.type)}${achievement ? `. ${achievement.text}` : ""}. ${t2("view_best_effort_history")}`)}><div class="effort-distance" role="cell">`);
          if (achievement) {
            $$renderer2.push(`<!--[0--><span${attr_class(`effort-medal achievement-rank-${achievement.rank}`)} aria-hidden="true">`);
            Medal($$renderer2, { size: 31 });
            $$renderer2.push(`<!----> <small>${escape_html(achievement.rank === 1 ? "PR" : achievement.rank)}</small></span>`);
          } else if (hasBestEffortAchievements()) $$renderer2.push(`<!--[1--><span class="effort-medal-placeholder" aria-hidden="true"></span>`);
          else $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<!--]--> <span class="effort-distance-copy"><strong>${escape_html(bestEffortLabel(effort.type))}</strong> `);
          if (achievement) $$renderer2.push(`<!--[0--><small>${escape_html(achievement.text)}</small>`);
          else $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<!--]--></span></div> <div role="cell">${escape_html(effortDuration(effort.elapsedTime))}</div> <div role="cell">${escape_html(isCyclingEffort() ? speed(effort.distance / effort.elapsedTime, data.unitSystem) : pace(effort.distance / effort.elapsedTime, data.unitSystem))}</div> `);
          if (hasBestEffortHeartRate()) $$renderer2.push(`<!--[0--><div role="cell">${escape_html(effort.avgHr == null ? "\u2014" : `${effort.avgHr} bpm`)}</div>`);
          else $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<!--]--> <div role="cell">${escape_html(elevation(effort.elevationChange, data.unitSystem))}</div></a>`);
        }
        $$renderer2.push(`<!--]--></div></div>`);
      } else $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<!--]--> `);
      if (powerBestEfforts().length > 0) {
        $$renderer2.push(`<!--[0--><div class="best-effort-table-wrap"><div class="best-effort-table power-best-effort-table" role="table"${attr("aria-label", t2("power_best_efforts"))}><div class="best-effort-header" role="row"><div role="columnheader"></div> <div role="columnheader"><strong>${escape_html(t2("time"))}</strong></div> <div role="columnheader"><strong>${escape_html(t2("power"))}</strong></div> <div role="columnheader"><strong>${escape_html(t2("elevation_short"))}</strong></div></div> <!--[-->`);
        const each_array_9 = ensure_array_like(powerBestEfforts());
        for (let $$index_9 = 0, $$length = each_array_9.length; $$index_9 < $$length; $$index_9++) {
          let effort = each_array_9[$$index_9];
          const achievement = excludedFromRankings() ? null : bestEffortAchievement(effort);
          $$renderer2.push(`<a class="best-effort-row" role="row"${attr("href", `/best-efforts/ride/${effort.type}`)}${attr("aria-label", `${bestEffortLabel(effort.type)}${achievement ? `. ${achievement.text}` : ""}. ${t2("view_best_effort_history")}`)}><div class="effort-distance" role="cell">`);
          if (achievement) {
            $$renderer2.push(`<!--[0--><span${attr_class(`effort-medal achievement-rank-${achievement.rank}`)} aria-hidden="true">`);
            Medal($$renderer2, { size: 31 });
            $$renderer2.push(`<!----><small>${escape_html(achievement.rank === 1 ? "PR" : achievement.rank)}</small></span>`);
          } else $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<!--]--></div> <div role="cell">${escape_html(bestEffortLabel(effort.type).replace(" power", ""))}</div> <div role="cell">${escape_html(Math.round(effort.value))} W</div> <div role="cell">${escape_html(elevation(effort.elevationChange, data.unitSystem))}</div></a>`);
        }
        $$renderer2.push(`<!--]--></div></div>`);
      } else $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<!--]--></section>`);
    } else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--></div> `);
    if (selectedImageIndex !== null) {
      $$renderer2.push("<!--[0-->");
      ImageLightbox($$renderer2, {
        images: viewableImages(),
        initialIndex: selectedImageIndex,
        onClose: /* @__PURE__ */ __name(() => selectedImageIndex = null, "onClose")
      });
    } else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--> `);
    ActivityComments($$renderer2, {
      activity: activity(),
      eventsUrl: data.eventsUrl,
      viewerId: data.user?.id,
      viewerName: data.user ? userDisplayName(data.user) : "You",
      viewerAvatarUrl: data.user?.avatarUrl
    });
    $$renderer2.push(`<!---->`);
  });
}
var init_page_svelte2 = __esm({
  ".svelte-kit/output/server/entries/pages/activities/_id_/_page.svelte.js"() {
    init_index_server();
    init_server();
    init_navigation();
    init_Icon();
    init_arrow_left();
    init_activity_types();
    init_chevron_left();
    init_chevron_right();
    init_clock_3();
    init_trash_2();
    init_RouteMap();
    init_map_pinned();
    init_medal();
    init_timer();
    init_state();
    init_i18n();
    init_user_name();
    init_build();
    init_api2();
    init_format();
    init_realtime();
    init_best_efforts();
    __name(Flame, "Flame");
    __name(Pencil, "Pencil");
    __name(Send, "Send");
    __name(X, "X");
    __name(Zap, "Zap");
    __name(ActivityProfile, "ActivityProfile");
    __name(ActivityComments, "ActivityComments");
    __name(ImageLightbox, "ImageLightbox");
    __name(canEditActivity, "canEditActivity");
    __name(_page2, "_page");
  }
});

// .svelte-kit/output/server/nodes/3.js
var __exports4 = {};
__export(__exports4, {
  component: () => component4,
  fonts: () => fonts4,
  imports: () => imports4,
  index: () => index4,
  server: () => page_server_ts_exports2,
  server_id: () => server_id3,
  stylesheets: () => stylesheets4
});
var index4, component_cache4, component4, server_id3, imports4, stylesheets4, fonts4;
var init__4 = __esm({
  ".svelte-kit/output/server/nodes/3.js"() {
    init_page_server_ts2();
    index4 = 3;
    component4 = /* @__PURE__ */ __name(async () => component_cache4 ??= (await Promise.resolve().then(() => (init_page_svelte2(), page_svelte_exports2))).default, "component");
    server_id3 = "src/routes/activities/[id]/+page.server.ts";
    imports4 = ["_app/immutable/nodes/3.B8ai8WW2.js", "_app/immutable/chunks/TqmLiPd2.js", "_app/immutable/chunks/B90Er9NH.js", "_app/immutable/chunks/xihTtKlq.js", "_app/immutable/chunks/LlbaMzKX.js", "_app/immutable/chunks/D5mC9s7c.js", "_app/immutable/chunks/Cb18XCVn.js", "_app/immutable/chunks/N8DLpoKl.js", "_app/immutable/chunks/BNBsMhO5.js", "_app/immutable/chunks/BBC-ssYl.js", "_app/immutable/chunks/DYHuczPH.js", "_app/immutable/chunks/DL8_u9na.js", "_app/immutable/chunks/Cn48AJiV.js", "_app/immutable/chunks/CiGyI8Qn.js", "_app/immutable/chunks/jeJNHXOu.js", "_app/immutable/chunks/HclGiUj8.js", "_app/immutable/chunks/COo21xW_.js", "_app/immutable/chunks/B_Z5EwsC.js", "_app/immutable/chunks/BNDfWvQn.js", "_app/immutable/chunks/Dqafu7wB.js", "_app/immutable/chunks/CBfwGKJV.js", "_app/immutable/chunks/DnWgfvLw.js", "_app/immutable/chunks/CL7EZexq.js", "_app/immutable/chunks/CAMS0kRz.js", "_app/immutable/chunks/B4Kzzj8V.js", "_app/immutable/chunks/CtcJAU9W.js"];
    stylesheets4 = [];
    fonts4 = [];
  }
});

// .svelte-kit/output/server/entries/pages/activities/_id_/matched-routes/_page.server.ts.js
var page_server_ts_exports3 = {};
__export(page_server_ts_exports3, {
  load: () => load4
});
var load4;
var init_page_server_ts3 = __esm({
  ".svelte-kit/output/server/entries/pages/activities/_id_/matched-routes/_page.server.ts.js"() {
    init_api();
    init_build();
    init_api2();
    init_exports();
    load4 = /* @__PURE__ */ __name(async ({ locals, params }) => {
      try {
        return { history: await activityControllerListMatchedRoutes({ id: params.id }, getServerSdkRequestOptions(locals.kondisFetch)) };
      } catch (requestError) {
        if (requestError.status === 404) error(404, "Activity not found");
        error(503, "Could not load matched routes");
      }
    }, "load");
  }
});

// .svelte-kit/output/server/entries/pages/activities/_id_/matched-routes/_page.svelte.js
var page_svelte_exports3 = {};
__export(page_svelte_exports3, {
  default: () => _page3
});
function _page3($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    let activeActivityId = null;
    let selectedActivityId = null;
    const history = derived(() => data.history);
    const activities = derived(() => history().activities ?? []);
    const source2 = derived(() => activities().find(({ id }) => id === history().sourceActivityId) ?? activities()[0]);
    const averageMetric = derived(() => source2() ? activityTypeSettings(data.activityTypes, source2().sport).averageMetric : AverageMetric.Pace);
    const isSpeed = derived(() => averageMetric() === AverageMetric.Speed);
    const efforts = derived(() => activities().map((activity) => ({
      ...activity,
      chartValue: isSpeed() ? activity.metrics?.avgSpeed ?? 0 : activity.metrics?.avgSpeed && activity.metrics.avgSpeed > 0 ? 1e3 / activity.metrics.avgSpeed : 0
    })));
    const validValues = derived(() => efforts().map(({ chartValue }) => chartValue).filter((value) => value > 0));
    const average = derived(() => validValues().length > 0 ? validValues().reduce((sum, value) => sum + value, 0) / validValues().length : 0);
    const lower = derived(() => validValues().length > 0 ? Math.min(...validValues()) : 0);
    const upper = derived(() => validValues().length > 0 ? Math.max(...validValues()) : 1);
    const spread = derived(() => Math.max(upper() - lower(), upper() * 0.04, 1));
    const axisTicks = derived(() => Array.from({ length: 5 }, (_, index23) => lower() + (upper() - lower()) * index23 / 4));
    function chartY(value) {
      return isSpeed() ? 250 - (value - lower()) / spread() * 190 : 60 + (value - lower()) / spread() * 190;
    }
    __name(chartY, "chartY");
    const chartPoints = derived(() => efforts().map((effort, index23) => ({
      ...effort,
      x: efforts().length === 1 ? 500 : 64 + index23 / (efforts().length - 1) * 872,
      y: chartY(effort.chartValue)
    })));
    const averageY = derived(() => chartY(average()));
    const linePoints = derived(() => chartPoints().map(({ x, y: y2 }) => `${x},${y2}`).join(" "));
    const trendPoints = derived(() => chartPoints().map((point, index23) => {
      const radius = Math.min(2, Math.floor(chartPoints().length / 2));
      const nearby = efforts().slice(Math.max(0, index23 - radius), Math.min(efforts().length, index23 + radius + 1));
      const value = nearby.reduce((sum, effort) => sum + effort.chartValue, 0) / nearby.length;
      return {
        x: point.x,
        y: chartY(value)
      };
    }));
    const trendPath = derived(() => smoothPath(trendPoints()));
    const fastest = derived(() => validValues().length > 0 ? isSpeed() ? Math.max(...validValues()) : Math.min(...validValues()) : 0);
    const slowest = derived(() => validValues().length > 0 ? isSpeed() ? Math.min(...validValues()) : Math.max(...validValues()) : 0);
    const fastestY = derived(() => chartY(fastest()));
    const slowestY = derived(() => chartY(slowest()));
    const selectedPoint = derived(() => chartPoints().find((point) => point.id === selectedActivityId) ?? null);
    function performance(value) {
      return isSpeed() ? speed(value, data.unitSystem) : pace(value, data.unitSystem);
    }
    __name(performance, "performance");
    function difference(value) {
      if (!value || !average()) return "\u2014";
      if (isSpeed()) {
        const differenceValue2 = value - average();
        const factor = data.unitSystem === "metric" ? 3.6 : 2.236936;
        const unit2 = data.unitSystem === "metric" ? "km/h" : "mph";
        return `${differenceValue2 >= 0 ? "+" : ""}${(differenceValue2 * factor).toFixed(1)} ${unit2}`;
      }
      const differenceValue = Math.round((value - average()) * (data.unitSystem === "metric" ? 1 : 1.609344));
      const unit = data.unitSystem === "metric" ? "km" : "mi";
      return `${differenceValue > 0 ? "+" : ""}${differenceValue}s/${unit}`;
    }
    __name(difference, "difference");
    function displayChartValue(value) {
      return performance(isSpeed() ? value : value > 0 ? 1e3 / value : null);
    }
    __name(displayChartValue, "displayChartValue");
    function axisLabel(value) {
      return performance(isSpeed() ? value : value > 0 ? 1e3 / value : null).replace(" min/", "/");
    }
    __name(axisLabel, "axisLabel");
    function smoothPath(points) {
      if (!points.length) return "";
      if (points.length === 1) return `M ${points[0].x},${points[0].y}`;
      let path = `M ${points[0].x},${points[0].y}`;
      for (let index23 = 1; index23 < points.length; index23 += 1) {
        const previous = points[index23 - 1];
        const point = points[index23];
        const midpointX = (previous.x + point.x) / 2;
        const midpointY = (previous.y + point.y) / 2;
        path += ` Q ${previous.x},${previous.y} ${midpointX},${midpointY}`;
        if (index23 === points.length - 1) path += ` Q ${point.x},${point.y} ${point.x},${point.y}`;
      }
      return path;
    }
    __name(smoothPath, "smoothPath");
    function tooltipX(x) {
      return Math.min(Math.max(x - 95, 48), 760);
    }
    __name(tooltipX, "tooltipX");
    head("1psjwvo", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>${escape_html(t2("matched_routes"))} \xB7 Kondis</title>`);
      });
    });
    $$renderer2.push(`<div class="page-shell matched-routes-page"><a class="back-link"${attr("href", `/activities/${history().sourceActivityId}`)}>`);
    Arrow_left($$renderer2, { size: 18 });
    $$renderer2.push(`<!----> ${escape_html(t2("back_to_activity"))}</a> <header class="matched-routes-header"><span class="matched-routes-icon">`);
    Map_pinned($$renderer2, { size: 27 });
    $$renderer2.push(`<!----></span> <div><span class="eyebrow">${escape_html(t2("repeated_route"))}</span> <h1>${escape_html(t2("matched", { activities: isSpeed() ? t2("matched_rides") : t2("matched_runs") }))}</h1> <p>${escape_html(t2("compare_route_activities", { count: activities().length }))}</p></div></header> `);
    if (validValues().length > 0) {
      $$renderer2.push(`<!--[0--><section class="matched-route-chart"${attr("aria-label", t2("route_performance_over_time"))}><div class="matched-route-chart-heading"><div><span class="eyebrow">${escape_html(t2("progress_over_time"))}</span> <h2>${escape_html(isSpeed() ? t2("speed") : t2("pace"))}</h2></div></div> <div class="matched-chart-wrap"><svg viewBox="0 0 1000 300" role="img"${attr("aria-label", `${isSpeed() ? "Speed" : "Pace"} for each matched activity`)}><line class="chart-y-axis" x1="48" x2="48" y1="28" y2="270"></line><text class="chart-axis-title" x="48" y="20">${escape_html(isSpeed() ? t2("speed") : t2("pace"))}</text><!--[-->`);
      const each_array = ensure_array_like(axisTicks());
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let tick3 = each_array[$$index];
        $$renderer2.push(`<line class="chart-grid" x1="48" x2="952"${attr("y1", chartY(tick3))}${attr("y2", chartY(tick3))}></line><line class="chart-y-tick" x1="43" x2="48"${attr("y1", chartY(tick3))}${attr("y2", chartY(tick3))}></line><text class="chart-axis-label" x="39"${attr("y", chartY(tick3) + 4)} text-anchor="end">${escape_html(axisLabel(tick3))}</text>`);
      }
      $$renderer2.push(`<!--]--><line class="chart-guide chart-fastest" x1="48" x2="952"${attr("y1", fastestY())}${attr("y2", fastestY())}></line><line class="chart-average" x1="48" x2="952"${attr("y1", averageY())}${attr("y2", averageY())}></line><line class="chart-guide chart-slowest" x1="48" x2="952"${attr("y1", slowestY())}${attr("y2", slowestY())}></line><polyline class="chart-line"${attr("points", linePoints())}></polyline><path class="chart-trend"${attr("d", trendPath())}></path><!--[-->`);
      const each_array_1 = ensure_array_like(chartPoints());
      for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
        let point = each_array_1[$$index_1];
        $$renderer2.push(`<a${attr_class("chart-point", void 0, {
          "active": activeActivityId === point.id,
          "fastest": point.chartValue === fastest()
        })}${attr("href", `/activities/${point.id}`)}${attr("aria-label", `${activityName(point)}, ${performance(point.metrics?.avgSpeed ?? null)}`)}><circle${attr("cx", point.x)}${attr("cy", point.y)}${attr("r", point.id === history().sourceActivityId || activeActivityId === point.id ? 9 : 6)}${attr_class("", void 0, { "current": point.id === history().sourceActivityId })}></circle><title>${escape_html(activityName(point))} \xB7 ${escape_html(performance(point.metrics?.avgSpeed ?? null))}</title></a>`);
      }
      $$renderer2.push(`<!--]-->`);
      if (selectedPoint()) $$renderer2.push(`<!--[0--><line class="chart-selection-line"${attr("x1", selectedPoint().x)}${attr("x2", selectedPoint().x)} y1="28" y2="270"></line><circle class="chart-selection-point"${attr("cx", selectedPoint().x)}${attr("cy", selectedPoint().y)} r="8"></circle><g class="chart-selection-tooltip"${attr("transform", `translate(${tooltipX(selectedPoint().x)} 18)`)}><rect width="190" height="58" rx="2"></rect><text x="12" y="22" class="chart-selection-name">${escape_html(activityName(selectedPoint()))}</text><text x="12" y="44" class="chart-selection-value">${escape_html(performance(selectedPoint().metrics?.avgSpeed ?? null))}</text><text x="104" y="44" class="chart-selection-difference">${escape_html(difference(selectedPoint().chartValue))}</text></g>`);
      else $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<!--]--></svg> <aside class="chart-stat-labels"${attr("aria-label", t2("performance_summary"))}><span class="fastest">${escape_html(t2("fastest"))}<strong>${escape_html(displayChartValue(fastest()))}</strong></span> <span class="average">${escape_html(t2("all_time_average"))}<strong>${escape_html(displayChartValue(average()))}</strong></span> <span class="slowest">${escape_html(t2("slowest"))}<strong>${escape_html(displayChartValue(slowest()))}</strong></span></aside></div> <div class="matched-chart-range"><span>${escape_html(localDate(efforts()[0].startedAt))}</span><span>${escape_html(localDate(efforts().at(-1).startedAt))}</span></div> <div class="matched-chart-legend">><strong>${escape_html(t2("activities_count", { count: activities().length }))}</strong><span><i class="trend-swatch"></i>${escape_html(t2("trending_average"))}</span><span><i class="effort-swatch"></i>${escape_html(t2("each_effort"))}</span></div></section>`);
    } else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--> <section class="matched-route-list"><div class="section-heading"><div><span class="eyebrow">${escape_html(t2("every_effort"))}</span> <h2>${escape_html(t2("activities_count", { count: activities().length }))}</h2></div></div> <div class="matched-route-table" role="table"${attr("aria-label", t2("matched_route_activities"))}><div class="matched-route-row matched-route-table-header" role="row"><span role="columnheader">${escape_html(t2("date"))}</span><span role="columnheader">${escape_html(t2("activity"))}</span><span role="columnheader">${escape_html(isSpeed() ? t2("speed") : t2("pace"))}</span><span role="columnheader">${escape_html(t2("versus_average"))}</span><span role="columnheader">${escape_html(t2("moving_time"))}</span><span></span></div> <!--[-->`);
    const each_array_2 = ensure_array_like([...efforts()].reverse());
    for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
      let effort = each_array_2[$$index_2];
      $$renderer2.push(`<a${attr_class("matched-route-row", void 0, {
        "current": effort.id === history().sourceActivityId,
        "fastest": effort.chartValue === fastest(),
        "active": activeActivityId === effort.id
      })} role="row"${attr("href", `/activities/${effort.id}`)}><span role="cell">${escape_html(localDate(effort.startedAt))}</span> <span role="cell"><strong>${escape_html(activityName(effort))}</strong>`);
      if (effort.id === history().sourceActivityId) $$renderer2.push(`<!--[0--><small>${escape_html(t2("this_activity", { activity: isSpeed() ? t2("ride") : t2("run") }))}</small>`);
      else $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<!--]--></span> <span role="cell">${escape_html(performance(effort.metrics?.avgSpeed ?? null))}</span> <span role="cell"${attr_class("", void 0, { "better": isSpeed() ? effort.chartValue > average() : effort.chartValue < average() })}>${escape_html(difference(effort.chartValue))}</span> <span class="matched-time" role="cell">`);
      Timer($$renderer2, { size: 15 });
      $$renderer2.push(`<!---->${escape_html(effort.metrics ? effortDuration(effort.metrics.movingTime ?? effort.metrics.elapsedTime) : "\u2014")}</span> `);
      Chevron_right($$renderer2, { size: 17 });
      $$renderer2.push(`<!----></a>`);
    }
    $$renderer2.push(`<!--]--></div></section></div>`);
  });
}
var init_page_svelte3 = __esm({
  ".svelte-kit/output/server/entries/pages/activities/_id_/matched-routes/_page.svelte.js"() {
    init_server();
    init_arrow_left();
    init_activity_types();
    init_chevron_right();
    init_map_pinned();
    init_timer();
    init_i18n();
    init_build();
    init_api2();
    init_format();
    __name(_page3, "_page");
  }
});

// .svelte-kit/output/server/nodes/4.js
var __exports5 = {};
__export(__exports5, {
  component: () => component5,
  fonts: () => fonts5,
  imports: () => imports5,
  index: () => index5,
  server: () => page_server_ts_exports3,
  server_id: () => server_id4,
  stylesheets: () => stylesheets5
});
var index5, component_cache5, component5, server_id4, imports5, stylesheets5, fonts5;
var init__5 = __esm({
  ".svelte-kit/output/server/nodes/4.js"() {
    init_page_server_ts3();
    index5 = 4;
    component5 = /* @__PURE__ */ __name(async () => component_cache5 ??= (await Promise.resolve().then(() => (init_page_svelte3(), page_svelte_exports3))).default, "component");
    server_id4 = "src/routes/activities/[id]/matched-routes/+page.server.ts";
    imports5 = ["_app/immutable/nodes/4.DUrvjvzw.js", "_app/immutable/chunks/TqmLiPd2.js", "_app/immutable/chunks/xihTtKlq.js", "_app/immutable/chunks/Cb18XCVn.js", "_app/immutable/chunks/D5mC9s7c.js", "_app/immutable/chunks/N8DLpoKl.js", "_app/immutable/chunks/BNBsMhO5.js", "_app/immutable/chunks/DL8_u9na.js", "_app/immutable/chunks/B_Z5EwsC.js", "_app/immutable/chunks/Dqafu7wB.js", "_app/immutable/chunks/COo21xW_.js", "_app/immutable/chunks/CAMS0kRz.js"];
    stylesheets5 = [];
    fonts5 = [];
  }
});

// .svelte-kit/output/server/entries/pages/admin/jobs/_page.server.ts.js
var page_server_ts_exports4 = {};
__export(page_server_ts_exports4, {
  load: () => load5
});
var HISTORY_PAGE_SIZE, load5;
var init_page_server_ts4 = __esm({
  ".svelte-kit/output/server/entries/pages/admin/jobs/_page.server.ts.js"() {
    init_api();
    init_build();
    init_exports();
    HISTORY_PAGE_SIZE = 75;
    load5 = /* @__PURE__ */ __name(async ({ fetch: fetch2, locals, parent, url }) => {
      const { user } = await parent();
      if (user?.role !== "admin") throw redirect(303, "/");
      const requestedPage = Number(url.searchParams.get("jobsPage"));
      const requestedCount = Number(url.searchParams.get("jobsCount"));
      const page3 = Number.isInteger(requestedPage) && requestedPage > 1 ? requestedPage : 1;
      const count = Number.isInteger(requestedCount) && requestedCount > HISTORY_PAGE_SIZE ? Math.min(requestedCount, 200) : 0;
      const offset = count > 0 ? 0 : (page3 - 1) * HISTORY_PAGE_SIZE;
      const limit = count > 0 ? count : HISTORY_PAGE_SIZE;
      const options2 = getServerSdkRequestOptions(locals.kondisFetch ?? fetch2);
      const [queues, history] = await Promise.all([jobControllerGetAllJobStatus(options2), jobControllerGetJobHistory({
        limit,
        offset
      }, options2)]);
      return {
        queues,
        history,
        historyOffset: offset
      };
    }, "load");
  }
});

// .svelte-kit/output/server/chunks/archive.js
function Archive($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "archive" },
    props,
    { iconNode: [
      ["rect", {
        "width": "20",
        "height": "5",
        "x": "2",
        "y": "3",
        "rx": "1"
      }],
      ["path", { "d": "M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" }],
      ["path", { "d": "M10 12h4" }]
    ] }
  ]));
}
var init_archive = __esm({
  ".svelte-kit/output/server/chunks/archive.js"() {
    init_server();
    init_Icon();
    __name(Archive, "Archive");
  }
});

// .svelte-kit/output/server/chunks/circle-alert.js
function Circle_alert($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "circle-alert" },
    props,
    { iconNode: [
      ["circle", {
        "cx": "12",
        "cy": "12",
        "r": "10"
      }],
      ["line", {
        "x1": "12",
        "x2": "12",
        "y1": "8",
        "y2": "12"
      }],
      ["line", {
        "x1": "12",
        "x2": "12.01",
        "y1": "16",
        "y2": "16"
      }]
    ] }
  ]));
}
var init_circle_alert = __esm({
  ".svelte-kit/output/server/chunks/circle-alert.js"() {
    init_server();
    init_Icon();
    __name(Circle_alert, "Circle_alert");
  }
});

// .svelte-kit/output/server/entries/pages/admin/jobs/_page.svelte.js
var page_svelte_exports4 = {};
__export(page_svelte_exports4, {
  default: () => _page4
});
function Database($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "database" },
    props,
    { iconNode: [
      ["ellipse", {
        "cx": "12",
        "cy": "5",
        "rx": "9",
        "ry": "3"
      }],
      ["path", { "d": "M3 5V19A9 3 0 0 0 21 19V5" }],
      ["path", { "d": "M3 12A9 3 0 0 0 21 12" }]
    ] }
  ]));
}
function File_chart_column_increasing($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "file-chart-column-increasing" },
    props,
    { iconNode: [
      ["path", { "d": "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" }],
      ["path", { "d": "M14 2v5a1 1 0 0 0 1 1h5" }],
      ["path", { "d": "M8 18v-2" }],
      ["path", { "d": "M12 18v-4" }],
      ["path", { "d": "M16 18v-6" }]
    ] }
  ]));
}
function Hard_drive($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "hard-drive" },
    props,
    { iconNode: [
      ["path", { "d": "M10 16h.01" }],
      ["path", { "d": "M2.212 11.577a2 2 0 0 0-.212.896V18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5.527a2 2 0 0 0-.212-.896L18.55 5.11A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" }],
      ["path", { "d": "M21.946 12.013H2.054" }],
      ["path", { "d": "M6 16h.01" }]
    ] }
  ]));
}
function Image($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "image" },
    props,
    { iconNode: [
      ["rect", {
        "width": "18",
        "height": "18",
        "x": "3",
        "y": "3",
        "rx": "2",
        "ry": "2"
      }],
      ["circle", {
        "cx": "9",
        "cy": "9",
        "r": "2"
      }],
      ["path", { "d": "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" }]
    ] }
  ]));
}
function _page4($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const HISTORY_PAGE_SIZE2 = 75;
    const GRAPH_BUCKET_MS = 15e3;
    const GRAPH_BUCKETS = 20;
    const GRAPH_WIDTH = 500;
    const GRAPH_BASELINE = 144;
    const GRAPH_HEIGHT = 62;
    let { data } = $$props;
    let queues = run(() => data.queues);
    let history = run(() => data.history.jobs);
    let totalHistory = run(() => data.history.total);
    let historyOffset = run(() => data.historyOffset);
    let pageInput = run(() => Math.floor(data.historyOffset / HISTORY_PAGE_SIZE2) + 1);
    let historyLoading = false;
    let currentTime = /* @__PURE__ */ new Date();
    let totalPages = derived(() => Math.max(1, Math.ceil(totalHistory / HISTORY_PAGE_SIZE2)));
    let currentPage = derived(() => Math.floor(historyOffset / HISTORY_PAGE_SIZE2) + 1);
    let canLoadMore = derived(() => historyOffset === 0 && history.length < totalHistory);
    const queueDefinitions = [
      {
        key: QueueName.ActivityParsing,
        label: t2("activity_processing"),
        description: t2("activity_processing_description"),
        icon: File_chart_column_increasing
      },
      {
        key: QueueName.BackgroundTask,
        label: t2("imports_and_tasks"),
        description: t2("imports_and_tasks_description"),
        icon: Archive
      },
      {
        key: QueueName.ImageProcessing,
        label: t2("image_processing"),
        description: t2("image_processing_description"),
        icon: Image
      },
      {
        key: QueueName.Storage,
        label: t2("storage_tasks"),
        description: t2("storage_tasks_description"),
        icon: Hard_drive
      }
    ];
    const jobTranslationKeys = {
      ActivityUpload: "job_name_activity_upload",
      ActivityMetricCompute: "job_name_activity_metric_compute",
      ActivityBestEffortCompute: "job_name_activity_best_effort_compute",
      ActivityBestEffortRank: "job_name_activity_best_effort_rank",
      ActivityRouteMatchCompute: "job_name_activity_route_match_compute",
      ActivityParse: "job_name_activity_parse",
      ActivityManualCreate: "job_name_activity_manual_create",
      ActivityParseQueueAll: "job_name_activity_parse_queue_all",
      ActivityDelete: "job_name_activity_delete",
      ActivityImageIngest: "job_name_activity_image_ingest",
      ActivityImageAttach: "job_name_activity_image_attach",
      ActivityImageGenerateThumbnails: "job_name_activity_image_generate_thumbnails",
      ActivityImageGenerateQueueAll: "job_name_activity_image_generate_queue_all",
      UserAvatarUpload: "job_name_user_avatar_upload",
      FileDelete: "job_name_file_delete",
      TemporaryFileCleanup: "job_name_temporary_file_cleanup"
    };
    function jobLabel(name) {
      const key2 = jobTranslationKeys[name];
      return key2 ? t2(key2) : name;
    }
    __name(jobLabel, "jobLabel");
    function queueLabel(queue) {
      return queueDefinitions.find(({ key: key2 }) => key2 === queue)?.label ?? queue;
    }
    __name(queueLabel, "queueLabel");
    function queueGraph(queue, now) {
      const buckets = Array.from({ length: GRAPH_BUCKETS }, () => 0);
      const windowEnd = Math.floor(now.getTime() / GRAPH_BUCKET_MS) * GRAPH_BUCKET_MS + GRAPH_BUCKET_MS;
      const windowStart = windowEnd - GRAPH_BUCKETS * GRAPH_BUCKET_MS;
      for (const job of history) {
        if (job.queue !== queue) continue;
        const timestamp = Date.parse(job.startedAt ?? job.createdAt);
        if (!Number.isFinite(timestamp) || timestamp < windowStart || timestamp >= windowEnd) continue;
        const bucket = Math.floor((timestamp - windowStart) / GRAPH_BUCKET_MS);
        buckets[bucket] += 1;
      }
      const maximum = Math.max(...buckets, 1);
      const line = `M${buckets.map((count, index23) => {
        const x = index23 / 19 * GRAPH_WIDTH;
        const y2 = GRAPH_BASELINE - count / maximum * GRAPH_HEIGHT;
        return `${x.toFixed(1)} ${y2.toFixed(1)}`;
      }).join(" L")}`;
      return {
        line,
        area: `${line} L${GRAPH_WIDTH} 150 L0 150 Z`
      };
    }
    __name(queueGraph, "queueGraph");
    function statusLabel(status) {
      switch (status) {
        case "queued":
          return t2("job_status_queued");
        case "running":
          return t2("job_status_running");
        case "succeeded":
          return t2("job_status_succeeded");
        case "failed":
          return t2("job_status_failed");
        case "skipped":
          return t2("job_status_skipped");
      }
    }
    __name(statusLabel, "statusLabel");
    function duration2(milliseconds) {
      if (milliseconds == null) return "\u2014";
      if (milliseconds < 1e3) return `${milliseconds} ms`;
      const seconds = milliseconds / 1e3;
      return seconds < 60 ? `${seconds.toFixed(seconds < 10 ? 1 : 0)} s` : `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    }
    __name(duration2, "duration");
    head("mzhd49", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>${escape_html(t2("job_queues"))} \xB7 Kondis</title>`);
      });
    });
    $$renderer2.push(`<div class="page-shell job-dashboard"><header class="page-header job-dashboard-header"><div><span class="eyebrow">${escape_html(t2("administration"))}</span> <h1>${escape_html(t2("job_queues"))}</h1> <p>${escape_html(t2("job_queues_description"))}</p></div></header> `);
    $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--> <section class="job-queue-grid"${attr("aria-label", t2("job_queue_status"))}><!--[-->`);
    const each_array = ensure_array_like(queueDefinitions);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let definition = each_array[$$index];
      const report = queues[definition.key];
      const graph = queueGraph(definition.key, currentTime);
      $$renderer2.push(`<article class="job-queue-card"><svg class="job-queue-graph" viewBox="0 0 500 150" preserveAspectRatio="none" aria-hidden="true"><path class="job-queue-graph-area"${attr("d", graph.area)}></path><path class="job-queue-graph-line"${attr("d", graph.line)}></path></svg> <div class="job-queue-content"><div class="job-queue-heading"><span class="job-queue-icon">`);
      if (definition.icon) {
        $$renderer2.push("<!--[-->");
        definition.icon($$renderer2, { size: 21 });
        $$renderer2.push("<!--]-->");
      } else {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push("<!--]-->");
      }
      $$renderer2.push(`</span> <div><h2>${escape_html(definition.label)}</h2> <p>${escape_html(definition.description)}</p></div></div> <div class="job-counts"><div><span>${escape_html(t2("active"))}</span><strong>${escape_html(report.jobCounts.active)}</strong></div> <div><span>${escape_html(t2("waiting"))}</span><strong>${escape_html(report.jobCounts.queued)}</strong></div> <div${attr_class("", void 0, { "has-failures": report.jobCounts.failed > 0 })}><span>${escape_html(t2("failed"))}</span><strong>${escape_html(report.jobCounts.failed)}</strong></div></div></div></article>`);
    }
    $$renderer2.push(`<!--]--></section> <section class="job-history-section"><div class="job-history-heading"><div><h2>`);
    List_checks($$renderer2, { size: 20 });
    $$renderer2.push(`<!----> ${escape_html(t2("recent_jobs"))}</h2> <p>${escape_html(t2("recent_jobs_description"))}</p></div></div> `);
    if (history.length === 0) {
      $$renderer2.push(`<!--[0--><div class="job-history-empty">`);
      Database($$renderer2, { size: 28 });
      $$renderer2.push(`<!----> <strong>${escape_html(t2("no_job_history"))}</strong> <p>${escape_html(t2("no_job_history_description"))}</p></div>`);
    } else {
      $$renderer2.push(`<!--[-1--><div class="job-history-table" role="table"><div class="job-history-row job-history-columns" role="row"><span role="columnheader">${escape_html(t2("job"))}</span> <span role="columnheader">${escape_html(t2("queue"))}</span> <span role="columnheader">${escape_html(t2("status"))}</span> <span role="columnheader">${escape_html(t2("started"))}</span> <span role="columnheader">${escape_html(t2("duration"))}</span></div> <!--[-->`);
      const each_array_1 = ensure_array_like(history);
      for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
        let job = each_array_1[$$index_1];
        $$renderer2.push(`<div class="job-history-row" role="row"><span class="job-history-name" role="cell">`);
        if (job.activityId) $$renderer2.push(`<!--[0--><a${attr("href", `/activities/${job.activityId}`)}><strong>${escape_html(jobLabel(job.name))}</strong></a>`);
        else $$renderer2.push(`<!--[-1--><strong>${escape_html(jobLabel(job.name))}</strong>`);
        $$renderer2.push(`<!--]--> `);
        if (job.attempt > 1) $$renderer2.push(`<!--[0--><small>${escape_html(t2("attempt_number", { number: job.attempt }))}</small>`);
        else $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<!--]--></span> <span role="cell">${escape_html(queueLabel(job.queue))}</span> <span role="cell"><span${attr_class(`job-status status-${stringify(job.status)}`)}>${escape_html(statusLabel(job.status))}</span></span> <span role="cell"><time${attr("datetime", job.startedAt ?? job.createdAt)}>${escape_html(relativeOrDateTime(job.startedAt ?? job.createdAt, currentTime))}</time></span> <span role="cell">${escape_html(duration2(job.durationMs))}</span> `);
        if (job.error) $$renderer2.push(`<!--[0--><details class="job-error-detail"><summary>${escape_html(t2("view_error"))}</summary> <p>${escape_html(job.error)}</p></details>`);
        else $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<!--]--></div>`);
      }
      $$renderer2.push(`<!--]--></div> <div class="job-history-pagination"><span class="job-history-count">${escape_html(t2("jobs_shown", {
        shown: history.length,
        total: totalHistory
      }))}</span> <div class="job-history-actions">`);
      if (canLoadMore()) $$renderer2.push(`<!--[0--><button class="job-page-button" type="button"${attr("disabled", historyLoading, true)}>${escape_html(t2("load_more"))}</button>`);
      else $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<!--]--> `);
      if (totalPages() > 1) {
        $$renderer2.push(`<!--[0--><button class="job-icon-button" type="button"${attr("aria-label", t2("previous_page"))}${attr("disabled", currentPage() <= 1, true)}>`);
        Chevron_left($$renderer2, { size: 16 });
        $$renderer2.push(`<!----></button> <label class="job-page-input"><span>${escape_html(t2("page"))}</span> <input type="number" min="1"${attr("max", totalPages())}${attr("value", pageInput)}${attr("aria-label", t2("go_to_page"))}/> <span>${escape_html(t2("of_pages", { total: totalPages() }))}</span></label> <button class="job-icon-button" type="button"${attr("aria-label", t2("next_page"))}${attr("disabled", currentPage() >= totalPages(), true)}>`);
        Chevron_right($$renderer2, { size: 16 });
        $$renderer2.push(`<!----></button>`);
      } else $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<!--]--></div></div>`);
    }
    $$renderer2.push(`<!--]--></section></div>`);
  });
}
var init_page_svelte4 = __esm({
  ".svelte-kit/output/server/entries/pages/admin/jobs/_page.svelte.js"() {
    init_index_server();
    init_server();
    init_navigation();
    init_Icon();
    init_archive();
    init_chevron_left();
    init_chevron_right();
    init_circle_alert();
    init_list_checks();
    init_i18n();
    init_build();
    init_api2();
    init_format();
    init_realtime();
    __name(Database, "Database");
    __name(File_chart_column_increasing, "File_chart_column_increasing");
    __name(Hard_drive, "Hard_drive");
    __name(Image, "Image");
    __name(_page4, "_page");
  }
});

// .svelte-kit/output/server/nodes/5.js
var __exports6 = {};
__export(__exports6, {
  component: () => component6,
  fonts: () => fonts6,
  imports: () => imports6,
  index: () => index6,
  server: () => page_server_ts_exports4,
  server_id: () => server_id5,
  stylesheets: () => stylesheets6
});
var index6, component_cache6, component6, server_id5, imports6, stylesheets6, fonts6;
var init__6 = __esm({
  ".svelte-kit/output/server/nodes/5.js"() {
    init_page_server_ts4();
    index6 = 5;
    component6 = /* @__PURE__ */ __name(async () => component_cache6 ??= (await Promise.resolve().then(() => (init_page_svelte4(), page_svelte_exports4))).default, "component");
    server_id5 = "src/routes/admin/jobs/+page.server.ts";
    imports6 = ["_app/immutable/nodes/5.M3S9MR7K.js", "_app/immutable/chunks/TqmLiPd2.js", "_app/immutable/chunks/B90Er9NH.js", "_app/immutable/chunks/xihTtKlq.js", "_app/immutable/chunks/LlbaMzKX.js", "_app/immutable/chunks/D5mC9s7c.js", "_app/immutable/chunks/8ijIODKe.js", "_app/immutable/chunks/DYHuczPH.js", "_app/immutable/chunks/DL8_u9na.js", "_app/immutable/chunks/CcRl4Fq9.js", "_app/immutable/chunks/DzOiouzx.js", "_app/immutable/chunks/COo21xW_.js", "_app/immutable/chunks/BNBsMhO5.js", "_app/immutable/chunks/CAMS0kRz.js", "_app/immutable/chunks/B4Kzzj8V.js"];
    stylesheets6 = [];
    fonts6 = [];
  }
});

// .svelte-kit/output/server/entries/pages/best-efforts/_page.server.ts.js
var page_server_ts_exports5 = {};
__export(page_server_ts_exports5, {
  load: () => load6
});
var load6;
var init_page_server_ts5 = __esm({
  ".svelte-kit/output/server/entries/pages/best-efforts/_page.server.ts.js"() {
    init_api();
    init_build();
    init_api2();
    load6 = /* @__PURE__ */ __name(async ({ locals }) => {
      const requestOptions = getServerSdkRequestOptions(locals.kondisFetch);
      const [run3, ride] = await Promise.all([["run", BestEffortType.$5K], ["ride", BestEffortType.$10K]].map(async ([sport, type]) => {
        try {
          return await activityControllerListBestEfforts({
            sport,
            $type: type
          }, requestOptions);
        } catch {
          return null;
        }
      }));
      const histories = [run3, ride].filter((history) => history !== null);
      return {
        efforts: await Promise.all(histories.flatMap((history) => history.options.map(async (option) => {
          let detail = history.type === option.type ? history : null;
          if (!detail) try {
            detail = await activityControllerListBestEfforts({
              sport: history.sport,
              $type: option.type
            }, requestOptions);
          } catch {
          }
          const best = detail?.efforts.toSorted((left, right) => left.overallRank - right.overallRank)[0];
          return {
            sport: history.sport,
            type: option.type,
            valueKind: option.valueKind,
            best: best ? {
              value: best.value,
              startedAt: best.startedAt
            } : null
          };
        }))),
        unavailable: histories.length === 0
      };
    }, "load");
  }
});

// .svelte-kit/output/server/chunks/arrow-right.js
function Arrow_right($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "arrow-right" },
    props,
    { iconNode: [["path", { "d": "M5 12h14" }], ["path", { "d": "m12 5 7 7-7 7" }]] }
  ]));
}
var init_arrow_right = __esm({
  ".svelte-kit/output/server/chunks/arrow-right.js"() {
    init_server();
    init_Icon();
    __name(Arrow_right, "Arrow_right");
  }
});

// .svelte-kit/output/server/entries/pages/best-efforts/_page.svelte.js
var page_svelte_exports5 = {};
__export(page_svelte_exports5, {
  default: () => _page5
});
function _page5($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    const sports = [{
      key: "run",
      label: t2("run")
    }, {
      key: "ride",
      label: t2("ride")
    }];
    function effortsFor(sport) {
      return data.efforts.filter((effort) => effort.sport === sport);
    }
    __name(effortsFor, "effortsFor");
    head("r769jt", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>${escape_html(t2("best_efforts"))} \xB7 Kondis</title>`);
      });
    });
    $$renderer2.push(`<div class="page-shell best-efforts-index-page"><header class="page-header"><div><h1>${escape_html(t2("best_efforts"))}</h1> <p>${escape_html(t2("effort_progress_description"))}</p></div></header> `);
    if (data.unavailable) {
      $$renderer2.push(`<!--[0--><div class="notice">`);
      Trophy($$renderer2, { size: 20 });
      $$renderer2.push(`<!----><span><strong>${escape_html(t2("server_unavailable"))}</strong> ${escape_html(t2("could_not_load_best_efforts"))}</span></div>`);
    } else {
      $$renderer2.push(`<!--[-1--><div class="best-efforts-index-list"><!--[-->`);
      const each_array = ensure_array_like(sports);
      for (let $$index_1 = 0, $$length = each_array.length; $$index_1 < $$length; $$index_1++) {
        let sport = each_array[$$index_1];
        const efforts = effortsFor(sport.key);
        if (efforts.length) {
          $$renderer2.push(`<!--[0--><section class="best-efforts-index-section"><h2>${escape_html(sport.label)}</h2> <div class="best-efforts-index-table"><!--[-->`);
          const each_array_1 = ensure_array_like(efforts);
          for (let $$index = 0, $$length2 = each_array_1.length; $$index < $$length2; $$index++) {
            let effort = each_array_1[$$index];
            $$renderer2.push(`<a class="best-efforts-index-row"${attr("href", `/best-efforts/${sport.key}/${effort.type}`)}><strong>${escape_html(bestEffortLabel(effort.type))}</strong> `);
            if (effort.best) $$renderer2.push(`<!--[0--><span class="best-efforts-index-value">${escape_html(bestEffortValue(effort.best.value, effort.valueKind, data.unitSystem))}</span> <time${attr("datetime", effort.best.startedAt)}>${escape_html(new Date(effort.best.startedAt).toLocaleDateString(void 0, {
              day: "numeric",
              month: "short",
              year: "numeric"
            }))}</time>`);
            else $$renderer2.push(`<!--[-1--><span class="best-efforts-index-value">\u2014</span> <span class="best-efforts-index-empty">${escape_html(t2("no_result_yet"))}</span>`);
            $$renderer2.push(`<!--]--> `);
            Arrow_right($$renderer2, { size: 18 });
            $$renderer2.push(`<!----></a>`);
          }
          $$renderer2.push(`<!--]--></div></section>`);
        } else $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<!--]-->`);
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
var init_page_svelte5 = __esm({
  ".svelte-kit/output/server/entries/pages/best-efforts/_page.svelte.js"() {
    init_server();
    init_arrow_right();
    init_trophy();
    init_i18n();
    init_format();
    init_best_efforts();
    __name(_page5, "_page");
  }
});

// .svelte-kit/output/server/nodes/6.js
var __exports7 = {};
__export(__exports7, {
  component: () => component7,
  fonts: () => fonts7,
  imports: () => imports7,
  index: () => index7,
  server: () => page_server_ts_exports5,
  server_id: () => server_id6,
  stylesheets: () => stylesheets7
});
var index7, component_cache7, component7, server_id6, imports7, stylesheets7, fonts7;
var init__7 = __esm({
  ".svelte-kit/output/server/nodes/6.js"() {
    init_page_server_ts5();
    index7 = 6;
    component7 = /* @__PURE__ */ __name(async () => component_cache7 ??= (await Promise.resolve().then(() => (init_page_svelte5(), page_svelte_exports5))).default, "component");
    server_id6 = "src/routes/best-efforts/+page.server.ts";
    imports7 = ["_app/immutable/nodes/6.DbGTaVrr.js", "_app/immutable/chunks/TqmLiPd2.js", "_app/immutable/chunks/xihTtKlq.js", "_app/immutable/chunks/Be0tUrl1.js", "_app/immutable/chunks/D5mC9s7c.js", "_app/immutable/chunks/CqyzYzP_.js", "_app/immutable/chunks/COo21xW_.js", "_app/immutable/chunks/CAMS0kRz.js", "_app/immutable/chunks/CtcJAU9W.js"];
    stylesheets7 = [];
    fonts7 = [];
  }
});

// .svelte-kit/output/server/entries/pages/best-efforts/_sport_/_page.server.ts.js
var page_server_ts_exports6 = {};
__export(page_server_ts_exports6, {
  load: () => load7
});
var load7;
var init_page_server_ts6 = __esm({
  ".svelte-kit/output/server/entries/pages/best-efforts/_sport_/_page.server.ts.js"() {
    init_exports();
    load7 = /* @__PURE__ */ __name(({ params }) => {
      redirect(308, `/best-efforts/${params.sport}/${params.sport === "ride" ? "10k" : "5k"}`);
    }, "load");
  }
});

// .svelte-kit/output/server/nodes/7.js
var __exports8 = {};
__export(__exports8, {
  fonts: () => fonts8,
  imports: () => imports8,
  index: () => index8,
  server: () => page_server_ts_exports6,
  server_id: () => server_id7,
  stylesheets: () => stylesheets8
});
var index8, server_id7, imports8, stylesheets8, fonts8;
var init__8 = __esm({
  ".svelte-kit/output/server/nodes/7.js"() {
    init_page_server_ts6();
    index8 = 7;
    server_id7 = "src/routes/best-efforts/[sport]/+page.server.ts";
    imports8 = [];
    stylesheets8 = [];
    fonts8 = [];
  }
});

// .svelte-kit/output/server/entries/pages/best-efforts/_sport_/_distance_/_page.server.ts.js
var page_server_ts_exports7 = {};
__export(page_server_ts_exports7, {
  load: () => load8
});
var load8;
var init_page_server_ts7 = __esm({
  ".svelte-kit/output/server/entries/pages/best-efforts/_sport_/_distance_/_page.server.ts.js"() {
    init_api();
    init_build();
    init_api2();
    init_exports();
    load8 = /* @__PURE__ */ __name(async ({ locals, params }) => {
      if (params.sport !== "run" && params.sport !== "ride") error(404, "Best effort sport not found");
      let history;
      try {
        history = await activityControllerListBestEfforts({
          sport: params.sport,
          $type: params.distance
        }, getServerSdkRequestOptions(locals.kondisFetch));
      } catch (requestError) {
        if (requestError.status === 400) error(404, "Best effort not found");
        return {
          history: null,
          unavailable: true
        };
      }
      const firstAvailable = history.options[0];
      if (history.efforts.length === 0 && firstAvailable && !history.options.some(({ type }) => type === history.type)) redirect(307, `/best-efforts/${history.sport}/${firstAvailable.type}`);
      return {
        history,
        unavailable: false
      };
    }, "load");
  }
});

// .svelte-kit/output/server/entries/pages/best-efforts/_sport_/_distance_/_page.svelte.js
var page_svelte_exports6 = {};
__export(page_svelte_exports6, {
  default: () => _page6
});
function Award($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "award" },
    props,
    { iconNode: [["path", { "d": "m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526" }], ["circle", {
      "cx": "12",
      "cy": "8",
      "r": "6"
    }]] }
  ]));
}
function BestEffortChart($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { efforts, label, valueKind, higherIsBetter, unitSystem } = $$props;
    const width = 900;
    const height = 300;
    const padding = {
      top: 24,
      right: 24,
      bottom: 42,
      left: 58
    };
    const dates = derived(() => efforts.map((effort) => new Date(effort.startedAt).getTime()));
    const values = derived(() => efforts.map((effort) => effort.value));
    const minDate = derived(() => Math.min(...dates()));
    const maxDate = derived(() => Math.max(...dates()));
    const logarithmicValues = derived(() => values().map((value) => Math.log(value)));
    const logarithmicMinimum = derived(() => Math.min(...logarithmicValues()));
    const logarithmicMaximum = derived(() => Math.max(...logarithmicValues()));
    const logarithmicPadding = derived(() => Math.max((logarithmicMaximum() - logarithmicMinimum()) * 0.12, 0.04));
    const yMin = derived(() => logarithmicMinimum() - logarithmicPadding());
    const yMax = derived(() => logarithmicMaximum() + logarithmicPadding());
    function x(index23) {
      if (minDate() === maxDate()) return width / 2;
      return padding.left + (dates()[index23] - minDate()) / (maxDate() - minDate()) * (width - padding.left - padding.right);
    }
    __name(x, "x");
    function y2(value) {
      const ratio = (Math.log(value) - yMin()) / (yMax() - yMin());
      return padding.top + (higherIsBetter ? 1 - ratio : ratio) * (height - padding.top - padding.bottom);
    }
    __name(y2, "y");
    const points = derived(() => efforts.map((effort, index23) => `${x(index23)},${y2(effort.value)}`).join(" "));
    const yTicks = derived(() => [
      yMin(),
      (yMin() + yMax()) / 2,
      yMax()
    ].map((value) => Math.exp(value)));
    const firstYear = derived(() => new Date(minDate()).getFullYear());
    const lastYear = derived(() => new Date(maxDate()).getFullYear());
    $$renderer2.push(`<div class="effort-chart-wrap"><svg class="effort-chart"${attr("viewBox", `0 0 ${width} ${height}`)} role="img"${attr("aria-label", `${label} best efforts over time`)}><!--[-->`);
    const each_array = ensure_array_like(yTicks());
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let tick3 = each_array[$$index];
      $$renderer2.push(`<line${attr("x1", padding.left)}${attr("x2", width - padding.right)}${attr("y1", y2(tick3))}${attr("y2", y2(tick3))} class="chart-grid"></line><text${attr("x", padding.left - 11)}${attr("y", y2(tick3) + 4)} text-anchor="end" class="chart-label">${escape_html(bestEffortValue(tick3, valueKind, unitSystem))}</text>`);
    }
    $$renderer2.push(`<!--]-->`);
    if (efforts.length > 1) $$renderer2.push(`<!--[0--><polyline${attr("points", points())} class="chart-line"></polyline>`);
    else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--><!--[-->`);
    const each_array_1 = ensure_array_like(efforts);
    for (let index23 = 0, $$length = each_array_1.length; index23 < $$length; index23++) {
      let effort = each_array_1[index23];
      $$renderer2.push(`<a${attr("href", `/activities/${effort.activityId}`)}${attr("aria-label", `${bestEffortValue(effort.value, valueKind, unitSystem)} on ${new Date(effort.startedAt).toLocaleDateString()}`)}><circle class="chart-hit-area"${attr("cx", x(index23))}${attr("cy", y2(effort.value))} r="12"></circle><circle${attr_class("chart-point", void 0, {
        "gold-point": effort.overallRank === 1,
        "silver-point": effort.overallRank === 2,
        "bronze-point": effort.overallRank === 3,
        "year-point": effort.yearRank === 1 && effort.overallRank > 3
      })}${attr("cx", x(index23))}${attr("cy", y2(effort.value))}${attr("r", effort.overallRank <= 3 ? 6 : effort.yearRank === 1 ? 5 : 4)}></circle></a>`);
    }
    $$renderer2.push(`<!--]-->`);
    $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--><text${attr("x", padding.left)}${attr("y", 290)} class="chart-label">${escape_html(firstYear())}</text>`);
    if (lastYear() !== firstYear()) $$renderer2.push(`<!--[0--><text${attr("x", width - padding.right)}${attr("y", 290)} text-anchor="end" class="chart-label">${escape_html(lastYear())}</text>`);
    else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--></svg></div>`);
  });
}
function _page6($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    const history = derived(() => data.history);
    const label = derived(() => history() ? bestEffortLabel(history().type) : "");
    const podium = derived(() => history() ? history().efforts.filter((effort) => effort.overallRank <= 3).toSorted((a2, b) => a2.overallRank - b.overallRank) : []);
    const recentEfforts = derived(() => history() ? [...history().efforts].reverse() : []);
    const medalNames = [
      "Gold",
      "Silver",
      "Bronze"
    ];
    const sportName = derived(() => history()?.sport === "ride" ? "Cycling" : "Running");
    const activityNoun = derived(() => history()?.sport === "ride" ? "rides" : "runs");
    const optionGroups = derived(() => history() ? Object.entries(Object.groupBy(history().options, ({ valueKind }) => valueKind)) : []);
    const optionGroupLabels = {
      distance: "Longest ride",
      elevation: "Elevation",
      duration: "Distance",
      power: "Power"
    };
    function selectEffort(type) {
      if (history()) goto(`/best-efforts/${history().sport}/${type}`);
    }
    __name(selectEffort, "selectEffort");
    function secondaryValue(effort) {
      if (!history()) return "";
      if (history().valueKind === "duration" && history().distance) return pace(history().distance / effort.value, data.unitSystem);
      if (history().valueKind === "distance") return duration(effort.elapsedTime);
      return "";
    }
    __name(secondaryValue, "secondaryValue");
    head("1ce7cmy", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>${escape_html(t2("best_efforts"))} \xB7 Kondis</title>`);
      });
    });
    $$renderer2.push(`<div class="page-shell best-efforts-page"><header class="page-header best-efforts-header"><div><span class="eyebrow">${escape_html(sportName())} ${escape_html(t2("performance"))}</span> <h1>${escape_html(t2("best_efforts"))}</h1> <p>${escape_html(t2("best_efforts_progress", { activities: activityNoun() }))}</p> <nav class="effort-sport-tabs"${attr("aria-label", t2("best_effort_sport"))}><a href="/best-efforts/run/5k"${attr_class("", void 0, { "active": history()?.sport === "run" })}>${escape_html(t2("run"))}</a> <a href="/best-efforts/ride/10k"${attr_class("", void 0, { "active": history()?.sport === "ride" })}>${escape_html(t2("ride"))}</a></nav></div> `);
    if (history()) {
      $$renderer2.push(`<!--[0--><div class="distance-picker"><label for="effort-distance">${escape_html(t2("effort"))}</label> `);
      $$renderer2.select({
        id: "effort-distance",
        value: history().type,
        onchange: /* @__PURE__ */ __name((event) => selectEffort(event.currentTarget.value), "onchange")
      }, ($$renderer3) => {
        $$renderer3.push(`<!--[-->`);
        const each_array = ensure_array_like(optionGroups());
        for (let $$index_1 = 0, $$length = each_array.length; $$index_1 < $$length; $$index_1++) {
          let [kind, options2] = each_array[$$index_1];
          $$renderer3.push(`<optgroup${attr("label", optionGroupLabels[kind])}><!--[-->`);
          const each_array_1 = ensure_array_like(options2 ?? []);
          for (let $$index = 0, $$length2 = each_array_1.length; $$index < $$length2; $$index++) {
            let option = each_array_1[$$index];
            $$renderer3.option({ value: option.type }, ($$renderer4) => {
              $$renderer4.push(`${escape_html(bestEffortLabel(option.type))}`);
            });
          }
          $$renderer3.push(`<!--]--></optgroup>`);
        }
        $$renderer3.push(`<!--]-->`);
      });
      $$renderer2.push(`</div>`);
    } else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--></header> `);
    if (data.unavailable) {
      $$renderer2.push(`<!--[0--><div class="notice">`);
      Cloud_off($$renderer2, { size: 20 });
      $$renderer2.push(`<!----><span><strong>${escape_html(t2("server_unavailable"))}</strong> ${escape_html(t2("could_not_load_best_efforts"))}</span></div>`);
    } else if (history() && history().efforts.length > 0) {
      $$renderer2.push(`<!--[1--><section class="effort-overview"><div class="section-heading effort-section-heading"><div><span class="eyebrow">${escape_html(t2("progress_over_time"))}</span> <h2>${escape_html(label())} ${escape_html(t2("performance"))}</h2></div> <span class="chart-hint">${escape_html(history().higherIsBetter ? t2("higher_is_better") : t2("higher_is_faster"))}</span></div> `);
      BestEffortChart($$renderer2, {
        efforts: history().efforts,
        label: label(),
        valueKind: history().valueKind,
        higherIsBetter: history().higherIsBetter,
        unitSystem: data.unitSystem
      });
      $$renderer2.push(`<!----></section> <section class="podium-section"><div class="section-heading"><div><span class="eyebrow">${escape_html(t2("all_time_ranking"))}</span> <h2>Your fastest ${escape_html(label())} efforts</h2></div></div> <div class="podium-grid"><!--[-->`);
      const each_array_2 = ensure_array_like(podium());
      for (let index23 = 0, $$length = each_array_2.length; index23 < $$length; index23++) {
        let effort = each_array_2[index23];
        $$renderer2.push(`<a${attr_class("podium-card", void 0, {
          "gold": index23 === 0,
          "silver": index23 === 1,
          "bronze": index23 === 2
        })}${attr("href", `/activities/${effort.activityId}`)}><span class="medal">`);
        Medal($$renderer2, { size: 22 });
        $$renderer2.push(`<!----><small>${escape_html(medalNames[index23])}</small></span> <div><strong>${escape_html(bestEffortValue(effort.value, history().valueKind, data.unitSystem))}</strong><span>${escape_html(activityName({
          name: effort.activityName,
          sport: effort.sport
        }))}</span><small>${escape_html(new Date(effort.startedAt).toLocaleDateString())}</small></div> `);
        Chevron_right($$renderer2, { size: 18 });
        $$renderer2.push(`<!----></a>`);
      }
      $$renderer2.push(`<!--]--></div></section> <section class="effort-history-section"><div class="section-heading"><div><span class="eyebrow">${escape_html(t2("every_result"))}</span> <h2>${escape_html(t2("effort_history"))}</h2></div></div> <div class="effort-history-list"><!--[-->`);
      const each_array_3 = ensure_array_like(recentEfforts());
      for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
        let effort = each_array_3[$$index_3];
        $$renderer2.push(`<a class="effort-history-row"${attr("href", `/activities/${effort.activityId}`)}><span${attr_class("history-rank", void 0, { "ranked": effort.overallRank <= 3 })}>${escape_html(effort.overallRank <= 3 ? `#${effort.overallRank}` : "\u2014")}</span> <span class="history-date"><strong>${escape_html(new Date(effort.startedAt).toLocaleDateString(void 0, {
          day: "numeric",
          month: "short",
          year: "numeric"
        }))}</strong><small>${escape_html(activityName({
          name: effort.activityName,
          sport: effort.sport
        }))}</small></span> <span class="history-time">`);
        Timer($$renderer2, { size: 16 });
        $$renderer2.push(`<!----><strong>${escape_html(bestEffortValue(effort.value, history().valueKind, data.unitSystem))}</strong>`);
        if (secondaryValue(effort)) $$renderer2.push(`<!--[0--><small>${escape_html(secondaryValue(effort))}</small>`);
        else $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<!--]--></span> <span class="history-badges">`);
        if (effort.overallRank <= 3) {
          $$renderer2.push(`<!--[0--><span${attr_class(`badge rank-${effort.overallRank}`)}>`);
          Medal($$renderer2, { size: 31 });
          $$renderer2.push(`<!----> ${escape_html(t2("all_time"))}</span>`);
        } else $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<!--]--> `);
        if (effort.yearRank <= 3) {
          $$renderer2.push(`<!--[0--><span${attr_class(`badge rank-${effort.yearRank}`)}>`);
          Medal($$renderer2, { size: 31 });
          $$renderer2.push(`<!----> ${escape_html(effort.year)}</span>`);
        } else $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<!--]--></span> `);
        Chevron_right($$renderer2, {
          class: "history-chevron",
          size: 18
        });
        $$renderer2.push(`<!----></a>`);
      }
      $$renderer2.push(`<!--]--></div></section>`);
    } else if (history()) {
      $$renderer2.push(`<!--[2--><div class="empty-state best-efforts-empty"><span class="empty-icon">`);
      Award($$renderer2, { size: 28 });
      $$renderer2.push(`<!----></span> <h2>${escape_html(t2("no_efforts_yet", { effort: label() }))}</h2> <p>${escape_html(t2("import_more_activities", { activities: activityNoun() }))}</p></div>`);
    } else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--></div>`);
  });
}
var init_page_svelte6 = __esm({
  ".svelte-kit/output/server/entries/pages/best-efforts/_sport_/_distance_/_page.svelte.js"() {
    init_server();
    init_client();
    init_navigation();
    init_Icon();
    init_chevron_right();
    init_cloud_off();
    init_medal();
    init_timer();
    init_i18n();
    init_format();
    init_best_efforts();
    __name(Award, "Award");
    __name(BestEffortChart, "BestEffortChart");
    __name(_page6, "_page");
  }
});

// .svelte-kit/output/server/nodes/8.js
var __exports9 = {};
__export(__exports9, {
  component: () => component8,
  fonts: () => fonts9,
  imports: () => imports9,
  index: () => index9,
  server: () => page_server_ts_exports7,
  server_id: () => server_id8,
  stylesheets: () => stylesheets9
});
var index9, component_cache8, component8, server_id8, imports9, stylesheets9, fonts9;
var init__9 = __esm({
  ".svelte-kit/output/server/nodes/8.js"() {
    init_page_server_ts7();
    index9 = 8;
    component8 = /* @__PURE__ */ __name(async () => component_cache8 ??= (await Promise.resolve().then(() => (init_page_svelte6(), page_svelte_exports6))).default, "component");
    server_id8 = "src/routes/best-efforts/[sport]/[distance]/+page.server.ts";
    imports9 = ["_app/immutable/nodes/8.gfGA6Ug4.js", "_app/immutable/chunks/TqmLiPd2.js", "_app/immutable/chunks/B90Er9NH.js", "_app/immutable/chunks/xihTtKlq.js", "_app/immutable/chunks/LlbaMzKX.js", "_app/immutable/chunks/D5mC9s7c.js", "_app/immutable/chunks/DL8_u9na.js", "_app/immutable/chunks/ItcJ_Du-.js", "_app/immutable/chunks/BNDfWvQn.js", "_app/immutable/chunks/Dqafu7wB.js", "_app/immutable/chunks/COo21xW_.js", "_app/immutable/chunks/CAMS0kRz.js", "_app/immutable/chunks/B4Kzzj8V.js", "_app/immutable/chunks/CtcJAU9W.js"];
    stylesheets9 = [];
    fonts9 = [];
  }
});

// .svelte-kit/output/server/entries/pages/live/_token_/_page.server.ts.js
var page_server_ts_exports8 = {};
__export(page_server_ts_exports8, {
  load: () => load9
});
var load9;
var init_page_server_ts8 = __esm({
  ".svelte-kit/output/server/entries/pages/live/_token_/_page.server.ts.js"() {
    init_api();
    init_exports();
    load9 = /* @__PURE__ */ __name(async ({ params, fetch: fetch2 }) => {
      const response = await fetch2(apiUrl(`api/v1/live-workouts/shared/${params.token}`));
      if (!response.ok) throw error(response.status, "This live tracking link is unavailable.");
      return {
        workout: await response.json(),
        token: params.token
      };
    }, "load");
  }
});

// .svelte-kit/output/server/chunks/LiveWorkoutView.js
function Link($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "link" },
    props,
    { iconNode: [["path", { "d": "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" }], ["path", { "d": "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" }]] }
  ]));
}
function Pause($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "pause" },
    props,
    { iconNode: [["rect", {
      "x": "14",
      "y": "3",
      "width": "5",
      "height": "18",
      "rx": "1"
    }], ["rect", {
      "x": "5",
      "y": "3",
      "width": "5",
      "height": "18",
      "rx": "1"
    }]] }
  ]));
}
function Radio($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "radio" },
    props,
    { iconNode: [
      ["path", { "d": "M16.247 7.761a6 6 0 0 1 0 8.478" }],
      ["path", { "d": "M19.075 4.933a10 10 0 0 1 0 14.134" }],
      ["path", { "d": "M4.925 19.067a10 10 0 0 1 0-14.134" }],
      ["path", { "d": "M7.753 16.239a6 6 0 0 1 0-8.478" }],
      ["circle", {
        "cx": "12",
        "cy": "12",
        "r": "2"
      }]
    ] }
  ]));
}
function Wifi_off($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "wifi-off" },
    props,
    { iconNode: [
      ["path", { "d": "M12 20h.01" }],
      ["path", { "d": "M8.5 16.429a5 5 0 0 1 7 0" }],
      ["path", { "d": "M5 12.859a10 10 0 0 1 5.17-2.69" }],
      ["path", { "d": "M19 12.859a10 10 0 0 0-2.007-1.523" }],
      ["path", { "d": "M2 8.82a15 15 0 0 1 4.177-2.643" }],
      ["path", { "d": "M22 8.82a15 15 0 0 0-11.288-3.764" }],
      ["path", { "d": "m2 2 20 20" }]
    ] }
  ]));
}
function LiveRouteMap($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { coordinates, follow = true } = $$props;
    $$renderer2.push(`<div class="live-route-map"${attr("aria-label", t2("live_workout_route"))}></div>`);
  });
}
function LiveWorkoutView($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { workout = void 0, endpoint, activityTypes, unitSystem, allowSharing = false } = $$props;
    let sharing = false;
    let now = Date.now();
    const ageSeconds = derived(() => workout.lastReceivedAt ? Math.max(0, Math.floor((now - Date.parse(workout.lastReceivedAt)) / 1e3)) : null);
    const connection = derived(() => workout.status === "paused" ? "Paused" : workout.status === "ended" ? "Finished" : ageSeconds() === null || ageSeconds() > 120 ? "Connection lost" : ageSeconds() > 30 ? "Catching up" : "Live");
    function connectionLabel(value) {
      if (value === "Paused") return t2("paused");
      if (value === "Finished") return t2("finished");
      if (value === "Connection lost") return t2("connection_lost");
      if (value === "Catching up") return t2("catching_up");
      return t2("live");
    }
    __name(connectionLabel, "connectionLabel");
    $$renderer2.push(`<section class="live-workout-view"><div class="live-workout-heading"><div><p${attr_class("live-status", void 0, { "live": connection() === "Live" })}>`);
    if (connection() === "Live") {
      $$renderer2.push("<!--[0-->");
      Radio($$renderer2, { size: 15 });
    } else if (connection() === "Paused") {
      $$renderer2.push("<!--[1-->");
      Pause($$renderer2, { size: 15 });
    } else if (connection() === "Connection lost") {
      $$renderer2.push("<!--[2-->");
      Wifi_off($$renderer2, { size: 15 });
    } else {
      $$renderer2.push("<!--[-1-->");
      Clock_3($$renderer2, { size: 15 });
    }
    $$renderer2.push(`<!--]--> ${escape_html(connectionLabel(connection()))}</p> <h1>${escape_html(workout.status === "ended" ? t2("live_workout_finished", { activity: activityTypeLabel(activityTypes, workout.sport) }) : t2("live_workout_in_progress", { activity: activityTypeLabel(activityTypes, workout.sport) }))}</h1> <span>${escape_html(ageSeconds() === null ? t2("waiting_for_gps") : t2("updated_seconds_ago", { seconds: ageSeconds() }))}</span></div> `);
    if (allowSharing) {
      $$renderer2.push(`<!--[0--><button class="live-share-button"${attr("disabled", sharing, true)}>`);
      Link($$renderer2, { size: 17 });
      $$renderer2.push(`<!----> ${escape_html(t2("share_live"))}</button>`);
    } else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--></div> `);
    $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--> <div class="live-stats"><div><strong>${escape_html(distance(workout.distanceMeters, unitSystem))}</strong><span>${escape_html(t2("distance"))}</span></div> <div><strong>${escape_html(duration(workout.elapsedSeconds))}</strong><span>${escape_html(t2("elapsed"))}</span></div> <div><strong>${escape_html(workout.route.length)}</strong><span>${escape_html(t2("gps_points"))}</span></div></div> `);
    LiveRouteMap($$renderer2, {
      coordinates: workout.route,
      follow: connection() === "Live"
    });
    $$renderer2.push(`<!----> `);
    if (workout.route.length === 0) {
      $$renderer2.push(`<!--[0--><div class="live-waiting">`);
      Activity($$renderer2, { size: 22 });
      $$renderer2.push(`<!----> ${escape_html(t2("waiting_for_first_gps_position"))}</div>`);
    } else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--></section>`);
    bind_props($$props, { workout });
  });
}
var init_LiveWorkoutView = __esm({
  ".svelte-kit/output/server/chunks/LiveWorkoutView.js"() {
    init_index_server();
    init_server();
    init_client();
    init_navigation();
    init_Icon();
    init_activity();
    init_activity_types();
    init_clock_3();
    init_i18n();
    init_format();
    __name(Link, "Link");
    __name(Pause, "Pause");
    __name(Radio, "Radio");
    __name(Wifi_off, "Wifi_off");
    __name(LiveRouteMap, "LiveRouteMap");
    __name(LiveWorkoutView, "LiveWorkoutView");
  }
});

// .svelte-kit/output/server/entries/pages/live/_token_/_page.svelte.js
var page_svelte_exports7 = {};
__export(page_svelte_exports7, {
  default: () => _page7
});
function _page7($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    head("ndak41", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>${escape_html(t2("live_tracking"))} \xB7 Kondis</title>`);
      });
    });
    $$renderer2.push(`<main class="public-live-page"><a class="public-live-brand" href="/">\u26A1 Kondis</a> `);
    LiveWorkoutView($$renderer2, {
      workout: data.workout,
      endpoint: `/api/v1/live-workouts/shared/${data.token}`,
      activityTypes: data.activityTypes,
      unitSystem: data.unitSystem
    });
    $$renderer2.push(`<!----></main>`);
  });
}
var init_page_svelte7 = __esm({
  ".svelte-kit/output/server/entries/pages/live/_token_/_page.svelte.js"() {
    init_server();
    init_LiveWorkoutView();
    init_i18n();
    __name(_page7, "_page");
  }
});

// .svelte-kit/output/server/nodes/9.js
var __exports10 = {};
__export(__exports10, {
  component: () => component9,
  fonts: () => fonts10,
  imports: () => imports10,
  index: () => index10,
  server: () => page_server_ts_exports8,
  server_id: () => server_id9,
  stylesheets: () => stylesheets10
});
var index10, component_cache9, component9, server_id9, imports10, stylesheets10, fonts10;
var init__10 = __esm({
  ".svelte-kit/output/server/nodes/9.js"() {
    init_page_server_ts8();
    index10 = 9;
    component9 = /* @__PURE__ */ __name(async () => component_cache9 ??= (await Promise.resolve().then(() => (init_page_svelte7(), page_svelte_exports7))).default, "component");
    server_id9 = "src/routes/live/[token]/+page.server.ts";
    imports10 = ["_app/immutable/nodes/9.DxHVWxNh.js", "_app/immutable/chunks/TqmLiPd2.js", "_app/immutable/chunks/xihTtKlq.js", "_app/immutable/chunks/BQ5JugpM.js", "_app/immutable/chunks/B90Er9NH.js", "_app/immutable/chunks/HclGiUj8.js", "_app/immutable/chunks/LlbaMzKX.js", "_app/immutable/chunks/D5mC9s7c.js", "_app/immutable/chunks/CiSxC57J.js", "_app/immutable/chunks/N8DLpoKl.js", "_app/immutable/chunks/BNBsMhO5.js", "_app/immutable/chunks/Cn48AJiV.js", "_app/immutable/chunks/COo21xW_.js", "_app/immutable/chunks/CAMS0kRz.js"];
    stylesheets10 = [];
    fonts10 = [];
  }
});

// .svelte-kit/output/server/entries/pages/live/session/_id_/_page.server.ts.js
var page_server_ts_exports9 = {};
__export(page_server_ts_exports9, {
  load: () => load10
});
var load10;
var init_page_server_ts9 = __esm({
  ".svelte-kit/output/server/entries/pages/live/session/_id_/_page.server.ts.js"() {
    init_api();
    init_exports();
    load10 = /* @__PURE__ */ __name(async ({ params, locals }) => {
      const response = await locals.kondisFetch(apiUrl(`api/v1/live-workouts/${params.id}`));
      if (!response.ok) throw error(response.status, "Live workout not found.");
      return { workout: await response.json() };
    }, "load");
  }
});

// .svelte-kit/output/server/entries/pages/live/session/_id_/_page.svelte.js
var page_svelte_exports8 = {};
__export(page_svelte_exports8, {
  default: () => _page8
});
function _page8($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    head("fiakjq", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>${escape_html(t2("live_workout"))} \xB7 Kondis</title>`);
      });
    });
    $$renderer2.push(`<div class="page-shell">`);
    LiveWorkoutView($$renderer2, {
      workout: data.workout,
      endpoint: `/api/v1/live-workouts/${data.workout.id}`,
      activityTypes: data.activityTypes,
      unitSystem: data.unitSystem,
      allowSharing: data.workout.canShare
    });
    $$renderer2.push(`<!----></div>`);
  });
}
var init_page_svelte8 = __esm({
  ".svelte-kit/output/server/entries/pages/live/session/_id_/_page.svelte.js"() {
    init_server();
    init_LiveWorkoutView();
    init_i18n();
    __name(_page8, "_page");
  }
});

// .svelte-kit/output/server/nodes/10.js
var __exports11 = {};
__export(__exports11, {
  component: () => component10,
  fonts: () => fonts11,
  imports: () => imports11,
  index: () => index11,
  server: () => page_server_ts_exports9,
  server_id: () => server_id10,
  stylesheets: () => stylesheets11
});
var index11, component_cache10, component10, server_id10, imports11, stylesheets11, fonts11;
var init__11 = __esm({
  ".svelte-kit/output/server/nodes/10.js"() {
    init_page_server_ts9();
    index11 = 10;
    component10 = /* @__PURE__ */ __name(async () => component_cache10 ??= (await Promise.resolve().then(() => (init_page_svelte8(), page_svelte_exports8))).default, "component");
    server_id10 = "src/routes/live/session/[id]/+page.server.ts";
    imports11 = ["_app/immutable/nodes/10.DCpl0Sh4.js", "_app/immutable/chunks/TqmLiPd2.js", "_app/immutable/chunks/xihTtKlq.js", "_app/immutable/chunks/BQ5JugpM.js", "_app/immutable/chunks/B90Er9NH.js", "_app/immutable/chunks/HclGiUj8.js", "_app/immutable/chunks/LlbaMzKX.js", "_app/immutable/chunks/D5mC9s7c.js", "_app/immutable/chunks/CiSxC57J.js", "_app/immutable/chunks/N8DLpoKl.js", "_app/immutable/chunks/BNBsMhO5.js", "_app/immutable/chunks/Cn48AJiV.js", "_app/immutable/chunks/COo21xW_.js", "_app/immutable/chunks/CAMS0kRz.js"];
    stylesheets11 = [];
    fonts11 = [];
  }
});

// .svelte-kit/output/server/entries/pages/login/_page.server.ts.js
var page_server_ts_exports10 = {};
__export(page_server_ts_exports10, {
  actions: () => actions,
  load: () => load11
});
var load11, actions;
var init_page_server_ts10 = __esm({
  ".svelte-kit/output/server/entries/pages/login/_page.server.ts.js"() {
    init_api();
    init_exports();
    load11 = /* @__PURE__ */ __name(async ({ locals }) => {
      const response = await locals.kondisFetch(apiUrl("api/v1/auth/setup"));
      const status = response.ok ? await response.json() : {
        setupRequired: false,
        registrationEnabled: false
      };
      if (status.setupRequired) throw redirect(303, "/setup");
      return {
        setupRequired: false,
        registrationEnabled: status.registrationEnabled
      };
    }, "load");
    actions = { login: /* @__PURE__ */ __name(async ({ request, cookies, fetch: fetch2 }) => {
      const form = await request.formData();
      const response = await fetch2("/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password")
        })
      });
      if (!response.ok) return fail(400, { error: "Invalid email or password" });
      const result = await response.json();
      cookies.set("kondis_session", result.accessToken, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        maxAge: 2592e3
      });
      throw redirect(303, "/");
    }, "login") };
  }
});

// .svelte-kit/output/server/entries/pages/login/_page.svelte.js
var page_svelte_exports9 = {};
__export(page_svelte_exports9, {
  default: () => _page9
});
function _page9($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data, form } = $$props;
    head("1x05zx6", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>${escape_html(t2("auth_sign_in"))} \xB7 Kondis</title>`);
      });
    });
    $$renderer2.push(`<main class="auth-page"><section><h1>Kondis ${escape_html(t2("auth_sign_in"))} \u{1F630}</h1> <form method="POST" action="?/login"><label>${escape_html(t2("email"))}<input required="" type="email" name="email" autocomplete="email"/></label> <label>${escape_html(t2("password"))}<input required="" type="password" name="password" autocomplete="current-password"/></label>`);
    if (form?.error) $$renderer2.push(`<!--[0--><p class="error">${escape_html(form.error)}</p>`);
    else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--><button>${escape_html(t2("auth_sign_in"))}</button></form> `);
    if (data.registrationEnabled) $$renderer2.push(`<!--[0--><p class="auth-switch">${escape_html(t2("dont_have_account"))} <a href="/register">${escape_html(t2("create_one"))}</a></p>`);
    else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--></section></main>`);
  });
}
var init_page_svelte9 = __esm({
  ".svelte-kit/output/server/entries/pages/login/_page.svelte.js"() {
    init_server();
    init_i18n();
    __name(_page9, "_page");
  }
});

// .svelte-kit/output/server/nodes/11.js
var __exports12 = {};
__export(__exports12, {
  component: () => component11,
  fonts: () => fonts12,
  imports: () => imports12,
  index: () => index12,
  server: () => page_server_ts_exports10,
  server_id: () => server_id11,
  stylesheets: () => stylesheets12
});
var index12, component_cache11, component11, server_id11, imports12, stylesheets12, fonts12;
var init__12 = __esm({
  ".svelte-kit/output/server/nodes/11.js"() {
    init_page_server_ts10();
    index12 = 11;
    component11 = /* @__PURE__ */ __name(async () => component_cache11 ??= (await Promise.resolve().then(() => (init_page_svelte9(), page_svelte_exports9))).default, "component");
    server_id11 = "src/routes/login/+page.server.ts";
    imports12 = ["_app/immutable/nodes/11.5Gk4BrJV.js", "_app/immutable/chunks/TqmLiPd2.js", "_app/immutable/chunks/xihTtKlq.js", "_app/immutable/chunks/COo21xW_.js"];
    stylesheets12 = [];
    fonts12 = [];
  }
});

// .svelte-kit/output/server/entries/pages/notifications/_page.svelte.js
var page_svelte_exports10 = {};
__export(page_svelte_exports10, {
  default: () => _page10
});
function _page10($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    head("1ce0uvz", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>${escape_html(t2("notifications"))} \xB7 Kondis</title>`);
      });
    });
    $$renderer2.push(`<div class="page-shell notifications-page"><header class="page-header"><div><h1>${escape_html(t2("notifications"))}</h1> <p>${escape_html(t2("see_latest_reactions"))}</p></div></header> `);
    $$renderer2.push(`<!--[0--><p class="muted-copy">${escape_html(t2("loading"))}</p>`);
    $$renderer2.push(`<!--]--></div>`);
  });
}
var init_page_svelte10 = __esm({
  ".svelte-kit/output/server/entries/pages/notifications/_page.svelte.js"() {
    init_index_server();
    init_server();
    init_notifications();
    init_i18n();
    init_user_name();
    init_build();
    init_api2();
    init_format();
    init_realtime();
    __name(_page10, "_page");
  }
});

// .svelte-kit/output/server/nodes/12.js
var __exports13 = {};
__export(__exports13, {
  component: () => component12,
  fonts: () => fonts13,
  imports: () => imports13,
  index: () => index13,
  stylesheets: () => stylesheets13
});
var index13, component_cache12, component12, imports13, stylesheets13, fonts13;
var init__13 = __esm({
  ".svelte-kit/output/server/nodes/12.js"() {
    index13 = 12;
    component12 = /* @__PURE__ */ __name(async () => component_cache12 ??= (await Promise.resolve().then(() => (init_page_svelte10(), page_svelte_exports10))).default, "component");
    imports13 = ["_app/immutable/nodes/12.CWqZqKyW.js", "_app/immutable/chunks/TqmLiPd2.js", "_app/immutable/chunks/xihTtKlq.js", "_app/immutable/chunks/IqFp0kpg.js", "_app/immutable/chunks/D5mC9s7c.js", "_app/immutable/chunks/CL7EZexq.js", "_app/immutable/chunks/COo21xW_.js", "_app/immutable/chunks/BNBsMhO5.js", "_app/immutable/chunks/CAMS0kRz.js", "_app/immutable/chunks/B4Kzzj8V.js"];
    stylesheets13 = [];
    fonts13 = [];
  }
});

// .svelte-kit/output/server/chunks/user-round.js
function User_round($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "user-round" },
    props,
    { iconNode: [["circle", {
      "cx": "12",
      "cy": "8",
      "r": "5"
    }], ["path", { "d": "M20 21a8 8 0 0 0-16 0" }]] }
  ]));
}
var init_user_round = __esm({
  ".svelte-kit/output/server/chunks/user-round.js"() {
    init_server();
    init_Icon();
    __name(User_round, "User_round");
  }
});

// .svelte-kit/output/server/entries/pages/people/_page.svelte.js
var page_svelte_exports11 = {};
__export(page_svelte_exports11, {
  default: () => _page11
});
function User_plus($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "user-plus" },
    props,
    { iconNode: [
      ["path", { "d": "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" }],
      ["circle", {
        "cx": "9",
        "cy": "7",
        "r": "4"
      }],
      ["line", {
        "x1": "19",
        "x2": "19",
        "y1": "8",
        "y2": "14"
      }],
      ["line", {
        "x1": "22",
        "x2": "16",
        "y1": "11",
        "y2": "11"
      }]
    ] }
  ]));
}
function _page11($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let query = "";
    let people = [];
    head("1403ju0", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>${escape_html(t2("people"))} \xB7 Kondis</title>`);
      });
    });
    $$renderer2.push(`<div class="page-shell"><header class="page-header"><div><span class="eyebrow">${escape_html(t2("social"))}</span> <h1>${escape_html(t2("people"))}</h1> <p>${escape_html(t2("follow_athletes_description"))}</p></div> <button class="metadata-save" type="button">`);
    User_plus($$renderer2, { size: 16 });
    $$renderer2.push(`<!----> ${escape_html(t2("requests"))}</button></header> `);
    $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--> <form class="search" role="search">`);
    User_round($$renderer2, { size: 18 });
    $$renderer2.push(`<!----><input${attr("value", query)}${attr("placeholder", t2("search_by_name"))}${attr("aria-label", t2("search_people"))}/><button type="submit">${escape_html(t2("search"))}</button></form> `);
    $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--> <section class="people-list"${attr("aria-label", t2("people"))}><!--[-->`);
    const each_array_1 = ensure_array_like(people);
    for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
      let person = each_array_1[$$index_1];
      $$renderer2.push(`<article class="person-row">`);
      UserAvatar($$renderer2, {
        name: userDisplayName(person.user),
        src: person.user.avatarUrl,
        size: 42
      });
      $$renderer2.push(`<!----> <div class="person-copy"><a${attr("href", `/people/${person.user.id}`)}><strong>${escape_html(userDisplayName(person.user))}</strong></a></div> <button class="metadata-save" type="button"${attr("disabled", person.relation.blockedViewer || person.relation.blockedByViewer, true)}>${escape_html(person.relation.following ? t2("following") : person.relation.outgoingRequest ? t2("requested") : t2("follow"))}</button></article>`);
    }
    $$renderer2.push(`<!--]--> `);
    if (people.length === 0) $$renderer2.push(`<!--[0--><div class="empty-state"><h2>${escape_html(t2("no_people_found"))}</h2> <p>${escape_html(t2("try_different_name"))}</p></div>`);
    else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--></section></div>`);
  });
}
var init_page_svelte11 = __esm({
  ".svelte-kit/output/server/entries/pages/people/_page.svelte.js"() {
    init_server();
    init_Icon();
    init_user_round();
    init_i18n();
    init_user_name();
    init_api2();
    __name(User_plus, "User_plus");
    __name(_page11, "_page");
  }
});

// .svelte-kit/output/server/nodes/13.js
var __exports14 = {};
__export(__exports14, {
  component: () => component13,
  fonts: () => fonts14,
  imports: () => imports14,
  index: () => index14,
  stylesheets: () => stylesheets14
});
var index14, component_cache13, component13, imports14, stylesheets14, fonts14;
var init__14 = __esm({
  ".svelte-kit/output/server/nodes/13.js"() {
    index14 = 13;
    component13 = /* @__PURE__ */ __name(async () => component_cache13 ??= (await Promise.resolve().then(() => (init_page_svelte11(), page_svelte_exports11))).default, "component");
    imports14 = ["_app/immutable/nodes/13.CeIfH2xk.js", "_app/immutable/chunks/TqmLiPd2.js", "_app/immutable/chunks/xihTtKlq.js", "_app/immutable/chunks/BBC-ssYl.js", "_app/immutable/chunks/D5mC9s7c.js", "_app/immutable/chunks/DHOCbZqx.js", "_app/immutable/chunks/DRq90YW4.js", "_app/immutable/chunks/CBfwGKJV.js", "_app/immutable/chunks/COo21xW_.js", "_app/immutable/chunks/CL7EZexq.js", "_app/immutable/chunks/BNBsMhO5.js"];
    stylesheets14 = [];
    fonts14 = [];
  }
});

// .svelte-kit/output/server/entries/pages/people/_id_/_page.svelte.js
var page_svelte_exports12 = {};
__export(page_svelte_exports12, {
  default: () => _page12
});
function _page12($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    derived(() => false);
    head("1wogyn4", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>${escape_html(`${t2("profile")} \xB7 Kondis`)}</title>`);
      });
    });
    $$renderer2.push(`<div class="page-shell">`);
    $$renderer2.push(`<!--[0--><p class="muted-copy">${escape_html(t2("loading_profile"))}</p>`);
    $$renderer2.push(`<!--]--></div>`);
  });
}
var init_page_svelte12 = __esm({
  ".svelte-kit/output/server/entries/pages/people/_id_/_page.svelte.js"() {
    init_server();
    init_ActivityCard();
    init_state();
    init_i18n();
    init_user_name();
    init_api2();
    __name(_page12, "_page");
  }
});

// .svelte-kit/output/server/nodes/14.js
var __exports15 = {};
__export(__exports15, {
  component: () => component14,
  fonts: () => fonts15,
  imports: () => imports15,
  index: () => index15,
  stylesheets: () => stylesheets15
});
var index15, component_cache14, component14, imports15, stylesheets15, fonts15;
var init__15 = __esm({
  ".svelte-kit/output/server/nodes/14.js"() {
    index15 = 14;
    component14 = /* @__PURE__ */ __name(async () => component_cache14 ??= (await Promise.resolve().then(() => (init_page_svelte12(), page_svelte_exports12))).default, "component");
    imports15 = ["_app/immutable/nodes/14.Cnq2qNWL.js", "_app/immutable/chunks/TqmLiPd2.js", "_app/immutable/chunks/xihTtKlq.js", "_app/immutable/chunks/D5mC9s7c.js", "_app/immutable/chunks/DOWdbKEB.js", "_app/immutable/chunks/B90Er9NH.js", "_app/immutable/chunks/LlbaMzKX.js", "_app/immutable/chunks/BpqxhcYW.js", "_app/immutable/chunks/N8DLpoKl.js", "_app/immutable/chunks/BNBsMhO5.js", "_app/immutable/chunks/jeJNHXOu.js", "_app/immutable/chunks/HclGiUj8.js", "_app/immutable/chunks/COo21xW_.js", "_app/immutable/chunks/BNDfWvQn.js", "_app/immutable/chunks/CL7EZexq.js", "_app/immutable/chunks/CAMS0kRz.js", "_app/immutable/chunks/CtcJAU9W.js", "_app/immutable/chunks/DHOCbZqx.js", "_app/immutable/chunks/DnWgfvLw.js"];
    stylesheets15 = [];
    fonts15 = [];
  }
});

// .svelte-kit/output/server/entries/pages/register/_page.server.ts.js
var page_server_ts_exports11 = {};
__export(page_server_ts_exports11, {
  actions: () => actions2,
  load: () => load12
});
var load12, actions2;
var init_page_server_ts11 = __esm({
  ".svelte-kit/output/server/entries/pages/register/_page.server.ts.js"() {
    init_api();
    init_exports();
    load12 = /* @__PURE__ */ __name(async ({ locals }) => {
      const response = await locals.kondisFetch(apiUrl("api/v1/auth/setup"));
      if (!response.ok || !(await response.json()).registrationEnabled) throw redirect(303, "/login");
      return {};
    }, "load");
    actions2 = { register: /* @__PURE__ */ __name(async ({ request, cookies, fetch: fetch2, url }) => {
      const form = await request.formData();
      const firstName = String(form.get("firstName") ?? "");
      const lastName = String(form.get("lastName") ?? "");
      const email = String(form.get("email") ?? "");
      const password = String(form.get("password") ?? "");
      const confirmPassword = String(form.get("confirmPassword") ?? "");
      const values = {
        firstName,
        lastName,
        email
      };
      if (password !== confirmPassword) return fail(400, {
        ...values,
        error: "Passwords do not match."
      });
      const response = await fetch2("/api/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          password
        })
      });
      if (!response.ok) return fail(400, {
        ...values,
        error: "Use first and last names, a valid email, and a password of at least 10 characters."
      });
      const result = await response.json();
      cookies.set("kondis_session", result.accessToken, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: url.protocol === "https:",
        maxAge: 2592e3
      });
      throw redirect(303, "/");
    }, "register") };
  }
});

// .svelte-kit/output/server/entries/pages/register/_page.svelte.js
var page_svelte_exports13 = {};
__export(page_svelte_exports13, {
  default: () => _page13
});
function _page13($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { form } = $$props;
    head("52fghe", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>${escape_html(t2("auth_create_account"))} \xB7 Kondis</title>`);
      });
    });
    $$renderer2.push(`<main class="auth-page"><section><h1>${escape_html(t2("create_your_account"))}</h1> <form method="POST" action="?/register"><label>${escape_html(t2("first_name"))}<input required="" name="firstName" autocomplete="given-name"${attr("value", form?.firstName ?? "")}/></label><label>${escape_html(t2("last_name"))}<input required="" name="lastName" autocomplete="family-name"${attr("value", form?.lastName ?? "")}/></label><label>${escape_html(t2("email"))}<input required="" type="email" name="email" autocomplete="email"${attr("value", form?.email ?? "")}/></label><label>${escape_html(t2("password"))}<input required="" minlength="10" type="password" name="password" autocomplete="new-password"/></label><label>${escape_html(t2("confirm_password"))}<input required="" minlength="10" type="password" name="confirmPassword" autocomplete="new-password"/></label>`);
    if (form?.error) $$renderer2.push(`<!--[0--><p class="error">${escape_html(form.error)}</p>`);
    else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--><button>${escape_html(t2("auth_create_account"))}</button></form> <p class="auth-switch">${escape_html(t2("already_have_account"))} <a href="/login">${escape_html(t2("auth_sign_in"))}</a></p></section></main>`);
  });
}
var init_page_svelte13 = __esm({
  ".svelte-kit/output/server/entries/pages/register/_page.svelte.js"() {
    init_server();
    init_i18n();
    __name(_page13, "_page");
  }
});

// .svelte-kit/output/server/nodes/15.js
var __exports16 = {};
__export(__exports16, {
  component: () => component15,
  fonts: () => fonts16,
  imports: () => imports16,
  index: () => index16,
  server: () => page_server_ts_exports11,
  server_id: () => server_id12,
  stylesheets: () => stylesheets16
});
var index16, component_cache15, component15, server_id12, imports16, stylesheets16, fonts16;
var init__16 = __esm({
  ".svelte-kit/output/server/nodes/15.js"() {
    init_page_server_ts11();
    index16 = 15;
    component15 = /* @__PURE__ */ __name(async () => component_cache15 ??= (await Promise.resolve().then(() => (init_page_svelte13(), page_svelte_exports13))).default, "component");
    server_id12 = "src/routes/register/+page.server.ts";
    imports16 = ["_app/immutable/nodes/15.B1dH7JXc.js", "_app/immutable/chunks/TqmLiPd2.js", "_app/immutable/chunks/xihTtKlq.js", "_app/immutable/chunks/COo21xW_.js"];
    stylesheets16 = [];
    fonts16 = [];
  }
});

// .svelte-kit/output/server/entries/pages/settings/_page.server.ts.js
var page_server_ts_exports12 = {};
__export(page_server_ts_exports12, {
  actions: () => actions3
});
var ONE_YEAR_SECONDS, actions3;
var init_page_server_ts12 = __esm({
  ".svelte-kit/output/server/entries/pages/settings/_page.server.ts.js"() {
    init_units();
    init_exports();
    ONE_YEAR_SECONDS = 31536e3;
    actions3 = { default: /* @__PURE__ */ __name(async ({ cookies, request, url }) => {
      const formData = await request.formData();
      const unitSystem = parseUnitSystem(formData.get("unitSystem"));
      if (!unitSystem) return fail(400, { error: "Choose metric or imperial units." });
      cookies.set(UNIT_SYSTEM_COOKIE, unitSystem, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: url.protocol === "https:",
        maxAge: ONE_YEAR_SECONDS
      });
      return { saved: true };
    }, "default") };
  }
});

// .svelte-kit/output/server/chunks/check.js
function Check($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "check" },
    props,
    { iconNode: [["path", { "d": "M20 6 9 17l-5-5" }]] }
  ]));
}
var init_check = __esm({
  ".svelte-kit/output/server/chunks/check.js"() {
    init_server();
    init_Icon();
    __name(Check, "Check");
  }
});

// .svelte-kit/output/server/entries/pages/settings/_page.svelte.js
var page_svelte_exports14 = {};
__export(page_svelte_exports14, {
  default: () => _page14
});
function Camera($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "camera" },
    props,
    { iconNode: [["path", { "d": "M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z" }], ["circle", {
      "cx": "12",
      "cy": "13",
      "r": "3"
    }]] }
  ]));
}
function Ruler($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "ruler" },
    props,
    { iconNode: [
      ["path", { "d": "M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z" }],
      ["path", { "d": "m14.5 12.5 2-2" }],
      ["path", { "d": "m11.5 9.5 2-2" }],
      ["path", { "d": "m8.5 6.5 2-2" }],
      ["path", { "d": "m17.5 15.5 2-2" }]
    ] }
  ]));
}
function _page14($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data, form } = $$props;
    let selected = run(() => data.unitSystem);
    let avatarUrl = run(() => data.user?.avatarUrl ?? null);
    let avatarBusy = false;
    let firstName = run(() => data.user?.firstName ?? "");
    let lastName = run(() => data.user?.lastName ?? "");
    head("1i19ct2", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>${escape_html(t2("settings"))} \xB7 Kondis</title>`);
      });
    });
    $$renderer2.push(`<div class="page-shell settings-page"><header class="page-header"><div><h1>${escape_html(t2("settings"))}</h1> <p>${escape_html(t2("choose_activity_display"))}</p></div></header> <section class="settings-panel name-panel"><div class="settings-heading"><span class="settings-icon">`);
    User_round($$renderer2, { size: 21 });
    $$renderer2.push(`<!----></span> <div><h2>${escape_html(t2("your_name"))}</h2> <p>${escape_html(t2("name_description"))}</p></div></div> <div class="settings-name-fields"><label class="settings-field"><span>${escape_html(t2("first_name"))}</span> <input${attr("value", firstName)} maxlength="80" autocomplete="given-name"/></label> <label class="settings-field"><span>${escape_html(t2("last_name"))}</span> <input${attr("value", lastName)} maxlength="80" autocomplete="family-name"/></label></div> <div class="settings-actions"><button type="button"${attr("disabled", !firstName.trim() || !lastName.trim(), true)}>`);
    Check($$renderer2, { size: 17 });
    $$renderer2.push(`<!----> ${escape_html(t2("save_name"))}</button> `);
    $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--></div></section> <section class="settings-panel profile-picture-panel"><div class="settings-heading">`);
    UserAvatar($$renderer2, {
      name: data.user ? userDisplayName(data.user) : t2("you"),
      src: avatarUrl,
      size: 72
    });
    $$renderer2.push(`<!----> <div><h2>${escape_html(t2("profile_picture"))}</h2> <p>${escape_html(t2("profile_picture_description"))}</p></div></div> <div class="settings-actions"><label class="metadata-save profile-picture-upload">`);
    Camera($$renderer2, { size: 17 });
    $$renderer2.push(`<!----> ${escape_html(t2("choose_picture"))} <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/avif"${attr("disabled", avatarBusy, true)}/></label> `);
    if (avatarUrl) {
      $$renderer2.push(`<!--[0--><button class="metadata-cancel" type="button"${attr("disabled", avatarBusy, true)}>`);
      Trash_2($$renderer2, { size: 17 });
      $$renderer2.push(`<!----> ${escape_html(t2("remove"))}</button>`);
    } else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--></div> `);
    $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--></section> <form method="POST" class="settings-panel"><div class="settings-heading"><span class="settings-icon">`);
    Ruler($$renderer2, { size: 21 });
    $$renderer2.push(`<!----></span> <div><h2>${escape_html(t2("units_of_measurement"))}</h2></div></div> <fieldset class="unit-options"><legend>${escape_html(t2("display_units"))}</legend> <label${attr_class("", void 0, { "selected": selected === "metric" })}><input type="radio" name="unitSystem" value="metric"${attr("checked", selected === "metric", true)}/> <span><strong>${escape_html(t2("metric"))}</strong></span> `);
    if (selected === "metric") {
      $$renderer2.push("<!--[0-->");
      Check($$renderer2, { size: 19 });
    } else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--></label> <label${attr_class("", void 0, { "selected": selected === "imperial" })}><input type="radio" name="unitSystem" value="imperial"${attr("checked", selected === "imperial", true)}/> <span><strong>${escape_html(t2("imperial"))}</strong></span> `);
    if (selected === "imperial") {
      $$renderer2.push("<!--[0-->");
      Check($$renderer2, { size: 19 });
    } else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--></label></fieldset> <div class="settings-actions"><button type="submit">`);
    Gauge($$renderer2, { size: 17 });
    $$renderer2.push(`<!----> ${escape_html(t2("save_preference"))}</button> `);
    if (form?.saved) {
      $$renderer2.push(`<!--[0--><span class="settings-saved" role="status">`);
      Check($$renderer2, { size: 16 });
      $$renderer2.push(`<!----> ${escape_html(t2("saved"))}</span>`);
    } else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--> `);
    if (form?.error) $$renderer2.push(`<!--[0--><span class="settings-error" role="alert">${escape_html(form.error)}</span>`);
    else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--></div></form></div>`);
  });
}
var init_page_svelte14 = __esm({
  ".svelte-kit/output/server/entries/pages/settings/_page.svelte.js"() {
    init_index_server();
    init_server();
    init_Icon();
    init_check();
    init_trash_2();
    init_user_round();
    init_i18n();
    init_user_name();
    __name(Camera, "Camera");
    __name(Ruler, "Ruler");
    __name(_page14, "_page");
  }
});

// .svelte-kit/output/server/nodes/16.js
var __exports17 = {};
__export(__exports17, {
  component: () => component16,
  fonts: () => fonts17,
  imports: () => imports17,
  index: () => index17,
  server: () => page_server_ts_exports12,
  server_id: () => server_id13,
  stylesheets: () => stylesheets17
});
var index17, component_cache16, component16, server_id13, imports17, stylesheets17, fonts17;
var init__17 = __esm({
  ".svelte-kit/output/server/nodes/16.js"() {
    init_page_server_ts12();
    index17 = 16;
    component16 = /* @__PURE__ */ __name(async () => component_cache16 ??= (await Promise.resolve().then(() => (init_page_svelte14(), page_svelte_exports14))).default, "component");
    server_id13 = "src/routes/settings/+page.server.ts";
    imports17 = ["_app/immutable/nodes/16.B4Hq16LW.js", "_app/immutable/chunks/TqmLiPd2.js", "_app/immutable/chunks/xihTtKlq.js", "_app/immutable/chunks/D5mC9s7c.js", "_app/immutable/chunks/BBC-ssYl.js", "_app/immutable/chunks/CiGyI8Qn.js", "_app/immutable/chunks/DRq90YW4.js", "_app/immutable/chunks/COo21xW_.js", "_app/immutable/chunks/CL7EZexq.js"];
    stylesheets17 = [];
    fonts17 = [];
  }
});

// .svelte-kit/output/server/entries/pages/setup/_page.server.ts.js
var page_server_ts_exports13 = {};
__export(page_server_ts_exports13, {
  actions: () => actions4,
  load: () => load13
});
var load13, actions4;
var init_page_server_ts13 = __esm({
  ".svelte-kit/output/server/entries/pages/setup/_page.server.ts.js"() {
    init_api();
    init_exports();
    load13 = /* @__PURE__ */ __name(async ({ locals }) => {
      const response = await locals.kondisFetch(apiUrl("api/v1/auth/setup"), { cache: "no-store" });
      if (!response.ok || !(await response.json()).setupRequired) throw redirect(303, "/login");
      return {};
    }, "load");
    actions4 = { verify: /* @__PURE__ */ __name(async ({ request, cookies, fetch: fetch2 }) => {
      const form = await request.formData();
      const setupToken = String(form.get("setupToken") ?? "");
      const response = await fetch2("/api/v1/auth/setup/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ setupToken })
      });
      if (!response.ok) {
        const error2 = response.status === 429 ? "Too many attempts. Please wait a minute and try again." : "That setup token is not valid.";
        return fail(400, { error: error2 });
      }
      const result = await response.json();
      cookies.set("kondis_setup_ticket", result.token, {
        path: "/",
        httpOnly: true,
        sameSite: "strict",
        secure: true,
        maxAge: 600
      });
      throw redirect(303, "/setup/account");
    }, "verify") };
  }
});

// .svelte-kit/output/server/entries/pages/setup/_page.svelte.js
var page_svelte_exports15 = {};
__export(page_svelte_exports15, {
  default: () => _page15
});
function _page15($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { form } = $$props;
    head("g40i6i", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>${escape_html(t2("welcome_to_kondis"))}</title>`);
      });
    });
    $$renderer2.push(`<main class="auth-page"><section><h1>${escape_html(t2("welcome_to_kondis"))} \u{1F630}</h1> <p>${escape_html(t2("setup_token_description"))}</p> <form method="POST" action="?/verify"><label>${escape_html(t2("setup_token"))}<input required="" type="password" name="setupToken" autocomplete="off"/></label>`);
    if (form?.error) $$renderer2.push(`<!--[0--><p class="error">${escape_html(form.error)}</p>`);
    else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--><button>${escape_html(t2("common_confirm"))}</button></form></section></main>`);
  });
}
var init_page_svelte15 = __esm({
  ".svelte-kit/output/server/entries/pages/setup/_page.svelte.js"() {
    init_server();
    init_i18n();
    __name(_page15, "_page");
  }
});

// .svelte-kit/output/server/nodes/17.js
var __exports18 = {};
__export(__exports18, {
  component: () => component17,
  fonts: () => fonts18,
  imports: () => imports18,
  index: () => index18,
  server: () => page_server_ts_exports13,
  server_id: () => server_id14,
  stylesheets: () => stylesheets18
});
var index18, component_cache17, component17, server_id14, imports18, stylesheets18, fonts18;
var init__18 = __esm({
  ".svelte-kit/output/server/nodes/17.js"() {
    init_page_server_ts13();
    index18 = 17;
    component17 = /* @__PURE__ */ __name(async () => component_cache17 ??= (await Promise.resolve().then(() => (init_page_svelte15(), page_svelte_exports15))).default, "component");
    server_id14 = "src/routes/setup/+page.server.ts";
    imports18 = ["_app/immutable/nodes/17.BigNFapW.js", "_app/immutable/chunks/TqmLiPd2.js", "_app/immutable/chunks/xihTtKlq.js", "_app/immutable/chunks/COo21xW_.js"];
    stylesheets18 = [];
    fonts18 = [];
  }
});

// .svelte-kit/output/server/entries/pages/setup/account/_page.server.ts.js
var page_server_ts_exports14 = {};
__export(page_server_ts_exports14, {
  actions: () => actions5,
  load: () => load14
});
var SETUP_TICKET_COOKIE, load14, actions5;
var init_page_server_ts14 = __esm({
  ".svelte-kit/output/server/entries/pages/setup/account/_page.server.ts.js"() {
    init_api();
    init_exports();
    SETUP_TICKET_COOKIE = "kondis_setup_ticket";
    load14 = /* @__PURE__ */ __name(async ({ cookies, locals }) => {
      const response = await locals.kondisFetch(apiUrl("api/v1/auth/setup"), { cache: "no-store" });
      if (!response.ok || !(await response.json()).setupRequired) throw redirect(303, "/login");
      const setupTicket = cookies.get(SETUP_TICKET_COOKIE);
      if (!setupTicket) throw redirect(303, "/setup");
      if (!(await locals.kondisFetch(apiUrl("api/v1/auth/setup/validate"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ setupTicket }),
        cache: "no-store"
      })).ok) {
        cookies.delete(SETUP_TICKET_COOKIE, { path: "/" });
        throw redirect(303, "/setup");
      }
      return {};
    }, "load");
    actions5 = { setup: /* @__PURE__ */ __name(async ({ request, cookies, fetch: fetch2 }) => {
      const form = await request.formData();
      const firstName = String(form.get("firstName") ?? "");
      const lastName = String(form.get("lastName") ?? "");
      const email = String(form.get("email") ?? "");
      const password = String(form.get("password") ?? "");
      const confirmPassword = String(form.get("confirmPassword") ?? "");
      const values = {
        firstName,
        lastName,
        email
      };
      if (password !== confirmPassword) return fail(400, {
        ...values,
        error: "Passwords do not match."
      });
      const response = await fetch2("/api/v1/auth/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          password,
          setupTicket: cookies.get(SETUP_TICKET_COOKIE)
        })
      });
      if (!response.ok) {
        cookies.delete(SETUP_TICKET_COOKIE, { path: "/" });
        return fail(400, {
          ...values,
          error: "Your verification expired. Enter the setup token again."
        });
      }
      const result = await response.json();
      cookies.delete(SETUP_TICKET_COOKIE, { path: "/" });
      cookies.set("kondis_session", result.accessToken, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        maxAge: 2592e3
      });
      throw redirect(303, "/");
    }, "setup") };
  }
});

// .svelte-kit/output/server/entries/pages/setup/account/_page.svelte.js
var page_svelte_exports16 = {};
__export(page_svelte_exports16, {
  default: () => _page16
});
function _page16($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { form } = $$props;
    head("1c5ay82", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>${escape_html(t2("create_kondis_account"))}</title>`);
      });
    });
    $$renderer2.push(`<main class="auth-page"><section><h1>${escape_html(t2("create_your_account"))}</h1> <p>${escape_html(t2("setup_token_verified"))}</p> <form method="POST" action="?/setup"><label>${escape_html(t2("first_name"))}<input required="" name="firstName" autocomplete="given-name"${attr("value", form?.firstName ?? "")}/></label> <label>${escape_html(t2("last_name"))}<input required="" name="lastName" autocomplete="family-name"${attr("value", form?.lastName ?? "")}/></label> <label>${escape_html(t2("email"))}<input required="" type="email" name="email" autocomplete="email"${attr("value", form?.email ?? "")}/></label> <label>${escape_html(t2("password"))}<input required="" minlength="10" type="password" name="password" autocomplete="new-password"/></label> <label>${escape_html(t2("confirm_password"))}<input required="" minlength="10" type="password" name="confirmPassword" autocomplete="new-password"/></label> `);
    if (form?.error) $$renderer2.push(`<!--[0--><p class="error">${escape_html(form.error)}</p>`);
    else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--> <button>${escape_html(t2("set_up"))}</button></form></section></main>`);
  });
}
var init_page_svelte16 = __esm({
  ".svelte-kit/output/server/entries/pages/setup/account/_page.svelte.js"() {
    init_server();
    init_i18n();
    __name(_page16, "_page");
  }
});

// .svelte-kit/output/server/nodes/18.js
var __exports19 = {};
__export(__exports19, {
  component: () => component18,
  fonts: () => fonts19,
  imports: () => imports19,
  index: () => index19,
  server: () => page_server_ts_exports14,
  server_id: () => server_id15,
  stylesheets: () => stylesheets19
});
var index19, component_cache18, component18, server_id15, imports19, stylesheets19, fonts19;
var init__19 = __esm({
  ".svelte-kit/output/server/nodes/18.js"() {
    init_page_server_ts14();
    index19 = 18;
    component18 = /* @__PURE__ */ __name(async () => component_cache18 ??= (await Promise.resolve().then(() => (init_page_svelte16(), page_svelte_exports16))).default, "component");
    server_id15 = "src/routes/setup/account/+page.server.ts";
    imports19 = ["_app/immutable/nodes/18.B7eITvw9.js", "_app/immutable/chunks/TqmLiPd2.js", "_app/immutable/chunks/xihTtKlq.js", "_app/immutable/chunks/COo21xW_.js"];
    stylesheets19 = [];
    fonts19 = [];
  }
});

// .svelte-kit/output/server/entries/pages/upload/_page.svelte.js
var page_svelte_exports17 = {};
__export(page_svelte_exports17, {
  default: () => _page17
});
function _page17($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const choices = [{
      href: "/upload/activity",
      title: t2("individual_activity_file"),
      description: t2("upload_files"),
      icon: File_up
    }, {
      href: "/upload/strava",
      title: t2("strava_takeout"),
      description: t2("activity_import_strava_description"),
      icon: Archive
    }];
    head("tziouu", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>${escape_html(t2("upload_activity"))} \xB7 Kondis</title>`);
      });
    });
    $$renderer2.push(`<div class="page-shell upload-page"><header class="page-header"><div><span class="eyebrow">${escape_html(t2("new_import"))}</span> <h1>${escape_html(t2("upload_activity"))}</h1> <p>${escape_html(t2("upload_activity_page_description"))}</p></div></header> <div class="upload-choices"><!--[-->`);
    const each_array = ensure_array_like(choices);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let choice = each_array[$$index];
      $$renderer2.push(`<a class="upload-choice"${attr("href", choice.href)}><span class="upload-choice-icon">`);
      choice.icon($$renderer2, { size: 24 });
      $$renderer2.push(`<!----></span> <span class="upload-choice-copy"><strong>${escape_html(choice.title)}</strong> <small>${escape_html(choice.description)}</small></span> `);
      Arrow_right($$renderer2, {
        class: "upload-choice-arrow",
        size: 20
      });
      $$renderer2.push(`<!----></a>`);
    }
    $$renderer2.push(`<!--]--></div></div>`);
  });
}
var init_page_svelte17 = __esm({
  ".svelte-kit/output/server/entries/pages/upload/_page.svelte.js"() {
    init_server();
    init_archive();
    init_arrow_right();
    init_file_up();
    init_i18n();
    __name(_page17, "_page");
  }
});

// .svelte-kit/output/server/nodes/19.js
var __exports20 = {};
__export(__exports20, {
  component: () => component19,
  fonts: () => fonts20,
  imports: () => imports20,
  index: () => index20,
  stylesheets: () => stylesheets20
});
var index20, component_cache19, component19, imports20, stylesheets20, fonts20;
var init__20 = __esm({
  ".svelte-kit/output/server/nodes/19.js"() {
    index20 = 19;
    component19 = /* @__PURE__ */ __name(async () => component_cache19 ??= (await Promise.resolve().then(() => (init_page_svelte17(), page_svelte_exports17))).default, "component");
    imports20 = ["_app/immutable/nodes/19.Bv9DXq8W.js", "_app/immutable/chunks/TqmLiPd2.js", "_app/immutable/chunks/xihTtKlq.js", "_app/immutable/chunks/8ijIODKe.js", "_app/immutable/chunks/D5mC9s7c.js", "_app/immutable/chunks/Be0tUrl1.js", "_app/immutable/chunks/BcsRuf6u.js", "_app/immutable/chunks/COo21xW_.js", "_app/immutable/chunks/CEcIxoMy.js"];
    stylesheets20 = [];
    fonts20 = [];
  }
});

// .svelte-kit/output/server/entries/pages/upload/activity/_page.svelte.js
var page_svelte_exports18 = {};
__export(page_svelte_exports18, {
  default: () => _page18
});
function Loader_circle($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  Icon($$renderer, spread_props([
    { name: "loader-circle" },
    props,
    { iconNode: [["path", { "d": "M21 12a9 9 0 1 1-6.219-8.56" }]] }
  ]));
}
function UploadForm($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { eventsUrl } = $$props;
    let files = [];
    let dragging = false;
    $$renderer2.push(`<div class="upload-panel"><button class="upload-back" type="button">`);
    Arrow_left($$renderer2, { size: 17 });
    $$renderer2.push(`<!----> ${escape_html(t2("upload_activity"))}</button> <div class="upload-panel-heading"><span class="upload-choice-icon">`);
    File_up($$renderer2, { size: 24 });
    $$renderer2.push(`<!----></span> <div><h2>${escape_html(t2("upload_activity_file"))}</h2> <p>${escape_html(t2("upload_activity_description"))}</p></div></div> <button${attr_class("drop-zone", void 0, { "dragging": dragging })} type="button"${attr("disabled", false, true)}><span class="upload-icon">`);
    File_up($$renderer2, { size: 28 });
    $$renderer2.push(`<!----></span> <strong>${escape_html(t2("drop_activity_files"))}</strong> <span>${escape_html(t2("click_to_browse"))}</span> <small>.fit, .tcx, or .gpx</small></button> <input class="sr-only" type="file" accept=".fit,.tcx,.gpx" multiple=""${attr("disabled", false, true)}/> `);
    if (files.length) {
      $$renderer2.push(`<!--[0--><div class="upload-list"><!--[-->`);
      const each_array = ensure_array_like(files);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let item = each_array[$$index];
        $$renderer2.push(`<div class="upload-row"><span class="file-name">${escape_html(item.file.name)}<small>${escape_html((item.file.size / 1024).toFixed(0))} KB</small>`);
        if (item.activity) {
          $$renderer2.push(`<!--[0--><a class="activity-title"${attr("href", `/activities/${item.activity.id}`)}>${escape_html(activityName(item.activity))} `);
          Arrow_up_right($$renderer2, { size: 16 });
          $$renderer2.push(`<!----></a>`);
        } else $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<!--]--></span> `);
        if (item.status === "queued") {
          $$renderer2.push(`<!--[0--><span class="upload-file-status pending">`);
          Clock_3($$renderer2, { size: 16 });
          $$renderer2.push(`<!----> ${escape_html(t2("upload_queued"))}</span>`);
        } else if (item.status === "uploading") {
          $$renderer2.push(`<!--[1--><span class="upload-file-status">`);
          Loader_circle($$renderer2, {
            class: "spin",
            size: 16
          });
          $$renderer2.push(`<!----> ${escape_html(t2("uploading_activity"))}</span>`);
        } else if (item.status === "done") {
          $$renderer2.push(`<!--[2--><span class="upload-file-status">`);
          Check($$renderer2, {
            class: "success",
            size: 16
          });
          $$renderer2.push(`<!----> ${escape_html(t2("done"))}</span>`);
        } else if (item.status === "skipped") {
          $$renderer2.push(`<!--[3--><span class="upload-file-status pending">`);
          Circle_alert($$renderer2, { size: 16 });
          $$renderer2.push(`<!----> ${escape_html(t2("upload_skipped"))}</span>`);
        } else {
          $$renderer2.push(`<!--[-1--><span class="upload-file-status error">`);
          Circle_alert($$renderer2, { size: 16 });
          $$renderer2.push(`<!----> ${escape_html(t2("upload_failed"))}</span>`);
        }
        $$renderer2.push(`<!--]--></div>`);
      }
      $$renderer2.push(`<!--]--></div> `);
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<!--]-->`);
    } else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--> `);
    $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--></div>`);
  });
}
function _page18($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    head("1bij68w", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>${escape_html(t2("upload_activity_file"))} \xB7 Kondis</title>`);
      });
    });
    $$renderer2.push(`<div class="page-shell upload-page">`);
    UploadForm($$renderer2, { eventsUrl: data.eventsUrl });
    $$renderer2.push(`<!----></div>`);
  });
}
var init_page_svelte18 = __esm({
  ".svelte-kit/output/server/entries/pages/upload/activity/_page.svelte.js"() {
    init_server();
    init_navigation();
    init_Icon();
    init_arrow_left();
    init_arrow_up_right();
    init_check();
    init_circle_alert();
    init_clock_3();
    init_file_up();
    init_i18n();
    init_api2();
    init_format();
    __name(Loader_circle, "Loader_circle");
    __name(UploadForm, "UploadForm");
    __name(_page18, "_page");
  }
});

// .svelte-kit/output/server/nodes/20.js
var __exports21 = {};
__export(__exports21, {
  component: () => component20,
  fonts: () => fonts21,
  imports: () => imports21,
  index: () => index21,
  stylesheets: () => stylesheets21
});
var index21, component_cache20, component20, imports21, stylesheets21, fonts21;
var init__21 = __esm({
  ".svelte-kit/output/server/nodes/20.js"() {
    index21 = 20;
    component20 = /* @__PURE__ */ __name(async () => component_cache20 ??= (await Promise.resolve().then(() => (init_page_svelte18(), page_svelte_exports18))).default, "component");
    imports21 = ["_app/immutable/nodes/20.CyE7tQlR.js", "_app/immutable/chunks/TqmLiPd2.js", "_app/immutable/chunks/B90Er9NH.js", "_app/immutable/chunks/xihTtKlq.js", "_app/immutable/chunks/LlbaMzKX.js", "_app/immutable/chunks/Cb18XCVn.js", "_app/immutable/chunks/D5mC9s7c.js", "_app/immutable/chunks/BpqxhcYW.js", "_app/immutable/chunks/BBC-ssYl.js", "_app/immutable/chunks/CcRl4Fq9.js", "_app/immutable/chunks/Cn48AJiV.js", "_app/immutable/chunks/BcsRuf6u.js", "_app/immutable/chunks/BQ8XCk7I.js", "_app/immutable/chunks/COo21xW_.js", "_app/immutable/chunks/BNBsMhO5.js", "_app/immutable/chunks/CAMS0kRz.js", "_app/immutable/chunks/B4Kzzj8V.js"];
    stylesheets21 = [];
    fonts21 = [];
  }
});

// .svelte-kit/output/server/entries/pages/upload/strava/_page.svelte.js
var page_svelte_exports19 = {};
__export(page_svelte_exports19, {
  default: () => _page19
});
function StravaTakeoutImport($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let dragging = false;
    let progressTimer;
    onDestroy(() => {
      clearInterval(progressTimer);
    });
    const busy = /* @__PURE__ */ __name(() => false, "busy");
    const phaseText = /* @__PURE__ */ __name(() => {
      return "";
    }, "phaseText");
    $$renderer2.push(`<div class="upload-panel"><button class="upload-back" type="button">`);
    Arrow_left($$renderer2, { size: 17 });
    $$renderer2.push(`<!----> ${escape_html(t2("upload_activity"))}</button> <div class="upload-panel-heading"><span class="upload-choice-icon">`);
    Archive($$renderer2, { size: 24 });
    $$renderer2.push(`<!----></span> <div><h2>${escape_html(t2("activity_import_strava"))}</h2> <p>${escape_html(t2("activity_import_strava_description"))}</p></div></div> <button${attr_class("drop-zone", void 0, { "dragging": dragging })} type="button"${attr("disabled", busy(), true)}><span class="upload-icon">`);
    Archive($$renderer2, { size: 28 });
    $$renderer2.push(`<!----></span> <strong>${escape_html(t2("strava_drop_takeout"))}</strong> <span>${escape_html(t2("strava_browse_device"))}</span> <small>.zip</small></button> <input class="sr-only" type="file" accept=".zip,application/zip"/> `);
    $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--> `);
    if (busy()) $$renderer2.push(`<!--[0--><p class="upload-message">${escape_html(phaseText())}</p>`);
    else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--> `);
    if (busy() && false) ;
    else $$renderer2.push("<!--[-1-->");
    $$renderer2.push(`<!--]--> `);
    if (busy()) $$renderer2.push(`<!--[0--><button class="upload-submit" type="button">${escape_html(t2("strava_cancel"))}</button>`);
    else $$renderer2.push(`<!--[-1--><button class="upload-submit" type="button"${attr("disabled", true, true)}>${escape_html(t2("strava_import_takeout"))}</button>`);
    $$renderer2.push(`<!--]--></div>`);
  });
}
function _page19($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    head("4xivci", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>${escape_html(t2("strava_takeout"))} \xB7 Kondis</title>`);
      });
    });
    $$renderer2.push(`<div class="page-shell upload-page">`);
    StravaTakeoutImport($$renderer2, {});
    $$renderer2.push(`<!----></div>`);
  });
}
var init_page_svelte19 = __esm({
  ".svelte-kit/output/server/entries/pages/upload/strava/_page.svelte.js"() {
    init_index_server();
    init_server();
    init_navigation();
    init_archive();
    init_arrow_left();
    init_i18n();
    __name(StravaTakeoutImport, "StravaTakeoutImport");
    __name(_page19, "_page");
  }
});

// .svelte-kit/output/server/nodes/21.js
var __exports22 = {};
__export(__exports22, {
  component: () => component21,
  fonts: () => fonts22,
  imports: () => imports22,
  index: () => index22,
  stylesheets: () => stylesheets22
});
var index22, component_cache21, component21, imports22, stylesheets22, fonts22;
var init__22 = __esm({
  ".svelte-kit/output/server/nodes/21.js"() {
    index22 = 21;
    component21 = /* @__PURE__ */ __name(async () => component_cache21 ??= (await Promise.resolve().then(() => (init_page_svelte19(), page_svelte_exports19))).default, "component");
    imports22 = ["_app/immutable/nodes/21.BY3zt0P9.js", "_app/immutable/chunks/TqmLiPd2.js", "_app/immutable/chunks/B90Er9NH.js", "_app/immutable/chunks/xihTtKlq.js", "_app/immutable/chunks/LlbaMzKX.js", "_app/immutable/chunks/8ijIODKe.js", "_app/immutable/chunks/D5mC9s7c.js", "_app/immutable/chunks/Cb18XCVn.js", "_app/immutable/chunks/BBC-ssYl.js", "_app/immutable/chunks/BQ8XCk7I.js", "_app/immutable/chunks/COo21xW_.js"];
    stylesheets22 = [];
    fonts22 = [];
  }
});

// .svelte-kit/output/server/entries/endpoints/api/_...path_/_server.ts.js
var server_ts_exports = {};
__export(server_ts_exports, {
  DELETE: () => DELETE,
  GET: () => GET,
  PATCH: () => PATCH,
  POST: () => POST,
  PUT: () => PUT
});
var proxy2, GET, POST, PUT, PATCH, DELETE;
var init_server_ts = __esm({
  ".svelte-kit/output/server/entries/endpoints/api/_...path_/_server.ts.js"() {
    init_api();
    proxy2 = /* @__PURE__ */ __name(async ({ request, params, url, locals }) => {
      const target = apiEndpointUrl(params.path ?? "");
      target.search = url.search;
      const headers2 = new Headers(request.headers);
      headers2.delete("host");
      headers2.delete("content-length");
      headers2.delete("transfer-encoding");
      headers2.delete("connection");
      const body = request.method === "GET" || request.method === "HEAD" ? void 0 : request.body;
      const init2 = {
        method: request.method,
        headers: headers2,
        body,
        redirect: "manual"
      };
      if (body) init2.duplex = "half";
      return locals.kondisFetch(target, init2);
    }, "proxy");
    GET = proxy2;
    POST = proxy2;
    PUT = proxy2;
    PATCH = proxy2;
    DELETE = proxy2;
  }
});

// .svelte-kit/output/server/entries/endpoints/logout/_server.ts.js
var server_ts_exports2 = {};
__export(server_ts_exports2, {
  POST: () => POST2
});
var logout, POST2;
var init_server_ts2 = __esm({
  ".svelte-kit/output/server/entries/endpoints/logout/_server.ts.js"() {
    init_api();
    init_exports();
    logout = /* @__PURE__ */ __name(async ({ cookies, locals }) => {
      await locals.kondisFetch(apiUrl("api/v1/auth/logout"), {
        method: "POST",
        signal: AbortSignal.timeout(2e3)
      }).catch(() => void 0);
      cookies.delete("kondis_session", { path: "/" });
      throw redirect(303, "/login");
    }, "logout");
    POST2 = logout;
  }
});

// .svelte-kit/output/server/index.js
init_index_server();
init_shared();
init_internal2();

// .svelte-kit/output/server/chunks/utils.js
init_shared();
init_uneval();
init_exports();
init_internal();
init_server2();
var ENDPOINT_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
  "HEAD"
];
var PAGE_METHODS = [
  "GET",
  "POST",
  "HEAD"
];
var defaultParseOptions = {
  decodeValues: true,
  map: false,
  silent: false,
  split: "auto"
};
function isForbiddenKey(key2) {
  return typeof key2 !== "string" || key2 in {};
}
__name(isForbiddenKey, "isForbiddenKey");
function createNullObj() {
  return /* @__PURE__ */ Object.create(null);
}
__name(createNullObj, "createNullObj");
function isNonEmptyString(str) {
  return typeof str === "string" && !!str.trim();
}
__name(isNonEmptyString, "isNonEmptyString");
function parseString(setCookieValue, options2) {
  var parts = setCookieValue.split(";").filter(isNonEmptyString);
  var nameValuePairStr = parts.shift();
  if (!nameValuePairStr) return null;
  var parsed = parseNameValuePair(nameValuePairStr);
  var name = parsed.name;
  var value = parsed.value;
  options2 = options2 ? Object.assign({}, defaultParseOptions, options2) : defaultParseOptions;
  if (isForbiddenKey(name)) return null;
  try {
    value = options2.decodeValues ? decodeURIComponent(value) : value;
  } catch (e3) {
    console.error("set-cookie-parser: failed to decode cookie value. Set options.decodeValues=false to disable decoding.", e3);
  }
  var cookie = createNullObj();
  cookie.name = name;
  cookie.value = value;
  parts.forEach(function(part) {
    var sides = part.split("=");
    var key2 = sides.shift().trim().toLowerCase();
    if (isForbiddenKey(key2)) return;
    var value2 = sides.join("=").trim();
    if (key2 === "expires") cookie.expires = new Date(value2);
    else if (key2 === "max-age") {
      var n2 = parseInt(value2, 10);
      if (!Number.isNaN(n2)) cookie.maxAge = n2;
    } else if (key2 === "secure") cookie.secure = true;
    else if (key2 === "httponly") cookie.httpOnly = true;
    else if (key2 === "samesite") cookie.sameSite = value2;
    else if (key2 === "partitioned") cookie.partitioned = true;
    else if (key2) cookie[key2] = value2;
  });
  return cookie;
}
__name(parseString, "parseString");
function parseNameValuePair(nameValuePairStr) {
  var name = "";
  var value = "";
  var nameValueArr = nameValuePairStr.split("=");
  if (nameValueArr.length > 1) {
    name = nameValueArr.shift();
    value = nameValueArr.join("=");
  } else value = nameValuePairStr;
  return {
    name,
    value
  };
}
__name(parseNameValuePair, "parseNameValuePair");
function parseSetCookie(input, options2) {
  options2 = options2 ? Object.assign({}, defaultParseOptions, options2) : defaultParseOptions;
  if (!input) {
    if (!options2.map) return [];
    else return createNullObj();
  }
  if (input.headers) {
    if (typeof input.headers.getSetCookie === "function") input = input.headers.getSetCookie();
    else if (input.headers["set-cookie"]) input = input.headers["set-cookie"];
    else {
      var sch = input.headers[Object.keys(input.headers).find(function(key2) {
        return key2.toLowerCase() === "set-cookie";
      })];
      if (!sch && input.headers.cookie && !options2.silent) console.warn("Warning: set-cookie-parser appears to have been called on a request object. It is designed to parse Set-Cookie headers from responses, not Cookie headers from requests. Set the option {silent: true} to suppress this warning.");
      input = sch;
    }
  }
  var split = options2.split;
  var isArray = Array.isArray(input);
  if (split === "auto") split = !isArray;
  if (!isArray) input = [input];
  input = input.filter(isNonEmptyString);
  if (split) input = input.map(splitCookiesString).flat();
  if (!options2.map) return input.map(function(str) {
    return parseString(str, options2);
  }).filter(Boolean);
  else {
    var cookies = createNullObj();
    return input.reduce(function(cookies2, str) {
      var cookie = parseString(str, options2);
      if (cookie && !isForbiddenKey(cookie.name)) cookies2[cookie.name] = cookie;
      return cookies2;
    }, cookies);
  }
}
__name(parseSetCookie, "parseSetCookie");
function splitCookiesString(cookiesString) {
  if (Array.isArray(cookiesString)) return cookiesString;
  if (typeof cookiesString !== "string") return [];
  var cookiesStrings = [];
  var pos = 0;
  var start;
  var ch;
  var lastComma;
  var nextStart;
  var cookiesSeparatorFound;
  function skipWhitespace() {
    while (pos < cookiesString.length && /\s/.test(cookiesString.charAt(pos))) pos += 1;
    return pos < cookiesString.length;
  }
  __name(skipWhitespace, "skipWhitespace");
  function notSpecialChar() {
    ch = cookiesString.charAt(pos);
    return ch !== "=" && ch !== ";" && ch !== ",";
  }
  __name(notSpecialChar, "notSpecialChar");
  while (pos < cookiesString.length) {
    start = pos;
    cookiesSeparatorFound = false;
    while (skipWhitespace()) {
      ch = cookiesString.charAt(pos);
      if (ch === ",") {
        lastComma = pos;
        pos += 1;
        skipWhitespace();
        nextStart = pos;
        while (pos < cookiesString.length && notSpecialChar()) pos += 1;
        if (pos < cookiesString.length && cookiesString.charAt(pos) === "=") {
          cookiesSeparatorFound = true;
          pos = nextStart;
          cookiesStrings.push(cookiesString.substring(start, lastComma));
          start = pos;
        } else pos = lastComma + 1;
      } else pos += 1;
    }
    if (!cookiesSeparatorFound || pos >= cookiesString.length) cookiesStrings.push(cookiesString.substring(start, cookiesString.length));
  }
  return cookiesStrings;
}
__name(splitCookiesString, "splitCookiesString");
parseSetCookie.parseSetCookie = parseSetCookie;
parseSetCookie.parse = parseSetCookie;
parseSetCookie.parseString = parseString;
parseSetCookie.splitCookiesString = splitCookiesString;
var decoder = new TextDecoder();
function set_nested_value(object, path_string, value) {
  if (path_string.startsWith("n:")) {
    path_string = path_string.slice(2);
    value = value === "" ? void 0 : parseFloat(value);
  } else if (path_string.startsWith("b:")) {
    path_string = path_string.slice(2);
    value = value === "on";
  }
  deep_set(object, split_path(path_string), value);
}
__name(set_nested_value, "set_nested_value");
var DELETE_KEY = {};
function convert_formdata(data) {
  const result = {};
  for (let key2 of data.keys()) {
    const is_array2 = key2.endsWith("[]");
    let values = data.getAll(key2);
    if (is_array2) key2 = key2.slice(0, -2);
    values = values.filter((entry) => typeof entry === "string" || entry.name !== "" || entry.size > 0);
    if (values.length === 0 && !is_array2) continue;
    if (key2.startsWith("n:")) {
      key2 = key2.slice(2);
      values = values.map((v) => v === "" ? void 0 : parseFloat(v));
    } else if (key2.startsWith("b:")) {
      key2 = key2.slice(2);
      values = values.map((v) => v === "on");
    }
    if (values.length > 1 && !is_array2) throw new Error(`Form cannot contain duplicated keys \u2014 "${key2}" has ${values.length} values`);
    set_nested_value(result, key2, is_array2 ? values : values[0]);
  }
  return result;
}
__name(convert_formdata, "convert_formdata");
var BINARY_FORM_CONTENT_TYPE = "application/x-sveltekit-formdata";
var BINARY_FORM_VERSION = 0;
var HEADER_BYTES = 7;
async function deserialize_binary_form(request) {
  if (request.headers.get("content-type") !== "application/x-sveltekit-formdata") {
    const form_data = await request.formData();
    return {
      data: convert_formdata(form_data),
      meta: {},
      form_data
    };
  }
  if (!request.body) throw deserialize_error("no body");
  const reader = request.body.getReader();
  const chunks = [];
  function get_chunk(index23) {
    if (index23 in chunks) return chunks[index23];
    let i = chunks.length;
    while (i <= index23) {
      chunks[i] = reader.read().then((chunk) => chunk.value);
      i++;
    }
    return chunks[index23];
  }
  __name(get_chunk, "get_chunk");
  async function get_buffer(offset, length) {
    let start_chunk;
    let chunk_start = 0;
    let chunk_index;
    for (chunk_index = 0; ; chunk_index++) {
      const chunk = await get_chunk(chunk_index);
      if (!chunk) return null;
      const chunk_end = chunk_start + chunk.byteLength;
      if (offset >= chunk_start && offset < chunk_end) {
        start_chunk = chunk;
        break;
      }
      chunk_start = chunk_end;
    }
    if (offset + length <= chunk_start + start_chunk.byteLength) return start_chunk.subarray(offset - chunk_start, offset + length - chunk_start);
    const chunks2 = [start_chunk.subarray(offset - chunk_start)];
    let cursor = start_chunk.byteLength - offset + chunk_start;
    while (cursor < length) {
      chunk_index++;
      let chunk = await get_chunk(chunk_index);
      if (!chunk) return null;
      if (chunk.byteLength > length - cursor) chunk = chunk.subarray(0, length - cursor);
      chunks2.push(chunk);
      cursor += chunk.byteLength;
    }
    const buffer2 = new Uint8Array(length);
    cursor = 0;
    for (const chunk of chunks2) {
      buffer2.set(chunk, cursor);
      cursor += chunk.byteLength;
    }
    return buffer2;
  }
  __name(get_buffer, "get_buffer");
  const header = await get_buffer(0, HEADER_BYTES);
  if (!header) throw deserialize_error("too short");
  if (header[0] !== BINARY_FORM_VERSION) throw deserialize_error(`got version ${header[0]}, expected version ${BINARY_FORM_VERSION}`);
  const header_view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  const data_length = header_view.getUint32(1, true);
  const file_offsets_length = header_view.getUint16(5, true);
  const data_buffer = await get_buffer(HEADER_BYTES, data_length);
  if (!data_buffer) throw deserialize_error("data too short");
  let file_offsets;
  let files_start_offset;
  if (file_offsets_length > 0) {
    const file_offsets_buffer = await get_buffer(HEADER_BYTES + data_length, file_offsets_length);
    if (!file_offsets_buffer) throw deserialize_error("file offset table too short");
    const parsed_offsets = JSON.parse(decoder.decode(file_offsets_buffer));
    if (!Array.isArray(parsed_offsets) || parsed_offsets.some((n2) => typeof n2 !== "number" || !Number.isInteger(n2) || n2 < 0)) throw deserialize_error("invalid file offset table");
    file_offsets = parsed_offsets;
    files_start_offset = HEADER_BYTES + data_length + file_offsets_length;
  }
  const file_spans = [];
  const [data, meta] = parse(decoder.decode(data_buffer), { File: /* @__PURE__ */ __name(([name, type, size, last_modified, index23]) => {
    if (typeof name !== "string" || typeof type !== "string" || typeof size !== "number" || typeof last_modified !== "number" || typeof index23 !== "number") throw deserialize_error("invalid file metadata");
    let offset = file_offsets[index23];
    if (offset === void 0) throw deserialize_error("duplicate file offset table index");
    file_offsets[index23] = void 0;
    offset += files_start_offset;
    file_spans.push({
      offset,
      size
    });
    return new Proxy(new LazyFile(name, type, size, last_modified, get_chunk, offset), { getPrototypeOf() {
      return File.prototype;
    } });
  }, "File") });
  file_spans.sort((a2, b) => a2.offset - b.offset || a2.size - b.size);
  for (let i = 1; i < file_spans.length; i++) {
    const previous = file_spans[i - 1];
    const current2 = file_spans[i];
    const previous_end = previous.offset + previous.size;
    if (previous_end < current2.offset) throw deserialize_error("gaps in file data");
    if (previous_end > current2.offset) throw deserialize_error("overlapping file data");
  }
  (async () => {
    let has_more = true;
    while (has_more) has_more = !!await get_chunk(chunks.length);
  })().catch(noop2);
  return {
    data,
    meta,
    form_data: null
  };
}
__name(deserialize_binary_form, "deserialize_binary_form");
function deserialize_error(message) {
  return new SvelteKitError(400, "Bad Request", `Could not deserialize binary form: ${message}`);
}
__name(deserialize_error, "deserialize_error");
var LazyFile = class LazyFile2 {
  static {
    __name(this, "LazyFile");
  }
  /** @type {(index: number) => Promise<Uint8Array<ArrayBuffer> | undefined>} */
  #get_chunk;
  /** @type {number} */
  #offset;
  /**
  * @param {string} name
  * @param {string} type
  * @param {number} size
  * @param {number} last_modified
  * @param {(index: number) => Promise<Uint8Array<ArrayBuffer> | undefined>} get_chunk
  * @param {number} offset
  */
  constructor(name, type, size, last_modified, get_chunk, offset) {
    this.name = name;
    this.type = type;
    this.size = size;
    this.lastModified = last_modified;
    this.webkitRelativePath = "";
    this.#get_chunk = get_chunk;
    this.#offset = offset;
    this.arrayBuffer = this.arrayBuffer.bind(this);
    this.bytes = this.bytes.bind(this);
    this.slice = this.slice.bind(this);
    this.stream = this.stream.bind(this);
    this.text = this.text.bind(this);
  }
  /** @type {ArrayBuffer | undefined} */
  #buffer;
  async arrayBuffer() {
    this.#buffer ??= await new Response(this.stream()).arrayBuffer();
    return this.#buffer;
  }
  async bytes() {
    return new Uint8Array(await this.arrayBuffer());
  }
  /**
  * @param {number=} start
  * @param {number=} end
  * @param {string=} contentType
  */
  slice(start = 0, end = this.size, contentType = this.type) {
    if (start < 0) start = Math.max(this.size + start, 0);
    else start = Math.min(start, this.size);
    if (end < 0) end = Math.max(this.size + end, 0);
    else end = Math.min(end, this.size);
    const size = Math.max(end - start, 0);
    return new LazyFile2(this.name, contentType, size, this.lastModified, this.#get_chunk, this.#offset + start);
  }
  stream() {
    let cursor = 0;
    let chunk_index = 0;
    return new ReadableStream({
      start: /* @__PURE__ */ __name(async (controller) => {
        let chunk_start = 0;
        let start_chunk;
        for (chunk_index = 0; ; chunk_index++) {
          const chunk = await this.#get_chunk(chunk_index);
          if (!chunk) return null;
          const chunk_end = chunk_start + chunk.byteLength;
          if (this.#offset >= chunk_start && this.#offset < chunk_end) {
            start_chunk = chunk;
            break;
          }
          chunk_start = chunk_end;
        }
        if (this.#offset + this.size <= chunk_start + start_chunk.byteLength) {
          controller.enqueue(start_chunk.subarray(this.#offset - chunk_start, this.#offset + this.size - chunk_start));
          controller.close();
        } else {
          controller.enqueue(start_chunk.subarray(this.#offset - chunk_start));
          cursor = start_chunk.byteLength - this.#offset + chunk_start;
        }
      }, "start"),
      pull: /* @__PURE__ */ __name(async (controller) => {
        chunk_index++;
        let chunk = await this.#get_chunk(chunk_index);
        if (!chunk) {
          controller.error("incomplete file data");
          controller.close();
          return;
        }
        if (chunk.byteLength > this.size - cursor) chunk = chunk.subarray(0, this.size - cursor);
        controller.enqueue(chunk);
        cursor += chunk.byteLength;
        if (cursor >= this.size) controller.close();
      }, "pull")
    });
  }
  async text() {
    return decoder.decode(await this.arrayBuffer());
  }
};
var path_regex = /^[a-zA-Z_$]\w*(\.[a-zA-Z_$]\w*|\[\d+\])*$/;
function split_path(path) {
  if (!path_regex.test(path)) throw new Error(`Invalid path ${path}`);
  return path.split(/\.|\[|\]/).filter(Boolean);
}
__name(split_path, "split_path");
function check_prototype_pollution(key2) {
  if (key2 === "__proto__" || key2 === "constructor" || key2 === "prototype") throw new Error(`Invalid key "${key2}"`);
}
__name(check_prototype_pollution, "check_prototype_pollution");
function deep_set(object, keys, value) {
  let current2 = object;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key2 = keys[i];
    check_prototype_pollution(key2);
    const is_array2 = /^\d+$/.test(keys[i + 1]);
    const inner = Object.hasOwn(current2, key2) ? current2[key2] : void 0;
    const exists = inner != null;
    if (exists && is_array2 !== Array.isArray(inner)) throw new Error(`Invalid array key ${keys[i + 1]}`);
    if (!exists) {
      if (value === DELETE_KEY) return;
      current2[key2] = is_array2 ? [] : {};
    }
    current2 = current2[key2];
  }
  const final_key = keys[keys.length - 1];
  check_prototype_pollution(final_key);
  if (value === DELETE_KEY) delete current2[final_key];
  else current2[final_key] = value;
}
__name(deep_set, "deep_set");
function negotiate(accept, types) {
  const parts = [];
  accept.split(",").forEach((str, i) => {
    const match = /^[ \t]*([^/ \t]+)\/([^; \t]+)[ \t]*(?:;[ \t]*q=([0-9.]+))?/.exec(str);
    if (match) {
      const [, type, subtype, q2 = "1"] = match;
      parts.push({
        type,
        subtype,
        q: +q2,
        i
      });
    }
  });
  parts.sort((a2, b) => {
    if (a2.q !== b.q) return b.q - a2.q;
    if (a2.subtype === "*" !== (b.subtype === "*")) return a2.subtype === "*" ? 1 : -1;
    if (a2.type === "*" !== (b.type === "*")) return a2.type === "*" ? 1 : -1;
    return a2.i - b.i;
  });
  let accepted;
  let min_priority = Infinity;
  for (const mimetype of types) {
    const [type, subtype] = mimetype.split("/");
    const priority = parts.findIndex((part) => (part.type === type || part.type === "*") && (part.subtype === subtype || part.subtype === "*"));
    if (priority !== -1 && priority < min_priority) {
      accepted = mimetype;
      min_priority = priority;
    }
  }
  return accepted;
}
__name(negotiate, "negotiate");
function get_set_cookies(headers2) {
  if (typeof headers2.getSetCookie === "function") return headers2.getSetCookie();
  const set_cookie = headers2.get("set-cookie");
  return set_cookie ? splitCookiesString(set_cookie) : [];
}
__name(get_set_cookies, "get_set_cookies");
function is_content_type(request, ...types) {
  const type = request.headers.get("content-type")?.split(";", 1)[0].trim() ?? "";
  return types.includes(type.toLowerCase());
}
__name(is_content_type, "is_content_type");
function is_form_content_type(request) {
  return is_content_type(request, "application/x-www-form-urlencoded", "multipart/form-data", "text/plain", BINARY_FORM_CONTENT_TYPE);
}
__name(is_form_content_type, "is_form_content_type");
var escape_html_attr_dict = {
  "&": "&amp;",
  '"': "&quot;"
};
var escape_html_dict = {
  "&": "&amp;",
  "<": "&lt;"
};
var escape_html_attr_regex = new RegExp(`[${Object.keys(escape_html_attr_dict).join("")}]|[\\ud800-\\udbff](?![\\udc00-\\udfff])|[\\ud800-\\udbff][\\udc00-\\udfff]|[\\udc00-\\udfff]`, "g");
var escape_html_regex = new RegExp(`[${Object.keys(escape_html_dict).join("")}]|[\\ud800-\\udbff](?![\\udc00-\\udfff])|[\\ud800-\\udbff][\\udc00-\\udfff]|[\\udc00-\\udfff]`, "g");
function escape_html2(str, is_attr) {
  const dict = is_attr ? escape_html_attr_dict : escape_html_dict;
  return str.replace(is_attr ? escape_html_attr_regex : escape_html_regex, (match) => {
    if (match.length === 2) return match;
    return dict[match] ?? `&#${match.charCodeAt(0)};`;
  });
}
__name(escape_html2, "escape_html");
function method_not_allowed(mod, method) {
  return text(`${method} method not allowed`, {
    status: 405,
    headers: { allow: allowed_methods(mod).join(", ") }
  });
}
__name(method_not_allowed, "method_not_allowed");
function allowed_methods(mod) {
  const allowed = ENDPOINT_METHODS.filter((method) => method in mod);
  if ("GET" in mod && !("HEAD" in mod)) allowed.push("HEAD");
  return allowed;
}
__name(allowed_methods, "allowed_methods");
function get_global_name(options2) {
  return `__sveltekit_${options2.version_hash}`;
}
__name(get_global_name, "get_global_name");
function static_error_page(options2, status, message) {
  let page3 = options2.templates.error({
    status,
    message: escape_html2(message)
  });
  return text(page3, {
    headers: { "content-type": "text/html; charset=utf-8" },
    status
  });
}
__name(static_error_page, "static_error_page");
async function handle_fatal_error(event, state2, options2, error2) {
  error2 = error2 instanceof HttpError ? error2 : coalesce_to_error(error2);
  const status = get_status(error2);
  const body = await handle_error_and_jsonify(event, state2, options2, error2);
  const type = negotiate(event.request.headers.get("accept") || "text/html", ["application/json", "text/html"]);
  if (event.isDataRequest || type === "application/json") return json(body, { status });
  return static_error_page(options2, status, body.message);
}
__name(handle_fatal_error, "handle_fatal_error");
async function handle_error_and_jsonify(event, state2, options2, error2) {
  if (error2 instanceof HttpError) return {
    message: "Unknown Error",
    ...error2.body
  };
  const status = get_status(error2);
  const message = get_message(error2);
  return await with_request_store({
    event,
    state: state2
  }, () => options2.hooks.handleError({
    error: error2,
    event,
    status,
    message
  })) ?? { message };
}
__name(handle_error_and_jsonify, "handle_error_and_jsonify");
function redirect_response(status, location) {
  return new Response(void 0, {
    status,
    headers: { location }
  });
}
__name(redirect_response, "redirect_response");
function clarify_devalue_error(event, error2) {
  if (error2.path) return `Data returned from \`load\` while rendering ${event.route.id} is not serializable: ${error2.message} (${error2.path}). If you need to serialize/deserialize custom types, use transport hooks: https://svelte.dev/docs/kit/hooks#transport.`;
  if (error2.path === "") return `Data returned from \`load\` while rendering ${event.route.id} is not a plain object`;
  return error2.message;
}
__name(clarify_devalue_error, "clarify_devalue_error");
function serialize_uses(node) {
  const uses = {};
  if (node.uses && node.uses.dependencies.size > 0) uses.dependencies = Array.from(node.uses.dependencies);
  if (node.uses && node.uses.search_params.size > 0) uses.search_params = Array.from(node.uses.search_params);
  if (node.uses && node.uses.params.size > 0) uses.params = Array.from(node.uses.params);
  if (node.uses?.parent) uses.parent = 1;
  if (node.uses?.route) uses.route = 1;
  if (node.uses?.url) uses.url = 1;
  return uses;
}
__name(serialize_uses, "serialize_uses");
function has_prerendered_path(manifest2, pathname) {
  return manifest2._.prerendered_routes.has(pathname) || pathname.at(-1) === "/" && manifest2._.prerendered_routes.has(pathname.slice(0, -1));
}
__name(has_prerendered_path, "has_prerendered_path");
function format_server_error(status, error2, event) {
  const formatted_text = `
\x1B[1;31m[${status}] ${event.request.method} ${event.url.pathname}\x1B[0m`;
  if (status === 404) return formatted_text;
  return `${formatted_text}
${error2.stack}`;
}
__name(format_server_error, "format_server_error");
function get_node_type(node_id) {
  const filename = node_id?.split("/")?.at(-1);
  if (!filename) return "unknown";
  return filename.split(".").slice(0, -1).join(".");
}
__name(get_node_type, "get_node_type");
function create_replacer(transport) {
  const replacer = /* @__PURE__ */ __name((thing) => {
    for (const key2 in transport) {
      const encoded = transport[key2].encode(thing);
      if (encoded) return `app.decode('${key2}', ${uneval(encoded, replacer)})`;
    }
  }, "replacer");
  return replacer;
}
__name(create_replacer, "create_replacer");

// .svelte-kit/output/server/index.js
init_uneval();
init_shared_server();
init_exports2();
init_server();
init_internal22();
init_exports();
init_internal();
init_server2();
function with_resolvers() {
  let resolve2;
  let reject;
  return {
    promise: new Promise((res, rej) => {
      resolve2 = res;
      reject = rej;
    }),
    resolve: resolve2,
    reject
  };
}
__name(with_resolvers, "with_resolvers");
var NULL_BODY_STATUS = [
  101,
  103,
  204,
  205,
  304
];
var IN_WEBCONTAINER2 = !!globalThis.process?.versions?.webcontainer;
var s = JSON.stringify;
async function render_endpoint(event, event_state, mod, state2) {
  const method = event.request.method;
  let handler = mod[method] || mod.fallback;
  if (method === "HEAD" && !mod.HEAD && mod.GET) handler = mod.GET;
  if (!handler) return method_not_allowed(mod, method);
  const prerender = mod.prerender ?? state2.prerender_default;
  if (prerender && (mod.POST || mod.PATCH || mod.PUT || mod.DELETE)) throw new Error("Cannot prerender endpoints that have mutative methods");
  if (state2.prerendering && !state2.prerendering.inside_reroute && !prerender) {
    if (state2.depth > 0) throw new Error(`${event.route.id} is not prerenderable`);
    else return new Response(void 0, { status: 204 });
  }
  try {
    const response = await with_request_store({
      event,
      state: event_state
    }, () => handler(event));
    if (!(response instanceof Response)) throw new Error(`Invalid response from route ${event.url.pathname}: handler should return a Response object`);
    if (state2.prerendering && (!state2.prerendering.inside_reroute || prerender)) {
      const cloned = new Response(response.clone().body, {
        status: response.status,
        statusText: response.statusText,
        headers: new Headers(response.headers)
      });
      cloned.headers.set("x-sveltekit-prerender", String(prerender));
      if (state2.prerendering.inside_reroute && prerender) {
        cloned.headers.set("x-sveltekit-routeid", encodeURI(event.route.id));
        state2.prerendering.dependencies.set(event.url.pathname, {
          response: cloned,
          body: null
        });
      } else return cloned;
    }
    return response;
  } catch (e3) {
    if (e3 instanceof Redirect) return new Response(void 0, {
      status: e3.status,
      headers: { location: e3.location }
    });
    throw e3;
  }
}
__name(render_endpoint, "render_endpoint");
function is_endpoint_request(event) {
  const { method, headers: headers2 } = event.request;
  if (ENDPOINT_METHODS.includes(method) && !PAGE_METHODS.includes(method)) return true;
  if (method === "POST" && headers2.get("x-sveltekit-action") === "true") return false;
  const accept = event.request.headers.get("accept") ?? "*/*";
  return negotiate(accept, ["*", "text/html"]) !== "text/html";
}
__name(is_endpoint_request, "is_endpoint_request");
async function record_span({ name, attributes: attributes2, fn }) {
  return fn(noop_span);
}
__name(record_span, "record_span");
function is_action_json_request(event) {
  return negotiate(event.request.headers.get("accept") ?? "*/*", ["application/json", "text/html"]) === "application/json" && event.request.method === "POST";
}
__name(is_action_json_request, "is_action_json_request");
async function handle_action_json_request(event, event_state, options2, server2) {
  const actions6 = server2?.actions;
  if (!actions6) {
    const no_actions_error = new SvelteKitError(405, "Method Not Allowed", `POST method not allowed. No form actions exist for this page`);
    return action_json({
      type: "error",
      error: await handle_error_and_jsonify(event, event_state, options2, no_actions_error)
    }, {
      status: no_actions_error.status,
      headers: { allow: "GET" }
    });
  }
  check_named_default_separate(actions6);
  try {
    const data = await call_action(event, event_state, actions6);
    if (data instanceof ActionFailure) return action_json({
      type: "failure",
      status: data.status,
      data: stringify_action_response(data.data, event.route.id, options2.hooks.transport)
    });
    else return action_json({
      type: "success",
      status: data ? 200 : 204,
      data: stringify_action_response(data, event.route.id, options2.hooks.transport)
    });
  } catch (e3) {
    const err = normalize_error(e3);
    if (err instanceof Redirect) return action_json_redirect(err);
    return action_json({
      type: "error",
      error: await handle_error_and_jsonify(event, event_state, options2, check_incorrect_fail_use(err))
    }, { status: get_status(err) });
  }
}
__name(handle_action_json_request, "handle_action_json_request");
function check_incorrect_fail_use(error2) {
  return error2 instanceof ActionFailure ? /* @__PURE__ */ new Error('Cannot "throw fail()". Use "return fail()"') : error2;
}
__name(check_incorrect_fail_use, "check_incorrect_fail_use");
function action_json_redirect(redirect2) {
  return action_json({
    type: "redirect",
    status: redirect2.status,
    location: redirect2.location
  });
}
__name(action_json_redirect, "action_json_redirect");
function action_json(data, init2) {
  return json(data, init2);
}
__name(action_json, "action_json");
function is_action_request(event) {
  return event.request.method === "POST";
}
__name(is_action_request, "is_action_request");
async function handle_action_request(event, event_state, server2) {
  const actions6 = server2?.actions;
  if (!actions6) {
    event.setHeaders({ allow: "GET" });
    return {
      type: "error",
      error: new SvelteKitError(405, "Method Not Allowed", `POST method not allowed. No form actions exist for this page`)
    };
  }
  check_named_default_separate(actions6);
  try {
    const data = await call_action(event, event_state, actions6);
    if (data instanceof ActionFailure) return {
      type: "failure",
      status: data.status,
      data: data.data
    };
    else return {
      type: "success",
      status: 200,
      data
    };
  } catch (e3) {
    const err = normalize_error(e3);
    if (err instanceof Redirect) return {
      type: "redirect",
      status: err.status,
      location: err.location
    };
    return {
      type: "error",
      error: check_incorrect_fail_use(err)
    };
  }
}
__name(handle_action_request, "handle_action_request");
function check_named_default_separate(actions6) {
  if (actions6.default && Object.keys(actions6).length > 1) throw new Error("When using named actions, the default action cannot be used. See the docs for more info: https://svelte.dev/docs/kit/form-actions#named-actions");
}
__name(check_named_default_separate, "check_named_default_separate");
async function call_action(event, event_state, actions6) {
  const url = new URL(event.request.url);
  let name = "default";
  for (const param of url.searchParams) if (param[0].startsWith("/")) {
    name = param[0].slice(1);
    if (name === "default") throw new Error('Cannot use reserved action name "default"');
    break;
  }
  const action = actions6[name];
  if (!action) throw new SvelteKitError(404, "Not Found", `No action with name '${name}' found`);
  if (!is_form_content_type(event.request)) throw new SvelteKitError(415, "Unsupported Media Type", `Form actions expect form-encoded data \u2014 received ${event.request.headers.get("content-type")}`);
  return record_span({
    name: "sveltekit.form_action",
    attributes: {
      "sveltekit.form_action.name": name,
      "http.route": event.route.id || "unknown"
    },
    fn: /* @__PURE__ */ __name(async (current2) => {
      const traced_event = merge_tracing(event, current2);
      const result = await with_request_store({
        event: traced_event,
        state: event_state
      }, () => action(traced_event));
      if (result instanceof ActionFailure) current2.setAttributes({
        "sveltekit.form_action.result.type": "failure",
        "sveltekit.form_action.result.status": result.status
      });
      return result;
    }, "fn")
  });
}
__name(call_action, "call_action");
function uneval_action_response(data, route_id, transport) {
  const replacer = create_replacer(transport);
  return try_serialize(data, (value) => uneval(value, replacer), route_id);
}
__name(uneval_action_response, "uneval_action_response");
function stringify_action_response(data, route_id, transport) {
  const encoders = Object.fromEntries(Object.entries(transport).map(([key2, value]) => [key2, value.encode]));
  return try_serialize(data, (value) => stringify$1(value, encoders), route_id);
}
__name(stringify_action_response, "stringify_action_response");
function try_serialize(data, fn, route_id) {
  try {
    return fn(data);
  } catch (e3) {
    const error2 = e3;
    if (data instanceof Response) throw new Error(`Data returned from action inside ${route_id} is not serializable. Form actions need to return plain objects or fail(). E.g. return { success: true } or return fail(400, { message: "invalid" });`, { cause: e3 });
    if ("path" in error2) {
      let message = `Data returned from action inside ${route_id} is not serializable: ${error2.message}`;
      if (error2.path !== "") message += ` (data.${error2.path})`;
      throw new Error(message, { cause: e3 });
    }
    throw error2;
  }
}
__name(try_serialize, "try_serialize");
function create_async_iterator() {
  let resolved = -1;
  let returned = -1;
  const deferred2 = [];
  return {
    iterate: /* @__PURE__ */ __name((transform = (x) => x) => {
      return { [Symbol.asyncIterator]() {
        return { next: /* @__PURE__ */ __name(async () => {
          const next2 = deferred2[++returned];
          if (!next2) return {
            value: null,
            done: true
          };
          return {
            value: transform(await next2.promise),
            done: false
          };
        }, "next") };
      } };
    }, "iterate"),
    add: /* @__PURE__ */ __name((promise) => {
      const next2 = with_resolvers();
      next2.promise.catch(noop2);
      deferred2.push(next2);
      promise.then((value) => {
        deferred2[++resolved].resolve(value);
      }, (error2) => {
        deferred2[++resolved].reject(error2);
      });
    }, "add")
  };
}
__name(create_async_iterator, "create_async_iterator");
function server_data_serializer(event, event_state, options2) {
  let promise_id = 1;
  let max_nodes = -1;
  const iterator = create_async_iterator();
  const global = get_global_name(options2);
  function get_replacer(index23) {
    return /* @__PURE__ */ __name(function replacer(thing) {
      if (typeof thing?.then === "function") {
        const id = promise_id++;
        const promise = thing.then(
          /** @param {any} data */
          (data) => ({ data })
        ).catch(
          /** @param {any} error */
          async (error2) => ({ error: await handle_error_and_jsonify(event, event_state, options2, error2) })
        ).then(
          /**
          * @param {{data: any; error: any}} result
          */
          async ({ data, error: error2 }) => {
            let str;
            try {
              str = uneval(error2 ? [, error2] : [data], replacer);
            } catch {
              error2 = await handle_error_and_jsonify(event, event_state, options2, /* @__PURE__ */ new Error(`Failed to serialize promise while rendering ${event.route.id}`));
              str = uneval([, error2], replacer);
            }
            return {
              index: index23,
              str: `${global}.resolve(${id}, ${str.includes("app.decode") ? `(app) => ${str}` : `() => ${str}`})`
            };
          }
        );
        iterator.add(promise);
        return `${global}.defer(${id})`;
      } else for (const key2 in options2.hooks.transport) {
        const encoded = options2.hooks.transport[key2].encode(thing);
        if (encoded) return `app.decode('${key2}', ${uneval(encoded, replacer)})`;
      }
    }, "replacer");
  }
  __name(get_replacer, "get_replacer");
  const strings = [];
  return {
    set_max_nodes(i) {
      max_nodes = i;
    },
    add_node(i, node) {
      try {
        if (!node) {
          strings[i] = "null";
          return;
        }
        const payload2 = {
          type: "data",
          data: node.data,
          uses: serialize_uses(node)
        };
        if (node.slash) payload2.slash = node.slash;
        strings[i] = uneval(payload2, get_replacer(i));
      } catch (e3) {
        e3.path = e3.path.slice(1);
        throw new Error(clarify_devalue_error(event, e3), { cause: e3 });
      }
    },
    get_data(csp) {
      const open = `<script${csp.script_needs_nonce ? ` nonce="${csp.nonce}"` : ""}>`;
      const close = `<\/script>
`;
      return {
        data: `[${compact(max_nodes > -1 ? strings.slice(0, max_nodes) : strings).join(",")}]`,
        chunks: promise_id > 1 ? iterator.iterate(({ index: index23, str }) => {
          if (max_nodes > -1 && index23 >= max_nodes) return "";
          return open + str + close;
        }) : null
      };
    }
  };
}
__name(server_data_serializer, "server_data_serializer");
function server_data_serializer_json(event, event_state, options2) {
  let promise_id = 1;
  const iterator = create_async_iterator();
  const reducers = {
    ...Object.fromEntries(Object.entries(options2.hooks.transport).map(([key2, value]) => [key2, value.encode])),
    /** @param {any} thing */
    Promise: /* @__PURE__ */ __name((thing) => {
      if (typeof thing?.then !== "function") return;
      const id = promise_id++;
      let key2 = "data";
      const promise = thing.catch(
        /** @param {any} e */
        async (e3) => {
          key2 = "error";
          return handle_error_and_jsonify(event, event_state, options2, e3);
        }
      ).then(
        /** @param {any} value */
        async (value) => {
          let str;
          try {
            str = stringify$1(value, reducers);
          } catch {
            const error2 = await handle_error_and_jsonify(event, event_state, options2, /* @__PURE__ */ new Error(`Failed to serialize promise while rendering ${event.route.id}`));
            key2 = "error";
            str = stringify$1(error2, reducers);
          }
          return `{"type":"chunk","id":${id},"${key2}":${str}}
`;
        }
      );
      iterator.add(promise);
      return id;
    }, "Promise")
  };
  const strings = [];
  return {
    add_node(i, node) {
      try {
        if (!node) {
          strings[i] = "null";
          return;
        }
        if (node.type === "error" || node.type === "skip") {
          strings[i] = JSON.stringify(node);
          return;
        }
        strings[i] = `{"type":"data","data":${stringify$1(node.data, reducers)},"uses":${JSON.stringify(serialize_uses(node))}${node.slash ? `,"slash":${JSON.stringify(node.slash)}` : ""}}`;
      } catch (e3) {
        e3.path = "data" + e3.path;
        throw new Error(clarify_devalue_error(event, e3), { cause: e3 });
      }
    },
    get_data() {
      return {
        data: `{"type":"data","nodes":[${strings.join(",")}]}
`,
        chunks: promise_id > 1 ? iterator.iterate() : null
      };
    }
  };
}
__name(server_data_serializer_json, "server_data_serializer_json");
async function load_server_data({ event, event_state, state: state2, node, parent }) {
  if (!node?.server) return null;
  let is_tracking = true;
  const uses = {
    dependencies: /* @__PURE__ */ new Set(),
    params: /* @__PURE__ */ new Set(),
    parent: false,
    route: false,
    url: false,
    search_params: /* @__PURE__ */ new Set()
  };
  const load15 = node.server.load;
  const slash = node.server.trailingSlash;
  if (!load15) return {
    type: "data",
    data: null,
    uses,
    slash
  };
  const url = make_trackable(event.url, () => {
    if (is_tracking) uses.url = true;
  }, (param) => {
    if (is_tracking) uses.search_params.add(param);
  });
  if (state2.prerendering) disable_search(url);
  return {
    type: "data",
    data: await record_span({
      name: "sveltekit.load",
      attributes: {
        "sveltekit.load.node_id": node.server_id || "unknown",
        "sveltekit.load.node_type": get_node_type(node.server_id),
        "sveltekit.load.environment": "server",
        "http.route": event.route.id || "unknown"
      },
      fn: /* @__PURE__ */ __name(async (current2) => {
        const traced_event = merge_tracing(event, current2);
        return await with_request_store({
          event: traced_event,
          state: event_state
        }, () => load15.call(null, {
          ...traced_event,
          fetch: /* @__PURE__ */ __name((info, init2) => {
            new URL(info instanceof Request ? info.url : info, event.url);
            return event.fetch(info, init2);
          }, "fetch"),
          /** @param {string[]} deps */
          depends: /* @__PURE__ */ __name((...deps) => {
            for (const dep of deps) {
              const { href } = new URL(dep, event.url);
              uses.dependencies.add(href);
            }
          }, "depends"),
          params: new Proxy(event.params, { get: /* @__PURE__ */ __name((target, key2) => {
            if (is_tracking) uses.params.add(key2);
            return target[key2];
          }, "get") }),
          parent: /* @__PURE__ */ __name(async () => {
            if (is_tracking) uses.parent = true;
            return parent();
          }, "parent"),
          route: new Proxy(event.route, { get: /* @__PURE__ */ __name((target, key2) => {
            if (is_tracking) uses.route = true;
            return target[key2];
          }, "get") }),
          url,
          untrack(fn) {
            is_tracking = false;
            try {
              return fn();
            } finally {
              is_tracking = true;
            }
          }
        }));
      }, "fn")
    }) ?? null,
    uses,
    slash
  };
}
__name(load_server_data, "load_server_data");
async function load_data({ event, event_state, fetched, node, parent, server_data_promise, state: state2, resolve_opts, csr }) {
  const server_data_node = await server_data_promise;
  const load15 = node?.universal?.load;
  if (!load15) return server_data_node?.data ?? null;
  return await record_span({
    name: "sveltekit.load",
    attributes: {
      "sveltekit.load.node_id": node.universal_id || "unknown",
      "sveltekit.load.node_type": get_node_type(node.universal_id),
      "sveltekit.load.environment": "server",
      "http.route": event.route.id || "unknown"
    },
    fn: /* @__PURE__ */ __name(async (current2) => {
      const traced_event = merge_tracing(event, current2);
      const child_state = {
        ...event_state,
        is_in_universal_load: true
      };
      return await with_request_store({
        event: traced_event,
        state: child_state
      }, () => load15.call(null, {
        url: event.url,
        params: event.params,
        data: server_data_node?.data ?? null,
        route: event.route,
        fetch: create_universal_fetch(event, state2, fetched, csr, resolve_opts),
        setHeaders: event.setHeaders,
        depends: noop2,
        parent,
        untrack: /* @__PURE__ */ __name((fn) => fn(), "untrack"),
        tracing: traced_event.tracing
      }));
    }, "fn")
  }) ?? null;
}
__name(load_data, "load_data");
function create_universal_fetch(event, state2, fetched, csr, resolve_opts) {
  const universal_fetch = /* @__PURE__ */ __name(async (input, init2) => {
    const cloned_body = input instanceof Request && input.body ? input.clone().body : null;
    const cloned_headers = input instanceof Request && [...input.headers].length ? new Headers(input.headers) : init2?.headers;
    let response = await event.fetch(input, init2);
    const url = new URL(input instanceof Request ? input.url : input, event.url);
    const same_origin = url.origin === event.url.origin;
    let dependency;
    if (same_origin) {
      if (state2.prerendering) {
        dependency = {
          response,
          body: null
        };
        state2.prerendering.dependencies.set(url.pathname, dependency);
      }
    } else if (url.protocol === "https:" || url.protocol === "http:") {
      if ((input instanceof Request ? input.mode : init2?.mode ?? "cors") === "no-cors") response = new Response("", {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
      else {
        const acao = response.headers.get("access-control-allow-origin");
        if (!acao || acao !== event.url.origin && acao !== "*") throw new Error(`CORS error: ${acao ? "Incorrect" : "No"} 'Access-Control-Allow-Origin' header is present on the requested resource`);
      }
    }
    let teed_body;
    const proxy3 = new Proxy(response, { get(response2, key2, receiver) {
      async function push_fetched(body, is_b64) {
        const status_number = Number(response2.status);
        if (isNaN(status_number)) throw new Error(`response.status is not a number. value: "${response2.status}" type: ${typeof response2.status}`);
        fetched.push({
          url: same_origin ? url.href.slice(event.url.origin.length) : url.href,
          method: event.request.method,
          request_body: input instanceof Request && cloned_body ? await stream_to_string(cloned_body) : init2?.body,
          request_headers: cloned_headers,
          response_body: body,
          response: response2,
          is_b64
        });
      }
      __name(push_fetched, "push_fetched");
      if (key2 === "body") {
        if (response2.body === null) return null;
        if (teed_body) return teed_body;
        const [a2, b] = response2.body.tee();
        (async () => {
          let result = /* @__PURE__ */ new Uint8Array();
          for await (const chunk of a2) {
            const combined = new Uint8Array(result.length + chunk.length);
            combined.set(result, 0);
            combined.set(chunk, result.length);
            result = combined;
          }
          if (dependency) dependency.body = new Uint8Array(result);
          push_fetched(base64_encode2(result), true);
        })().catch(noop2);
        return teed_body = b;
      }
      if (key2 === "arrayBuffer") return async () => {
        const buffer2 = await response2.arrayBuffer();
        const bytes = new Uint8Array(buffer2);
        if (dependency) dependency.body = bytes;
        if (buffer2 instanceof ArrayBuffer) await push_fetched(base64_encode2(bytes), true);
        return buffer2;
      };
      async function text2() {
        const body = await response2.text();
        if (body === "" && NULL_BODY_STATUS.includes(response2.status)) {
          await push_fetched(void 0, false);
          return;
        }
        if (!body || typeof body === "string") await push_fetched(body, false);
        if (dependency) dependency.body = body;
        return body;
      }
      __name(text2, "text");
      if (key2 === "text") return text2;
      if (key2 === "json") return async () => {
        const body = await text2();
        return body ? JSON.parse(body) : void 0;
      };
      const value = Reflect.get(response2, key2, response2);
      if (value instanceof Function) return Object.defineProperties(
        /**
        * @this {any}
        */
        function() {
          return Reflect.apply(value, this === receiver ? response2 : this, arguments);
        },
        {
          name: { value: value.name },
          length: { value: value.length }
        }
      );
      return value;
    } });
    if (csr) {
      const get2 = response.headers.get;
      response.headers.get = (key2) => {
        const lower = key2.toLowerCase();
        const value = get2.call(response.headers, lower);
        if (value && !lower.startsWith("x-sveltekit-")) {
          if (!resolve_opts.filterSerializedResponseHeaders(lower, value)) throw new Error(`Failed to get response header "${lower}" \u2014 it must be included by the \`filterSerializedResponseHeaders\` option: https://svelte.dev/docs/kit/hooks#handle (at ${event.route.id})`);
        }
        return value;
      };
    }
    return proxy3;
  }, "universal_fetch");
  return (input, init2) => {
    const response = universal_fetch(input, init2);
    response.catch(noop2);
    return response;
  };
}
__name(create_universal_fetch, "create_universal_fetch");
async function stream_to_string(stream) {
  let result = "";
  const reader = stream.getReader();
  const decoder2 = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      result += decoder2.decode();
      break;
    }
    result += decoder2.decode(value, { stream: true });
  }
  return result;
}
__name(stream_to_string, "stream_to_string");
var replacements2 = {
  "<": "\\u003C",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029"
};
var pattern = new RegExp(`[${Object.keys(replacements2).join("")}]`, "g");
function serialize_data(fetched, filter, prerendering = false) {
  const headers2 = {};
  let cache_control = null;
  let age = null;
  let varyAny = false;
  for (const [key2, value] of fetched.response.headers) {
    if (filter(key2, value)) headers2[key2] = value;
    if (key2 === "cache-control") cache_control = value;
    else if (key2 === "age") age = value;
    else if (key2 === "vary" && value.trim() === "*") varyAny = true;
  }
  const payload2 = {
    status: fetched.response.status,
    statusText: fetched.response.statusText,
    headers: headers2,
    body: fetched.response_body
  };
  const safe_payload = JSON.stringify(payload2).replace(pattern, (match) => replacements2[match]);
  const attrs = [
    'type="application/json"',
    "data-sveltekit-fetched",
    `data-url="${escape_html2(fetched.url, true)}"`
  ];
  if (fetched.is_b64) attrs.push("data-b64");
  if (fetched.request_headers || fetched.request_body) {
    const values = [];
    if (fetched.request_headers) values.push([...new Headers(fetched.request_headers)].join(","));
    if (fetched.request_body) values.push(fetched.request_body);
    attrs.push(`data-hash="${hash(...values)}"`);
  }
  if (!prerendering && fetched.method === "GET" && cache_control && !varyAny) {
    const match = /s-maxage=(\d+)/g.exec(cache_control) ?? /max-age=(\d+)/g.exec(cache_control);
    if (match) {
      const ttl = +match[1] - +(age ?? "0");
      attrs.push(`data-ttl="${ttl}"`);
    }
  }
  return `<script ${attrs.join(" ")}>${safe_payload}<\/script>`;
}
__name(serialize_data, "serialize_data");
function sha2562(data) {
  if (!key[0]) precompute();
  const out = init.slice(0);
  const array2 = encode2(data);
  for (let i = 0; i < array2.length; i += 16) {
    const w = array2.subarray(i, i + 16);
    let tmp;
    let a2;
    let b;
    let out0 = out[0];
    let out1 = out[1];
    let out2 = out[2];
    let out3 = out[3];
    let out4 = out[4];
    let out5 = out[5];
    let out6 = out[6];
    let out7 = out[7];
    for (let i2 = 0; i2 < 64; i2++) {
      if (i2 < 16) tmp = w[i2];
      else {
        a2 = w[i2 + 1 & 15];
        b = w[i2 + 14 & 15];
        tmp = w[i2 & 15] = (a2 >>> 7 ^ a2 >>> 18 ^ a2 >>> 3 ^ a2 << 25 ^ a2 << 14) + (b >>> 17 ^ b >>> 19 ^ b >>> 10 ^ b << 15 ^ b << 13) + w[i2 & 15] + w[i2 + 9 & 15] | 0;
      }
      tmp = tmp + out7 + (out4 >>> 6 ^ out4 >>> 11 ^ out4 >>> 25 ^ out4 << 26 ^ out4 << 21 ^ out4 << 7) + (out6 ^ out4 & (out5 ^ out6)) + key[i2];
      out7 = out6;
      out6 = out5;
      out5 = out4;
      out4 = out3 + tmp | 0;
      out3 = out2;
      out2 = out1;
      out1 = out0;
      out0 = tmp + (out1 & out2 ^ out3 & (out1 ^ out2)) + (out1 >>> 2 ^ out1 >>> 13 ^ out1 >>> 22 ^ out1 << 30 ^ out1 << 19 ^ out1 << 10) | 0;
    }
    out[0] = out[0] + out0 | 0;
    out[1] = out[1] + out1 | 0;
    out[2] = out[2] + out2 | 0;
    out[3] = out[3] + out3 | 0;
    out[4] = out[4] + out4 | 0;
    out[5] = out[5] + out5 | 0;
    out[6] = out[6] + out6 | 0;
    out[7] = out[7] + out7 | 0;
  }
  const bytes = new Uint8Array(out.buffer);
  reverse_endianness(bytes);
  return btoa(String.fromCharCode(...bytes));
}
__name(sha2562, "sha256");
var init = /* @__PURE__ */ new Uint32Array(8);
var key = /* @__PURE__ */ new Uint32Array(64);
function precompute() {
  function frac(x) {
    return (x - Math.floor(x)) * 4294967296;
  }
  __name(frac, "frac");
  let prime = 2;
  for (let i = 0; i < 64; prime++) {
    let is_prime = true;
    for (let factor = 2; factor * factor <= prime; factor++) if (prime % factor === 0) {
      is_prime = false;
      break;
    }
    if (is_prime) {
      if (i < 8) init[i] = frac(prime ** (1 / 2));
      key[i] = frac(prime ** (1 / 3));
      i++;
    }
  }
}
__name(precompute, "precompute");
function reverse_endianness(bytes) {
  for (let i = 0; i < bytes.length; i += 4) {
    const a2 = bytes[i + 0];
    const b = bytes[i + 1];
    const c2 = bytes[i + 2];
    const d2 = bytes[i + 3];
    bytes[i + 0] = d2;
    bytes[i + 1] = c2;
    bytes[i + 2] = b;
    bytes[i + 3] = a2;
  }
}
__name(reverse_endianness, "reverse_endianness");
function encode2(str) {
  const encoded = text_encoder2.encode(str);
  const length = encoded.length * 8;
  const size = 512 * Math.ceil((length + 65) / 512);
  const bytes = new Uint8Array(size / 8);
  bytes.set(encoded);
  bytes[encoded.length] = 128;
  reverse_endianness(bytes);
  const words = new Uint32Array(bytes.buffer);
  words[words.length - 2] = Math.floor(length / 4294967296);
  words[words.length - 1] = length;
  return words;
}
__name(encode2, "encode");
var array = /* @__PURE__ */ new Uint8Array(16);
function generate_nonce() {
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}
__name(generate_nonce, "generate_nonce");
var quoted = /* @__PURE__ */ new Set([
  "self",
  "unsafe-eval",
  "unsafe-hashes",
  "unsafe-inline",
  "none",
  "strict-dynamic",
  "report-sample",
  "wasm-unsafe-eval",
  "script"
]);
var crypto_pattern = /^(nonce|sha\d\d\d)-/;
var BaseProvider = class {
  static {
    __name(this, "BaseProvider");
  }
  /** @type {boolean} */
  #use_hashes;
  /** @type {boolean} */
  #script_needs_csp;
  /** @type {boolean} */
  #script_src_needs_csp;
  /** @type {boolean} */
  #script_src_elem_needs_csp;
  /** @type {boolean} */
  #style_needs_csp;
  /** @type {boolean} */
  #style_src_needs_csp;
  /** @type {boolean} */
  #style_src_attr_needs_csp;
  /** @type {boolean} */
  #style_src_elem_needs_csp;
  /** @type {import('types').CspDirectives} */
  #directives;
  /** @type {Set<import('types').Csp.Source>} */
  #script_src;
  /** @type {Set<import('types').Csp.Source>} */
  #script_src_elem;
  /** @type {Set<import('types').Csp.Source>} */
  #style_src;
  /** @type {Set<import('types').Csp.Source>} */
  #style_src_attr;
  /** @type {Set<import('types').Csp.Source>} */
  #style_src_elem;
  /** @type {boolean} */
  script_needs_nonce;
  /** @type {boolean} */
  style_needs_nonce;
  /** @type {boolean} */
  script_needs_hash;
  /** @type {string} */
  #nonce;
  /**
  * @param {boolean} use_hashes
  * @param {import('types').CspDirectives} directives
  * @param {string} nonce
  */
  constructor(use_hashes, directives, nonce) {
    this.#use_hashes = use_hashes;
    this.#directives = directives;
    const d2 = this.#directives;
    this.#script_src = /* @__PURE__ */ new Set();
    this.#script_src_elem = /* @__PURE__ */ new Set();
    this.#style_src = /* @__PURE__ */ new Set();
    this.#style_src_attr = /* @__PURE__ */ new Set();
    this.#style_src_elem = /* @__PURE__ */ new Set();
    const effective_script_src = d2["script-src"] || d2["default-src"];
    const script_src_elem = d2["script-src-elem"];
    const effective_style_src = d2["style-src"] || d2["default-src"];
    const style_src_attr = d2["style-src-attr"];
    const style_src_elem = d2["style-src-elem"];
    const style_needs_csp = /* @__PURE__ */ __name((directive) => !!directive && !directive.some((value) => value === "unsafe-inline"), "style_needs_csp");
    const script_needs_csp = /* @__PURE__ */ __name((directive) => !!directive && (!directive.some((value) => value === "unsafe-inline") || directive.some((value) => value === "strict-dynamic")), "script_needs_csp");
    this.#script_src_needs_csp = script_needs_csp(effective_script_src);
    this.#script_src_elem_needs_csp = script_needs_csp(script_src_elem);
    this.#style_src_needs_csp = style_needs_csp(effective_style_src);
    this.#style_src_attr_needs_csp = style_needs_csp(style_src_attr);
    this.#style_src_elem_needs_csp = style_needs_csp(style_src_elem);
    this.#script_needs_csp = this.#script_src_needs_csp || this.#script_src_elem_needs_csp;
    this.#style_needs_csp = this.#style_src_needs_csp || this.#style_src_attr_needs_csp || this.#style_src_elem_needs_csp;
    this.script_needs_nonce = this.#script_needs_csp && !this.#use_hashes;
    this.style_needs_nonce = this.#style_needs_csp && !this.#use_hashes;
    this.script_needs_hash = this.#script_needs_csp && this.#use_hashes;
    this.#nonce = nonce;
  }
  /** @param {string} content */
  add_script(content) {
    if (!this.#script_needs_csp) return;
    const source2 = this.#use_hashes ? `sha256-${sha2562(content)}` : `nonce-${this.#nonce}`;
    if (this.#script_src_needs_csp) this.#script_src.add(source2);
    if (this.#script_src_elem_needs_csp) this.#script_src_elem.add(source2);
  }
  /** @param {`sha256-${string}`[]} hashes */
  add_script_hashes(hashes) {
    for (const hash2 of hashes) {
      if (this.#script_src_needs_csp) this.#script_src.add(hash2);
      if (this.#script_src_elem_needs_csp) this.#script_src_elem.add(hash2);
    }
  }
  /** @param {string} content */
  add_style(content) {
    if (!this.#style_needs_csp) return;
    const source2 = this.#use_hashes ? `sha256-${sha2562(content)}` : `nonce-${this.#nonce}`;
    if (this.#style_src_needs_csp) this.#style_src.add(source2);
    if (this.#style_src_attr_needs_csp) this.#style_src_attr.add(source2);
    if (this.#style_src_elem_needs_csp) {
      const sha256_empty_comment_hash = "sha256-9OlNO0DNEeaVzHL4RZwCLsBHA8WBQ8toBp/4F5XV2nc=";
      const d2 = this.#directives;
      if (d2["style-src-elem"] && !d2["style-src-elem"].includes(sha256_empty_comment_hash) && !this.#style_src_elem.has(sha256_empty_comment_hash)) this.#style_src_elem.add(sha256_empty_comment_hash);
      if (source2 !== sha256_empty_comment_hash) this.#style_src_elem.add(source2);
    }
  }
  /**
  * @param {boolean} [is_meta]
  */
  get_header(is_meta = false) {
    const header = [];
    const directives = { ...this.#directives };
    if (this.#style_src.size > 0) directives["style-src"] = [...directives["style-src"] || directives["default-src"] || [], ...this.#style_src];
    if (this.#style_src_attr.size > 0) directives["style-src-attr"] = [...directives["style-src-attr"] || [], ...this.#style_src_attr];
    if (this.#style_src_elem.size > 0) directives["style-src-elem"] = [...directives["style-src-elem"] || [], ...this.#style_src_elem];
    if (this.#script_src.size > 0) directives["script-src"] = [...directives["script-src"] || directives["default-src"] || [], ...this.#script_src];
    if (this.#script_src_elem.size > 0) directives["script-src-elem"] = [...directives["script-src-elem"] || [], ...this.#script_src_elem];
    for (const key2 in directives) {
      if (is_meta && (key2 === "frame-ancestors" || key2 === "report-uri" || key2 === "sandbox")) continue;
      const value = directives[key2];
      if (!value) continue;
      const directive = [key2];
      if (Array.isArray(value)) value.forEach((value2) => {
        if (quoted.has(value2) || crypto_pattern.test(value2)) directive.push(`'${value2}'`);
        else directive.push(value2);
      });
      header.push(directive.join(" "));
    }
    return header.join("; ");
  }
};
var CspProvider = class extends BaseProvider {
  static {
    __name(this, "CspProvider");
  }
  get_meta() {
    const content = this.get_header(true);
    if (!content) return;
    return `<meta http-equiv="content-security-policy" content="${escape_html2(content, true)}">`;
  }
};
var CspReportOnlyProvider = class extends BaseProvider {
  static {
    __name(this, "CspReportOnlyProvider");
  }
  /**
  * @param {boolean} use_hashes
  * @param {import('types').CspDirectives} directives
  * @param {string} nonce
  */
  constructor(use_hashes, directives, nonce) {
    super(use_hashes, directives, nonce);
    if (Object.values(directives).filter((v) => !!v).length > 0) {
      const has_report_to = directives["report-to"]?.length ?? false;
      const has_report_uri = directives["report-uri"]?.length ?? false;
      if (!has_report_to && !has_report_uri) throw Error("`content-security-policy-report-only` must be specified with either the `report-to` or `report-uri` directives, or both");
    }
  }
};
var Csp = class {
  static {
    __name(this, "Csp");
  }
  /** @readonly */
  nonce = generate_nonce();
  /** @type {CspProvider} */
  csp_provider;
  /** @type {CspReportOnlyProvider} */
  report_only_provider;
  /**
  * @param {import('./types.js').CspConfig} config
  * @param {import('./types.js').CspOpts} opts
  */
  constructor({ mode, directives, reportOnly }, { prerender }) {
    const use_hashes = mode === "hash" || mode === "auto" && prerender;
    this.csp_provider = new CspProvider(use_hashes, directives, this.nonce);
    this.report_only_provider = new CspReportOnlyProvider(use_hashes, reportOnly, this.nonce);
  }
  get script_needs_hash() {
    return this.csp_provider.script_needs_hash || this.report_only_provider.script_needs_hash;
  }
  get script_needs_nonce() {
    return this.csp_provider.script_needs_nonce || this.report_only_provider.script_needs_nonce;
  }
  get style_needs_nonce() {
    return this.csp_provider.style_needs_nonce || this.report_only_provider.style_needs_nonce;
  }
  /** @param {string} content */
  add_script(content) {
    this.csp_provider.add_script(content);
    this.report_only_provider.add_script(content);
  }
  /** @param {`sha256-${string}`[]} hashes */
  add_script_hashes(hashes) {
    this.csp_provider.add_script_hashes(hashes);
    this.report_only_provider.add_script_hashes(hashes);
  }
  /** @param {string} content */
  add_style(content) {
    this.csp_provider.add_style(content);
    this.report_only_provider.add_style(content);
  }
};
function generate_route_object(route, url, client) {
  const { errors, layouts, leaf } = route;
  const nodes = [
    ...errors,
    ...layouts.map((l2) => l2?.[1]),
    leaf[1]
  ].filter((n2) => typeof n2 === "number").map((n2) => `'${n2}': () => ${create_client_import(client.nodes?.[n2], url)}`).join(",\n		");
  return [
    `{
	id: ${s(route.id)}`,
    `errors: ${s(route.errors)}`,
    `layouts: ${s(route.layouts)}`,
    `leaf: ${s(route.leaf)}`,
    `nodes: {
		${nodes}
	}
}`
  ].join(",\n	");
}
__name(generate_route_object, "generate_route_object");
function create_client_import(import_path, url) {
  if (!import_path) return "Promise.resolve({})";
  if (import_path[0] === "/") return `import('${import_path}')`;
  if (assets !== "") return `import('${assets}/${import_path}')`;
  let path = get_relative_path(url.pathname, `${base}/${import_path}`);
  if (path[0] !== ".") path = `./${path}`;
  return `import('${path}')`;
}
__name(create_client_import, "create_client_import");
async function resolve_route(resolved_path, url, manifest2) {
  if (!manifest2._.client?.routes) return text("Server-side route resolution disabled", { status: 400 });
  const matchers = await manifest2._.matchers();
  const result = find_route(resolved_path, manifest2._.client.routes, matchers);
  return create_server_routing_response(result?.route ?? null, result?.params ?? {}, url, manifest2._.client).response;
}
__name(resolve_route, "resolve_route");
function create_server_routing_response(route, params, url, client) {
  const headers2 = new Headers({ "content-type": "application/javascript; charset=utf-8" });
  if (route) {
    const csr_route = generate_route_object(route, url, client);
    const body = `${create_css_import(route, url, client)}
export const route = ${csr_route}; export const params = ${JSON.stringify(params)};`;
    return {
      response: text(body, { headers: headers2 }),
      body
    };
  } else return {
    response: text("", { headers: headers2 }),
    body: ""
  };
}
__name(create_server_routing_response, "create_server_routing_response");
function create_css_import(route, url, client) {
  const { errors, layouts, leaf } = route;
  let css = "";
  for (const node of [
    ...errors,
    ...layouts.map((l2) => l2?.[1]),
    leaf[1]
  ]) {
    if (typeof node !== "number") continue;
    const node_css = client.css?.[node];
    for (const css_path of node_css ?? []) css += `'${assets || base}/${css_path}',`;
  }
  if (!css) return "";
  return `${create_client_import(client.start, url)}.then(x => x.load_css([${css}]));`;
}
__name(create_css_import, "create_css_import");
async function handle_remote_call(event, state2, options2, manifest2, id) {
  return record_span({
    name: "sveltekit.remote.call",
    attributes: { "sveltekit.remote.call.id": id },
    fn: /* @__PURE__ */ __name((current2) => {
      const traced_event = merge_tracing(event, current2);
      return with_request_store({
        event: traced_event,
        state: state2
      }, () => handle_remote_call_internal(traced_event, state2, options2, manifest2, id));
    }, "fn")
  });
}
__name(handle_remote_call, "handle_remote_call");
async function handle_remote_call_internal(event, state2, options2, manifest2, id) {
  const [hash2, name, additional_args] = id.split("/");
  const remotes = manifest2._.remotes;
  if (!remotes[hash2]) error(404);
  const fn = (await remotes[hash2]()).default[name];
  if (!fn) error(404);
  const internals = fn.__;
  const transport = options2.hooks.transport;
  event.tracing.current.setAttributes({
    "sveltekit.remote.call.type": internals.type,
    "sveltekit.remote.call.name": internals.name
  });
  const headers2 = state2.prerendering ? void 0 : { "cache-control": "private, no-store" };
  try {
    const data = {};
    switch (internals.type) {
      case "query_live": {
        let send = function(controller, payload3) {
          controller.enqueue(encoder.encode("data: " + JSON.stringify(payload3) + "\n\n"));
        };
        __name(send, "send");
        if (event.request.method !== "GET") throw new SvelteKitError(405, "Method Not Allowed", `\`query.live\` functions must be invoked via GET request, not ${event.request.method}`);
        const payload2 = new URL(event.request.url).searchParams.get("payload");
        const generator = internals.run(event, state2, parse_remote_arg(payload2, transport));
        const encoder = new TextEncoder();
        let closed = false;
        let result = void 0;
        async function cancel() {
          if (closed) return;
          closed = true;
          await generator.return(void 0);
        }
        __name(cancel, "cancel");
        event.request.signal.addEventListener("abort", cancel, { once: true });
        return new Response(new ReadableStream({
          async pull(controller) {
            if (event.request.signal.aborted) {
              await cancel();
              controller.close();
              return;
            }
            try {
              while (true) {
                const { value, done } = await generator.next();
                if (done) {
                  await cancel();
                  controller.close();
                  return;
                }
                if (result !== (result = stringify2(value, transport))) {
                  send(controller, {
                    type: "result",
                    result
                  });
                  return;
                }
              }
            } catch (error2) {
              if (!event.request.signal.aborted) {
                if (error2 instanceof Redirect) send(controller, {
                  type: "redirect",
                  location: error2.location
                });
                else {
                  const status = error2 instanceof HttpError || error2 instanceof SvelteKitError ? error2.status : 500;
                  send(controller, {
                    type: "error",
                    error: await handle_error_and_jsonify(event, state2, options2, error2),
                    status
                  });
                }
              }
              await cancel();
              controller.close();
            }
          },
          cancel
        }), { headers: {
          "cache-control": "private, no-store",
          "content-type": "text/event-stream"
        } });
      }
      case "query_batch": {
        if (event.request.method !== "POST") throw new SvelteKitError(405, "Method Not Allowed", `\`query.batch\` functions must be invoked via POST request, not ${event.request.method}`);
        const { payloads } = await event.request.json();
        const args = await Promise.all(payloads.map((payload2) => parse_remote_arg(payload2, transport)));
        data._ = await with_request_store({
          event,
          state: state2
        }, () => internals.run(args, options2));
        break;
      }
      case "form": {
        if (event.request.method !== "POST") throw new SvelteKitError(405, "Method Not Allowed", `\`form\` functions must be invoked via POST request, not ${event.request.method}`);
        if (!is_form_content_type(event.request)) throw new SvelteKitError(415, "Unsupported Media Type", `\`form\` functions expect form-encoded data \u2014 received ${event.request.headers.get("content-type")}`);
        const { data: input, meta, form_data } = await deserialize_binary_form(event.request);
        state2.remote.requested = create_requested_map(meta.remote_refreshes);
        if (additional_args && !("id" in input)) input.id = JSON.parse(decodeURIComponent(additional_args));
        const fn2 = internals.fn;
        data._ = await with_request_store({
          event,
          state: {
            ...state2,
            is_in_remote_form_or_command: true
          }
        }, () => fn2(input, meta, form_data));
        if (data._.issues) return json({
          type: "result",
          data: stringify2(data, transport)
        }, { headers: headers2 });
        break;
      }
      case "command": {
        const { payload: payload2, refreshes } = await event.request.json();
        state2.remote.requested = create_requested_map(refreshes);
        const arg = parse_remote_arg(payload2, transport);
        data._ = await with_request_store({
          event,
          state: {
            ...state2,
            is_in_remote_form_or_command: true
          }
        }, () => fn(arg));
        break;
      }
      case "prerender":
        data._ = await with_request_store({
          event,
          state: state2
        }, () => fn(parse_remote_arg(additional_args, transport)));
        break;
      case "query": {
        const payload2 = new URL(event.request.url).searchParams.get("payload");
        data._ = await with_request_store({
          event,
          state: state2
        }, () => fn(parse_remote_arg(payload2, transport)));
        break;
      }
    }
    await collect_remote_data(data, event, state2, options2);
    return json({
      type: "result",
      data: stringify2(data, transport)
    }, { headers: headers2 });
  } catch (error2) {
    if (error2 instanceof Redirect) {
      const data = await collect_remote_data({ redirect: error2.location }, event, state2, options2);
      return json({
        type: "result",
        data: stringify2(data, transport)
      }, { headers: headers2 });
    }
    const status = error2 instanceof HttpError || error2 instanceof SvelteKitError ? error2.status : 500;
    return json({
      type: "error",
      error: await handle_error_and_jsonify(event, state2, options2, error2),
      status
    }, {
      status: state2.prerendering ? status : void 0,
      headers: { "cache-control": "private, no-store" }
    });
  }
}
__name(handle_remote_call_internal, "handle_remote_call_internal");
async function collect_remote_data(data, event, state2, options2) {
  async function convert_error(error2) {
    return [error2 instanceof HttpError || error2 instanceof SvelteKitError ? error2.status : 500, await handle_error_and_jsonify(event, state2, options2, error2)];
  }
  __name(convert_error, "convert_error");
  const promises = [];
  if (state2.remote.explicit) for (const [remote_key, { internals, promise }] of state2.remote.explicit) {
    data.r = true;
    const type = internals.type === "query_live" ? "l" : internals.type[0];
    await promise.then((v) => {
      ((data[type] ??= {})[remote_key] ??= {}).v = v;
    }, async (e3) => {
      if (e3 instanceof Redirect) return;
      ((data[type] ??= {})[remote_key] ??= {}).e = await convert_error(e3);
    });
  }
  await Promise.all(promises);
  if (state2.remote.implicit) for (const [internals, record] of state2.remote.implicit) {
    if (!internals.id) continue;
    for (const key2 in record) {
      const remote_key = internals.type === "form" ? key2 : create_remote_key(internals.id, key2);
      const type = internals.type === "query_live" ? "l" : internals.type[0];
      const promise = state2.remote.data?.get(internals)?.[key2] ?? record[key2]();
      let resolved = true;
      await Promise.race([Promise.resolve(promise).then((v) => {
        if (resolved) ((data[type] ??= {})[remote_key] ??= {}).v = v;
      }, (e3) => {
        if (e3 instanceof Redirect) return;
        if (resolved) promises.push(convert_error(e3).then((e4) => {
          ((data[type] ??= {})[remote_key] ??= {}).e = e4;
        }));
      }), Promise.resolve().then(() => resolved = false)]);
    }
  }
  await Promise.all(promises);
  return data;
}
__name(collect_remote_data, "collect_remote_data");
function create_requested_map(refreshes) {
  const requested = /* @__PURE__ */ new Map();
  for (const key2 of refreshes ?? []) {
    const parts = split_remote_key(key2);
    const existing = requested.get(parts.id);
    if (existing) existing.push(parts.payload);
    else requested.set(parts.id, [parts.payload]);
  }
  return requested;
}
__name(create_requested_map, "create_requested_map");
async function handle_remote_form_post(event, state2, manifest2, id) {
  return record_span({
    name: "sveltekit.remote.form.post",
    attributes: { "sveltekit.remote.form.post.id": id },
    fn: /* @__PURE__ */ __name((current2) => {
      const traced_event = merge_tracing(event, current2);
      return with_request_store({
        event: traced_event,
        state: state2
      }, () => handle_remote_form_post_internal(traced_event, state2, manifest2, id));
    }, "fn")
  });
}
__name(handle_remote_form_post, "handle_remote_form_post");
async function handle_remote_form_post_internal(event, state2, manifest2, id) {
  const [hash2, name, ...rest] = id.split("/");
  const action_id = rest.join("/");
  let form = (await manifest2._.remotes[hash2]?.())?.default[name];
  if (!form) {
    event.setHeaders({ allow: "GET" });
    return {
      type: "error",
      error: new SvelteKitError(405, "Method Not Allowed", `POST method not allowed. No form actions exist for this page`)
    };
  }
  if (action_id) form = with_request_store({
    event,
    state: state2
  }, () => form.for(JSON.parse(action_id)));
  try {
    const fn = form.__.fn;
    const { data, meta, form_data } = await deserialize_binary_form(event.request);
    if (action_id && !("id" in data)) data.id = JSON.parse(decodeURIComponent(action_id));
    await with_request_store({
      event,
      state: {
        ...state2,
        is_in_remote_form_or_command: true
      }
    }, () => fn(data, meta, form_data));
    return {
      type: "success",
      status: 200
    };
  } catch (e3) {
    const err = normalize_error(e3);
    if (err instanceof Redirect) return {
      type: "redirect",
      status: err.status,
      location: err.location
    };
    return {
      type: "error",
      error: check_incorrect_fail_use(err)
    };
  }
}
__name(handle_remote_form_post_internal, "handle_remote_form_post_internal");
function get_remote_id(url) {
  return url.pathname.startsWith(`${base}/_app/remote/`) && url.pathname.replace(`${base}/_app/remote/`, "");
}
__name(get_remote_id, "get_remote_id");
function get_remote_action(url) {
  return url.searchParams.get("/remote");
}
__name(get_remote_action, "get_remote_action");
var updated = {
  ...readable(false),
  check: /* @__PURE__ */ __name(() => false, "check")
};
async function render_response({ branch: branch3, fetched, options: options2, manifest: manifest2, state: state2, page_config, status, error: error2 = null, event, event_state, resolve_opts, action_result, data_serializer, error_components }) {
  if (state2.prerendering) {
    if (options2.csp.mode === "nonce") throw new Error('Cannot use prerendering if config.kit.csp.mode === "nonce"');
    if (options2.app_template_contains_nonce) throw new Error("Cannot use prerendering if page template contains %sveltekit.nonce%");
  }
  const { client } = manifest2._;
  const modulepreloads = new Set(client?.imports);
  const stylesheets23 = new Set(client?.stylesheets);
  const fonts23 = new Set(client?.fonts);
  const link_headers = /* @__PURE__ */ new Set();
  const inline_styles = /* @__PURE__ */ new Map();
  let rendered;
  const form_value = action_result?.type === "success" || action_result?.type === "failure" ? action_result.data ?? null : null;
  let base$1 = base;
  let assets$1 = assets;
  let base_expression = s(base);
  const csp = new Csp(options2.csp, { prerender: !!state2.prerendering });
  if (!state2.prerendering?.fallback) {
    base$1 = (event.isDataRequest ? add_data_suffix2(event.url.pathname) : event.url.pathname).slice(base.length).split("/").slice(2).map(() => "..").join("/") || ".";
    base_expression = `new URL(${s(base$1)}, location).pathname.slice(0, -1)`;
    if (!assets || assets[0] === "/" && assets !== "/_svelte_kit_assets") assets$1 = base$1;
  } else if (options2.hash_routing) base_expression = "new URL('.', location).pathname.slice(0, -1)";
  if (page_config.ssr) {
    const props = {
      stores: {
        page: writable(null),
        navigating: writable(null),
        updated
      },
      constructors: await Promise.all(branch3.map(({ node }) => {
        if (!node.component) throw new Error(`Missing +page.svelte component for route ${event.route.id}`);
        return node.component();
      })),
      form: form_value
    };
    if (error_components) {
      if (error2) props.error = error2;
      props.errors = error_components;
    }
    let data2 = {};
    for (let i = 0; i < branch3.length; i += 1) {
      data2 = {
        ...data2,
        ...branch3[i].data
      };
      props[`data_${i}`] = data2;
    }
    props.page = {
      error: error2,
      params: event.params,
      route: event.route,
      status,
      url: event.url,
      data: data2,
      form: form_value,
      state: {}
    };
    const render_opts = {
      context: /* @__PURE__ */ new Map([["__request__", { page: props.page }]]),
      csp: csp.script_needs_nonce ? { nonce: csp.nonce } : { hash: csp.script_needs_hash },
      transformError: error_components ? async (e3) => {
        if (isRedirect(e3)) throw e3;
        const transformed2 = await handle_error_and_jsonify(event, event_state, options2, e3);
        props.page.error = props.error = error2 = transformed2;
        props.page.status = status = get_status(e3);
        return transformed2;
      } : void 0
    };
    globalThis.fetch;
    try {
      const state3 = {
        ...event_state,
        is_in_render: true
      };
      rendered = await with_request_store({
        event,
        state: state3
      }, async () => {
        override({
          base: base$1,
          assets: assets$1
        });
        const maybe_promise = options2.root.render(props, render_opts);
        const rendered2 = options2.async && "then" in maybe_promise ? maybe_promise.then((r3) => r3) : maybe_promise;
        if (options2.async) reset();
        const { head: head3, html: html2, css, hashes } = options2.async ? await rendered2 : rendered2;
        if (hashes) csp.add_script_hashes(hashes.script);
        return {
          head: head3,
          html: html2,
          css,
          hashes
        };
      });
    } finally {
      reset();
    }
  } else rendered = {
    head: "",
    html: "",
    css: {
      code: "",
      map: null
    },
    hashes: { script: [] }
  };
  for (const { node } of branch3) {
    for (const url of node.imports) modulepreloads.add(url);
    for (const url of node.stylesheets) stylesheets23.add(url);
    for (const url of node.fonts) fonts23.add(url);
    if (node.inline_styles && !client?.inline) Object.entries(await node.inline_styles()).forEach(([filename, css]) => {
      if (typeof css === "string") {
        inline_styles.set(filename, css);
        return;
      }
      inline_styles.set(filename, css(`${assets$1}/${app_dir}/immutable/assets`, assets$1));
    });
  }
  const head2 = new Head(rendered.head, !!state2.prerendering);
  let body = rendered.html;
  const prefixed = /* @__PURE__ */ __name((path) => {
    if (path.startsWith("/")) return base + path;
    return `${assets$1}/${path}`;
  }, "prefixed");
  const style = client?.inline ? client.inline?.style : Array.from(inline_styles.values()).join("\n");
  if (style) {
    const attributes2 = [];
    if (csp.style_needs_nonce) attributes2.push(`nonce="${csp.nonce}"`);
    csp.add_style(style);
    head2.add_style(style, attributes2);
  }
  for (const dep of stylesheets23) {
    const path = prefixed(dep);
    const attributes2 = ['rel="stylesheet"'];
    if (inline_styles.has(dep)) attributes2.push("disabled", 'media="(max-width: 0)"');
    else if (resolve_opts.preload({
      type: "css",
      path
    })) link_headers.add(`<${encodeURI(path)}>; rel="preload"; as="style"; nopush`);
    head2.add_stylesheet(path, attributes2);
  }
  for (const dep of fonts23) {
    const path = prefixed(dep);
    if (resolve_opts.preload({
      type: "font",
      path
    })) {
      const ext = dep.slice(dep.lastIndexOf(".") + 1);
      head2.add_link_tag(path, [
        'rel="preload"',
        'as="font"',
        `type="font/${ext}"`,
        "crossorigin"
      ]);
      link_headers.add(`<${encodeURI(path)}>; rel="preload"; as="font"; type="font/${ext}"; crossorigin; nopush`);
    }
  }
  const global = get_global_name(options2);
  const { data, chunks } = data_serializer.get_data(csp);
  if (page_config.ssr && page_config.csr) body += `
			${fetched.map((item) => serialize_data(item, resolve_opts.filterSerializedResponseHeaders, !!state2.prerendering)).join("\n			")}`;
  if (page_config.csr && client) {
    const route = client.routes?.find((r3) => r3.id === event.route.id) ?? null;
    const load_env_eagerly = client.uses_env_dynamic_public && !!state2.prerendering;
    if (load_env_eagerly) modulepreloads.add(`${app_dir}/env.js`);
    if (!client.inline) {
      const included_modulepreloads = Array.from(modulepreloads, (dep) => prefixed(dep)).filter((path) => resolve_opts.preload({
        type: "js",
        path
      }));
      for (const path of included_modulepreloads) {
        link_headers.add(`<${encodeURI(path)}>; rel="modulepreload"; nopush`);
        if (options2.preload_strategy !== "modulepreload") head2.add_script_preload(path);
        else head2.add_link_tag(path, ['rel="modulepreload"']);
      }
    }
    if (client.routes && state2.prerendering && !state2.prerendering.fallback) {
      const pathname = add_resolution_suffix2(event.url.pathname);
      state2.prerendering.dependencies.set(pathname, create_server_routing_response(route, event.params, new URL(pathname, event.url), client));
    }
    const blocks = [];
    const properties = [`base: ${base_expression}`];
    if (assets) properties.push(`assets: ${s(assets)}`);
    if (client.uses_env_dynamic_public) properties.push(`env: ${load_env_eagerly ? "null" : s(public_env)}`);
    if (chunks) {
      blocks.push("const deferred = new Map();");
      properties.push(`defer: (id) => new Promise((fulfil, reject) => {
							deferred.set(id, { fulfil, reject });
						})`);
      let app_declaration = "";
      if (Object.keys(options2.hooks.transport).length > 0) {
        if (client.inline) app_declaration = `const app = ${global}.app.app;`;
        else if (client.app) app_declaration = `const app = await import(${s(prefixed(client.app))});`;
        else app_declaration = `const { app } = await import(${s(prefixed(client.start))});`;
      }
      const prelude = app_declaration ? `${app_declaration}
							const [data, error] = fn(app);` : `const [data, error] = fn();`;
      properties.push(`resolve: async (id, fn) => {
							${prelude}

							const try_to_resolve = () => {
								if (!deferred.has(id)) {
									setTimeout(try_to_resolve, 0);
									return;
								}
								const { fulfil, reject } = deferred.get(id);
								deferred.delete(id);
								if (error) reject(error);
								else fulfil(data);
							}
							try_to_resolve();
						}`);
    }
    blocks.push(`${global} = {
						${properties.join(",\n						")}
					};`);
    const args = ["element"];
    blocks.push("const element = document.currentScript.parentElement;");
    if (page_config.ssr) {
      const serialized = {
        form: "null",
        error: "null"
      };
      if (form_value) serialized.form = uneval_action_response(form_value, event.route.id, options2.hooks.transport);
      if (error2) serialized.error = uneval(error2);
      const hydrate3 = [
        `node_ids: [${branch3.map(({ node }) => node.index).join(", ")}]`,
        `data: ${data}`,
        `form: ${serialized.form}`,
        `error: ${serialized.error}`
      ];
      if (status !== 200) hydrate3.push(`status: ${status}`);
      if (client.routes) {
        if (route) {
          const stringified = generate_route_object(route, event.url, client).replaceAll("\n", "\n							");
          hydrate3.push(`params: ${uneval(event.params)}`, `server_route: ${stringified}`);
        }
      } else if (options2.embedded) hydrate3.push(`params: ${uneval(event.params)}`, `route: ${s(event.route)}`);
      const indent = "	".repeat(load_env_eagerly ? 7 : 6);
      args.push(`{
${indent}	${hydrate3.join(`,
${indent}	`)}
${indent}}`);
    }
    const remote_data = await collect_remote_data({}, event, event_state, options2);
    const serialized_data = Object.keys(remote_data).length > 0 ? `${global}.data = ${uneval(remote_data, create_replacer(options2.hooks.transport))};

						` : "";
    const boot = client.inline ? `${client.inline.script}

					${serialized_data}${global}.app.start(${args.join(", ")});` : client.app ? `Promise.all([
						import(${s(prefixed(client.start))}),
						import(${s(prefixed(client.app))})
					]).then(([kit, app]) => {
						${serialized_data}kit.start(app, ${args.join(", ")});
					});` : `import(${s(prefixed(client.start))}).then((app) => {
						${serialized_data}app.start(${args.join(", ")})
					});`;
    if (load_env_eagerly) blocks.push(`import(${s(`${base$1}/${app_dir}/env.js`)}).then(({ env }) => {
						${global}.env = env;

						${boot.replace(/\n/g, "\n	")}
					});`);
    else blocks.push(boot);
    if (options2.service_worker) {
      let opts = "";
      if (options2.service_worker_options != null) opts = `, ${s({ ...options2.service_worker_options })}`;
      blocks.push(`if ('serviceWorker' in navigator) {
						const script_url = '${prefixed("service-worker.js")}';
						const policy = globalThis?.window?.trustedTypes?.createPolicy(
							'sveltekit-trusted-url',
							{ createScriptURL(url) { return url; } }
						);
						const sanitised = policy?.createScriptURL(script_url) ?? script_url;
						addEventListener('load', function () {
							navigator.serviceWorker.register(sanitised${opts});
						});
					}`);
    }
    const init_app = `
				{
					${blocks.join("\n\n					")}
				}
			`;
    csp.add_script(init_app);
    body += `
			<script${csp.script_needs_nonce ? ` nonce="${csp.nonce}"` : ""}>${init_app}<\/script>
		`;
  }
  const headers2 = new Headers({
    "x-sveltekit-page": "true",
    "content-type": "text/html"
  });
  if (state2.prerendering) {
    const csp_headers = csp.csp_provider.get_meta();
    if (csp_headers) head2.add_http_equiv(csp_headers);
    if (state2.prerendering.cache) head2.add_http_equiv(`<meta http-equiv="cache-control" content="${state2.prerendering.cache}">`);
  } else {
    const csp_header = csp.csp_provider.get_header();
    if (csp_header) headers2.set("content-security-policy", csp_header);
    const report_only_header = csp.report_only_provider.get_header();
    if (report_only_header) headers2.set("content-security-policy-report-only", report_only_header);
    if (link_headers.size) headers2.set("link", Array.from(link_headers).join(", "));
  }
  const html = options2.templates.app({
    head: head2.build(),
    body,
    assets: assets$1,
    nonce: csp.nonce,
    env: public_env
  });
  const transformed = await resolve_opts.transformPageChunk({
    html,
    done: true
  }) || "";
  if (!chunks) headers2.set("etag", `"${hash(transformed)}"`);
  return !chunks ? text(transformed, {
    status,
    headers: headers2
  }) : new Response(new ReadableStream({
    async start(controller) {
      controller.enqueue(text_encoder2.encode(transformed + "\n"));
      for await (const chunk of chunks) if (chunk.length) controller.enqueue(text_encoder2.encode(chunk));
      controller.close();
    },
    type: "bytes"
  }), { headers: headers2 });
}
__name(render_response, "render_response");
var Head = class {
  static {
    __name(this, "Head");
  }
  #rendered;
  #prerendering;
  /** @type {string[]} */
  #http_equiv = [];
  /** @type {string[]} */
  #link_tags = [];
  /** @type {string[]} */
  #script_preloads = [];
  /** @type {string[]} */
  #style_tags = [];
  /** @type {string[]} */
  #stylesheet_links = [];
  /**
  * @param {string} rendered
  * @param {boolean} prerendering
  */
  constructor(rendered, prerendering) {
    this.#rendered = rendered;
    this.#prerendering = prerendering;
  }
  build() {
    return [
      ...this.#http_equiv,
      ...this.#link_tags,
      ...this.#script_preloads,
      this.#rendered,
      ...this.#style_tags,
      ...this.#stylesheet_links
    ].join("\n		");
  }
  /**
  * @param {string} style
  * @param {string[]} attributes
  */
  add_style(style, attributes2) {
    this.#style_tags.push(`<style${attributes2.length ? " " + attributes2.join(" ") : ""}>${style}</style>`);
  }
  /**
  * @param {string} href
  * @param {string[]} attributes
  */
  add_stylesheet(href, attributes2) {
    this.#stylesheet_links.push(`<link href="${href}" ${attributes2.join(" ")}>`);
  }
  /** @param {string} href */
  add_script_preload(href) {
    this.#script_preloads.push(`<link rel="preload" as="script" crossorigin="anonymous" href="${href}">`);
  }
  /**
  * @param {string} href
  * @param {string[]} attributes
  */
  add_link_tag(href, attributes2) {
    if (!this.#prerendering) return;
    this.#link_tags.push(`<link href="${href}" ${attributes2.join(" ")}>`);
  }
  /** @param {string} tag */
  add_http_equiv(tag) {
    if (!this.#prerendering) return;
    this.#http_equiv.push(tag);
  }
};
var PageNodes = class {
  static {
    __name(this, "PageNodes");
  }
  /** All layout nodes and the page node, if any */
  data;
  /**
  * @param {Array<import('types').SSRNode | undefined>} nodes
  */
  constructor(nodes) {
    this.data = nodes;
  }
  layouts() {
    return this.data.slice(0, -1);
  }
  page() {
    return this.data.at(-1);
  }
  validate() {
    for (const layout of this.layouts()) if (layout) {
      validate_layout_server_exports(layout.server, layout.server_id);
      validate_layout_exports(layout.universal, layout.universal_id);
    }
    const page3 = this.page();
    if (page3) {
      validate_page_server_exports(page3.server, page3.server_id);
      validate_page_exports(page3.universal, page3.universal_id);
    }
  }
  /**
  * @template {'prerender' | 'ssr' | 'csr' | 'trailingSlash'} Option
  * @param {Option} option
  * @returns {Value | undefined}
  */
  #get_option(option) {
    return this.data.reduce((value, node) => {
      return node?.universal?.[option] ?? node?.server?.[option] ?? value;
    }, void 0);
  }
  csr() {
    return this.#get_option("csr") ?? true;
  }
  ssr() {
    return this.#get_option("ssr") ?? true;
  }
  prerender() {
    return this.#get_option("prerender") ?? false;
  }
  trailing_slash() {
    return this.#get_option("trailingSlash") ?? "never";
  }
  get_config() {
    let current2 = {};
    for (const node of this.data) {
      if (!node?.universal?.config && !node?.server?.config) continue;
      current2 = {
        ...current2,
        ...node?.universal?.config,
        ...node?.server?.config
      };
    }
    return Object.keys(current2).length ? current2 : void 0;
  }
  should_prerender_data() {
    return this.data.some((node) => node?.server?.load || node?.server?.trailingSlash !== void 0);
  }
};
async function respond_with_error({ event, event_state, options: options2, manifest: manifest2, state: state2, status, error: error2, resolve_opts }) {
  if (event.request.headers.get("x-sveltekit-error")) return static_error_page(
    options2,
    status,
    /** @type {Error} */
    error2.message
  );
  const fetched = [];
  try {
    const branch3 = [];
    const default_layout = await manifest2._.nodes[0]();
    const nodes = new PageNodes([default_layout]);
    const ssr = nodes.ssr();
    const csr = nodes.csr();
    const data_serializer = server_data_serializer(event, event_state, options2);
    if (ssr) {
      state2.error = true;
      const server_data_promise = load_server_data({
        event,
        event_state,
        state: state2,
        node: default_layout,
        parent: /* @__PURE__ */ __name(async () => ({}), "parent")
      });
      const server_data = await server_data_promise;
      data_serializer.add_node(0, server_data);
      const data = await load_data({
        event,
        event_state,
        fetched,
        node: default_layout,
        parent: /* @__PURE__ */ __name(async () => ({}), "parent"),
        resolve_opts,
        server_data_promise,
        state: state2,
        csr
      });
      branch3.push({
        node: default_layout,
        server_data,
        data
      }, {
        node: await manifest2._.nodes[1](),
        data: null,
        server_data: null
      });
    }
    return await render_response({
      options: options2,
      manifest: manifest2,
      state: state2,
      page_config: {
        ssr,
        csr
      },
      status,
      error: await handle_error_and_jsonify(event, event_state, options2, error2),
      branch: branch3,
      error_components: [],
      fetched,
      event,
      event_state,
      resolve_opts,
      data_serializer
    });
  } catch (e3) {
    if (e3 instanceof Redirect) return redirect_response(e3.status, e3.location);
    return static_error_page(options2, get_status(e3), (await handle_error_and_jsonify(event, event_state, options2, e3)).message);
  }
}
__name(respond_with_error, "respond_with_error");
var MAX_DEPTH = 10;
async function render_page(event, event_state, page3, options2, manifest2, state2, nodes, resolve_opts) {
  if (state2.depth > MAX_DEPTH) return text(`Not found: ${event.url.pathname}`, { status: 404 });
  if (is_action_json_request(event)) return handle_action_json_request(event, event_state, options2, (await manifest2._.nodes[page3.leaf]())?.server);
  try {
    const leaf_node = nodes.page();
    let status = 200;
    let action_result = void 0;
    if (is_action_request(event)) {
      const remote_id = get_remote_action(event.url);
      if (remote_id) action_result = await handle_remote_form_post(event, event_state, manifest2, remote_id);
      else action_result = await handle_action_request(event, event_state, leaf_node.server);
      if (action_result?.type === "redirect") return redirect_response(action_result.status, action_result.location);
      if (action_result?.type === "error") status = get_status(action_result.error);
      if (action_result?.type === "failure") status = action_result.status;
    }
    const should_prerender = nodes.prerender();
    if (should_prerender) {
      if (leaf_node.server?.actions) throw new Error("Cannot prerender pages with actions");
    } else if (state2.prerendering) return new Response(void 0, { status: 204 });
    state2.prerender_default = should_prerender;
    const should_prerender_data = nodes.should_prerender_data();
    const data_pathname = add_data_suffix2(event.url.pathname);
    const fetched = [];
    const ssr = nodes.ssr();
    const csr = nodes.csr();
    if (ssr === false && !(state2.prerendering && should_prerender_data)) return await render_response({
      branch: compact(nodes.data).map((node) => {
        return {
          node,
          data: null,
          server_data: null
        };
      }),
      fetched,
      page_config: {
        ssr: false,
        csr
      },
      status,
      error: null,
      event,
      event_state,
      options: options2,
      manifest: manifest2,
      state: state2,
      resolve_opts,
      data_serializer: server_data_serializer(event, event_state, options2)
    });
    const branch3 = [];
    let load_error = null;
    const data_serializer = server_data_serializer(event, event_state, options2);
    const data_serializer_json = state2.prerendering && should_prerender_data ? server_data_serializer_json(event, event_state, options2) : null;
    const server_promises = nodes.data.map((node, i) => {
      if (load_error) throw load_error;
      return Promise.resolve().then(async () => {
        try {
          if (node === leaf_node && action_result?.type === "error") throw action_result.error;
          const server_data = await load_server_data({
            event,
            event_state,
            state: state2,
            node,
            parent: /* @__PURE__ */ __name(async () => {
              const data = {};
              for (let j2 = 0; j2 < i; j2 += 1) {
                const parent = await server_promises[j2];
                if (parent) Object.assign(data, parent.data);
              }
              return data;
            }, "parent")
          });
          if (node) data_serializer.add_node(i, server_data);
          data_serializer_json?.add_node(i, server_data);
          return server_data;
        } catch (e3) {
          load_error = e3;
          throw load_error;
        }
      });
    });
    const load_promises = nodes.data.map((node, i) => {
      if (load_error) throw load_error;
      return Promise.resolve().then(async () => {
        try {
          return await load_data({
            event,
            event_state,
            fetched,
            node,
            parent: /* @__PURE__ */ __name(async () => {
              const data = {};
              for (let j2 = 0; j2 < i; j2 += 1) Object.assign(data, await load_promises[j2]);
              return data;
            }, "parent"),
            resolve_opts,
            server_data_promise: server_promises[i],
            state: state2,
            csr
          });
        } catch (e3) {
          load_error = e3;
          throw load_error;
        }
      });
    });
    for (const p of server_promises) p.catch(noop2);
    for (const p of load_promises) p.catch(noop2);
    for (let i = 0; i < nodes.data.length; i += 1) {
      const node = nodes.data[i];
      if (node) try {
        const server_data = await server_promises[i];
        const data = await load_promises[i];
        branch3.push({
          node,
          server_data,
          data
        });
      } catch (e3) {
        const err = normalize_error(e3);
        if (err instanceof Redirect) {
          if (state2.prerendering && should_prerender_data) {
            const body = JSON.stringify({
              type: "redirect",
              location: err.location
            });
            state2.prerendering.dependencies.set(data_pathname, {
              response: text(body),
              body
            });
          }
          return redirect_response(err.status, err.location);
        }
        const status2 = get_status(err);
        const error2 = await handle_error_and_jsonify(event, event_state, options2, err);
        while (i--) if (page3.errors[i]) {
          const index23 = page3.errors[i];
          const node2 = await manifest2._.nodes[index23]();
          let j2 = i;
          while (!branch3[j2]) j2 -= 1;
          data_serializer.set_max_nodes(j2 + 1);
          const layouts = compact(branch3.slice(0, j2 + 1));
          const nodes2 = new PageNodes(layouts.map((layout) => layout.node));
          const error_branch = layouts.concat({
            node: node2,
            data: null,
            server_data: null
          });
          return await render_response({
            event,
            event_state,
            options: options2,
            manifest: manifest2,
            state: state2,
            resolve_opts,
            page_config: {
              ssr: nodes2.ssr(),
              csr: nodes2.csr()
            },
            status: status2,
            error: error2,
            error_components: await load_error_components(options2, ssr, error_branch, page3, manifest2),
            branch: error_branch,
            fetched,
            data_serializer
          });
        }
        return static_error_page(options2, status2, error2.message);
      }
      else branch3.push(null);
    }
    if (state2.prerendering && data_serializer_json) {
      let { data, chunks } = data_serializer_json.get_data();
      if (chunks) for await (const chunk of chunks) data += chunk;
      state2.prerendering.dependencies.set(data_pathname, {
        response: text(data),
        body: data
      });
    }
    return await render_response({
      event,
      event_state,
      options: options2,
      manifest: manifest2,
      state: state2,
      resolve_opts,
      page_config: {
        csr,
        ssr
      },
      status,
      error: null,
      branch: compact(branch3),
      action_result,
      fetched,
      data_serializer: !ssr ? server_data_serializer(event, event_state, options2) : data_serializer,
      error_components: await load_error_components(options2, ssr, branch3, page3, manifest2)
    });
  } catch (e3) {
    if (e3 instanceof Redirect) return redirect_response(e3.status, e3.location);
    return await respond_with_error({
      event,
      event_state,
      options: options2,
      manifest: manifest2,
      state: state2,
      status: e3 instanceof HttpError ? e3.status : 500,
      error: e3,
      resolve_opts
    });
  }
}
__name(render_page, "render_page");
async function load_error_components(options2, ssr, branch3, page3, manifest2) {
  let error_components;
  if (options2.server_error_boundaries && ssr) {
    let last_idx = -1;
    error_components = await Promise.all(branch3.map((b, i) => {
      if (i === 0) return void 0;
      if (!b) return null;
      i--;
      while (i > last_idx + 1 && page3.errors[i] === void 0) i -= 1;
      last_idx = i;
      const idx = page3.errors[i];
      if (idx == null) return void 0;
      return manifest2._.nodes[idx]?.().then((e3) => e3.component?.()).catch(() => void 0);
    }).filter((e3) => e3 !== null));
  }
  return error_components;
}
__name(load_error_components, "load_error_components");
async function render_data(event, event_state, route, options2, manifest2, state2, invalidated_data_nodes, trailing_slash) {
  if (!route.page) return new Response(void 0, { status: 404 });
  try {
    const node_ids = [...route.page.layouts, route.page.leaf];
    const invalidated = invalidated_data_nodes ?? node_ids.map(() => true);
    let aborted = false;
    const url = new URL(event.url);
    url.pathname = normalize_path(url.pathname, trailing_slash);
    const new_event = {
      ...event,
      url
    };
    const functions = node_ids.map((n2, i) => {
      return once2(async () => {
        try {
          if (aborted) return { type: "skip" };
          const node = n2 == void 0 ? n2 : await manifest2._.nodes[n2]();
          return load_server_data({
            event: new_event,
            event_state,
            state: state2,
            node,
            parent: /* @__PURE__ */ __name(async () => {
              const data2 = {};
              for (let j2 = 0; j2 < i; j2 += 1) {
                const parent = await functions[j2]();
                if (parent) Object.assign(data2, parent.data);
              }
              return data2;
            }, "parent")
          });
        } catch (e3) {
          aborted = true;
          throw e3;
        }
      });
    });
    const promises = functions.map(async (fn, i) => {
      if (!invalidated[i]) return { type: "skip" };
      return fn();
    });
    let length = promises.length;
    const nodes = await Promise.all(promises.map((p, i) => p.catch(async (error2) => {
      if (error2 instanceof Redirect) throw error2;
      length = Math.min(length, i + 1);
      return {
        type: "error",
        error: await handle_error_and_jsonify(event, event_state, options2, error2),
        status: error2 instanceof HttpError || error2 instanceof SvelteKitError ? error2.status : void 0
      };
    })));
    const data_serializer = server_data_serializer_json(event, event_state, options2);
    for (let i = 0; i < nodes.length; i++) data_serializer.add_node(i, nodes[i]);
    const { data, chunks } = data_serializer.get_data();
    if (!chunks) return json_response(data);
    return new Response(new ReadableStream({
      async start(controller) {
        controller.enqueue(text_encoder2.encode(data));
        for await (const chunk of chunks) controller.enqueue(text_encoder2.encode(chunk));
        controller.close();
      },
      type: "bytes"
    }), { headers: {
      "content-type": "text/sveltekit-data",
      "cache-control": "private, no-store"
    } });
  } catch (e3) {
    const error2 = normalize_error(e3);
    if (error2 instanceof Redirect) return redirect_json_response(error2);
    else return json_response(await handle_error_and_jsonify(event, event_state, options2, error2), 500);
  }
}
__name(render_data, "render_data");
function json_response(json2, status = 200) {
  return text(typeof json2 === "string" ? json2 : JSON.stringify(json2), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "private, no-store"
    }
  });
}
__name(json_response, "json_response");
function redirect_json_response(redirect2) {
  return json_response({
    type: "redirect",
    location: redirect2.location
  });
}
__name(redirect_json_response, "redirect_json_response");
var import_cookie = (/* @__PURE__ */ __commonJSMin(((exports) => {
  exports.parse = parse2;
  exports.serialize = serialize;
  var __toString = Object.prototype.toString;
  var __hasOwnProperty = Object.prototype.hasOwnProperty;
  var cookieNameRegExp = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
  var cookieValueRegExp = /^("?)[\u0021\u0023-\u002B\u002D-\u003A\u003C-\u005B\u005D-\u007E]*\1$/;
  var domainValueRegExp = /^([.]?[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)([.][a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
  var pathValueRegExp = /^[\u0020-\u003A\u003D-\u007E]*$/;
  function parse2(str, opt) {
    if (typeof str !== "string") throw new TypeError("argument str must be a string");
    var obj = {};
    var len = str.length;
    if (len < 2) return obj;
    var dec = opt && opt.decode || decode;
    var index23 = 0;
    var eqIdx = 0;
    var endIdx = 0;
    do {
      eqIdx = str.indexOf("=", index23);
      if (eqIdx === -1) break;
      endIdx = str.indexOf(";", index23);
      if (endIdx === -1) endIdx = len;
      else if (eqIdx > endIdx) {
        index23 = str.lastIndexOf(";", eqIdx - 1) + 1;
        continue;
      }
      var keyStartIdx = startIndex(str, index23, eqIdx);
      var keyEndIdx = endIndex(str, eqIdx, keyStartIdx);
      var key2 = str.slice(keyStartIdx, keyEndIdx);
      if (!__hasOwnProperty.call(obj, key2)) {
        var valStartIdx = startIndex(str, eqIdx + 1, endIdx);
        var valEndIdx = endIndex(str, endIdx, valStartIdx);
        if (str.charCodeAt(valStartIdx) === 34 && str.charCodeAt(valEndIdx - 1) === 34) {
          valStartIdx++;
          valEndIdx--;
        }
        obj[key2] = tryDecode(str.slice(valStartIdx, valEndIdx), dec);
      }
      index23 = endIdx + 1;
    } while (index23 < len);
    return obj;
  }
  __name(parse2, "parse");
  function startIndex(str, index23, max) {
    do {
      var code = str.charCodeAt(index23);
      if (code !== 32 && code !== 9) return index23;
    } while (++index23 < max);
    return max;
  }
  __name(startIndex, "startIndex");
  function endIndex(str, index23, min) {
    while (index23 > min) {
      var code = str.charCodeAt(--index23);
      if (code !== 32 && code !== 9) return index23 + 1;
    }
    return min;
  }
  __name(endIndex, "endIndex");
  function serialize(name, val, opt) {
    var enc = opt && opt.encode || encodeURIComponent;
    if (typeof enc !== "function") throw new TypeError("option encode is invalid");
    if (!cookieNameRegExp.test(name)) throw new TypeError("argument name is invalid");
    var value = enc(val);
    if (!cookieValueRegExp.test(value)) throw new TypeError("argument val is invalid");
    var str = name + "=" + value;
    if (!opt) return str;
    if (null != opt.maxAge) {
      var maxAge = Math.floor(opt.maxAge);
      if (!isFinite(maxAge)) throw new TypeError("option maxAge is invalid");
      str += "; Max-Age=" + maxAge;
    }
    if (opt.domain) {
      if (!domainValueRegExp.test(opt.domain)) throw new TypeError("option domain is invalid");
      str += "; Domain=" + opt.domain;
    }
    if (opt.path) {
      if (!pathValueRegExp.test(opt.path)) throw new TypeError("option path is invalid");
      str += "; Path=" + opt.path;
    }
    if (opt.expires) {
      var expires = opt.expires;
      if (!isDate(expires) || isNaN(expires.valueOf())) throw new TypeError("option expires is invalid");
      str += "; Expires=" + expires.toUTCString();
    }
    if (opt.httpOnly) str += "; HttpOnly";
    if (opt.secure) str += "; Secure";
    if (opt.partitioned) str += "; Partitioned";
    if (opt.priority) switch (typeof opt.priority === "string" ? opt.priority.toLowerCase() : opt.priority) {
      case "low":
        str += "; Priority=Low";
        break;
      case "medium":
        str += "; Priority=Medium";
        break;
      case "high":
        str += "; Priority=High";
        break;
      default:
        throw new TypeError("option priority is invalid");
    }
    if (opt.sameSite) switch (typeof opt.sameSite === "string" ? opt.sameSite.toLowerCase() : opt.sameSite) {
      case true:
        str += "; SameSite=Strict";
        break;
      case "lax":
        str += "; SameSite=Lax";
        break;
      case "strict":
        str += "; SameSite=Strict";
        break;
      case "none":
        str += "; SameSite=None";
        break;
      default:
        throw new TypeError("option sameSite is invalid");
    }
    return str;
  }
  __name(serialize, "serialize");
  function decode(str) {
    return str.indexOf("%") !== -1 ? decodeURIComponent(str) : str;
  }
  __name(decode, "decode");
  function isDate(val) {
    return __toString.call(val) === "[object Date]";
  }
  __name(isDate, "isDate");
  function tryDecode(str, decode2) {
    try {
      return decode2(str);
    } catch (e3) {
      return str;
    }
  }
  __name(tryDecode, "tryDecode");
})))();
var INVALID_COOKIE_CHARACTER_REGEX = /[\x00-\x1F\x7F()<>@,;:"/[\]?={} \t]/;
function validate_options(options2) {
  if (options2?.path === void 0) throw new Error("You must specify a `path` when setting, deleting or serializing cookies");
}
__name(validate_options, "validate_options");
function generate_cookie_key(domain, path, name) {
  return `${domain || ""}${path}?${encodeURIComponent(name)}`;
}
__name(generate_cookie_key, "generate_cookie_key");
function get_cookies(request, url) {
  const header = request.headers.get("cookie") ?? "";
  const initial_cookies = (0, import_cookie.parse)(header, { decode: /* @__PURE__ */ __name((value) => value, "decode") });
  let normalized_url;
  const new_cookies = /* @__PURE__ */ new Map();
  const defaults = {
    httpOnly: true,
    sameSite: "lax",
    secure: url.hostname === "localhost" && url.protocol === "http:" ? false : true
  };
  const cookies = {
    /**
    * @param {string} name
    * @param {import('cookie').CookieParseOptions} [opts]
    */
    get(name, opts) {
      const best_match = Array.from(new_cookies.values()).filter((c2) => {
        return c2.name === name && domain_matches(url.hostname, c2.options.domain) && path_matches(url.pathname, c2.options.path);
      }).sort((a2, b) => b.options.path.length - a2.options.path.length)[0];
      if (best_match) return best_match.options.maxAge === 0 ? void 0 : best_match.value;
      return (0, import_cookie.parse)(header, { decode: opts?.decode })[name];
    },
    /**
    * @param {import('cookie').CookieParseOptions} [opts]
    */
    getAll(opts) {
      const cookies2 = (0, import_cookie.parse)(header, { decode: opts?.decode });
      const lookup = /* @__PURE__ */ new Map();
      for (const c2 of new_cookies.values()) if (domain_matches(url.hostname, c2.options.domain) && path_matches(url.pathname, c2.options.path)) {
        const existing = lookup.get(c2.name);
        if (!existing || c2.options.path.length > existing.options.path.length) lookup.set(c2.name, c2);
      }
      for (const c2 of lookup.values()) cookies2[c2.name] = c2.value;
      return Object.entries(cookies2).map(([name, value]) => ({
        name,
        value
      }));
    },
    /**
    * @param {string} name
    * @param {string} value
    * @param {import('./page/types.js').Cookie['options']} options
    */
    set(name, value, options2) {
      const illegal_characters = name.match(INVALID_COOKIE_CHARACTER_REGEX);
      if (illegal_characters) console.warn(`The cookie name "${name}" will be invalid in SvelteKit 3.0 as it contains ${illegal_characters.join(" and ")}. See RFC 2616 for more details https://datatracker.ietf.org/doc/html/rfc2616#section-2.2`);
      validate_options(options2);
      set_internal(name, value, {
        ...defaults,
        ...options2
      });
    },
    /**
    * @param {string} name
    *  @param {import('./page/types.js').Cookie['options']} options
    */
    delete(name, options2) {
      validate_options(options2);
      cookies.set(name, "", {
        ...options2,
        maxAge: 0
      });
    },
    /**
    * @param {string} name
    * @param {string} value
    *  @param {import('./page/types.js').Cookie['options']} options
    */
    serialize(name, value, options2) {
      validate_options(options2);
      let path = options2.path;
      if (!options2.domain || options2.domain === url.hostname) {
        if (!normalized_url) throw new Error("Cannot serialize cookies until after the route is determined");
        path = resolve(normalized_url, path);
      }
      return (0, import_cookie.serialize)(name, value, {
        ...defaults,
        ...options2,
        path
      });
    }
  };
  function get_cookie_header(destination, header2) {
    const combined_cookies = { ...initial_cookies };
    for (const cookie of new_cookies.values()) {
      if (!domain_matches(destination.hostname, cookie.options.domain)) continue;
      if (!path_matches(destination.pathname, cookie.options.path)) continue;
      const encoder = cookie.options.encode || encodeURIComponent;
      combined_cookies[cookie.name] = encoder(cookie.value);
    }
    if (header2) {
      const parsed = (0, import_cookie.parse)(header2, { decode: /* @__PURE__ */ __name((value) => value, "decode") });
      for (const name in parsed) combined_cookies[name] = parsed[name];
    }
    return Object.entries(combined_cookies).map(([name, value]) => `${name}=${value}`).join("; ");
  }
  __name(get_cookie_header, "get_cookie_header");
  const internal_queue = [];
  function set_internal(name, value, options2) {
    if (!normalized_url) {
      internal_queue.push(() => set_internal(name, value, options2));
      return;
    }
    let path = options2.path;
    if (!options2.domain || options2.domain === url.hostname) path = resolve(normalized_url, path);
    const cookie_key = generate_cookie_key(options2.domain, path, name);
    const cookie = {
      name,
      value,
      options: {
        ...options2,
        path
      }
    };
    new_cookies.set(cookie_key, cookie);
  }
  __name(set_internal, "set_internal");
  function set_trailing_slash(trailing_slash) {
    normalized_url = normalize_path(url.pathname, trailing_slash);
    internal_queue.forEach((fn) => fn());
  }
  __name(set_trailing_slash, "set_trailing_slash");
  return {
    cookies,
    new_cookies,
    get_cookie_header,
    set_internal,
    set_trailing_slash
  };
}
__name(get_cookies, "get_cookies");
function domain_matches(hostname, constraint) {
  if (!constraint) return true;
  const normalized = constraint[0] === "." ? constraint.slice(1) : constraint;
  if (hostname === normalized) return true;
  return hostname.endsWith("." + normalized);
}
__name(domain_matches, "domain_matches");
function path_matches(path, constraint) {
  if (!constraint) return true;
  const normalized = constraint.endsWith("/") ? constraint.slice(0, -1) : constraint;
  if (path === normalized) return true;
  return path.startsWith(normalized + "/");
}
__name(path_matches, "path_matches");
function add_cookies_to_headers(headers2, cookies) {
  for (const new_cookie of cookies) {
    const { name, value, options: options2 } = new_cookie;
    headers2.append("set-cookie", (0, import_cookie.serialize)(name, value, options2));
    if (options2.path.endsWith(".html")) {
      const path = add_data_suffix2(options2.path);
      headers2.append("set-cookie", (0, import_cookie.serialize)(name, value, {
        ...options2,
        path
      }));
    }
  }
}
__name(add_cookies_to_headers, "add_cookies_to_headers");
function create_fetch({ event, options: options2, manifest: manifest2, state: state2, get_cookie_header, set_internal }) {
  const server_fetch = /* @__PURE__ */ __name(async (info, init2) => {
    const original_request = normalize_fetch_input(info, init2, event.url);
    let mode = (info instanceof Request ? info.mode : init2?.mode) ?? "cors";
    let credentials = (info instanceof Request ? info.credentials : init2?.credentials) ?? "same-origin";
    return options2.hooks.handleFetch({
      event,
      request: original_request,
      fetch: /* @__PURE__ */ __name(async (info2, init3) => {
        const request = normalize_fetch_input(info2, init3, event.url);
        const url = new URL(request.url);
        if (!request.headers.has("origin")) request.headers.set("origin", event.url.origin);
        if (info2 !== original_request) {
          mode = (info2 instanceof Request ? info2.mode : init3?.mode) ?? "cors";
          credentials = (info2 instanceof Request ? info2.credentials : init3?.credentials) ?? "same-origin";
        }
        if ((request.method === "GET" || request.method === "HEAD") && (mode === "no-cors" && url.origin !== event.url.origin || url.origin === event.url.origin)) request.headers.delete("origin");
        const decoded = decodeURIComponent(url.pathname);
        if (url.origin !== event.url.origin || base && decoded !== base && !decoded.startsWith(`${base}/`)) {
          if (`.${url.hostname}`.endsWith(`.${event.url.hostname}`) && credentials !== "omit") {
            const cookie = get_cookie_header(url, request.headers.get("cookie"));
            if (cookie) request.headers.set("cookie", cookie);
          }
          return fetch(request);
        }
        const prefix = assets || base;
        const filename = (decoded.startsWith(prefix) ? decoded.slice(prefix.length) : decoded).slice(1);
        const filename_html = `${filename}/index.html`;
        const is_asset = manifest2.assets.has(filename) || filename in manifest2._.server_assets;
        const is_asset_html = manifest2.assets.has(filename_html) || filename_html in manifest2._.server_assets;
        if (is_asset || is_asset_html) {
          const file = is_asset ? filename : filename_html;
          if (state2.read) {
            const type = is_asset ? manifest2.mimeTypes[filename.slice(filename.lastIndexOf("."))] : "text/html";
            return new Response(state2.read(file), { headers: type ? { "content-type": type } : {} });
          } else if (read_implementation && file in manifest2._.server_assets) {
            const length = manifest2._.server_assets[file];
            const type = manifest2.mimeTypes[file.slice(file.lastIndexOf("."))];
            return new Response(read_implementation(file), { headers: {
              "Content-Length": "" + length,
              "Content-Type": type
            } });
          }
          return await fetch(request);
        }
        if (has_prerendered_path(manifest2, base + decoded)) return await fetch(request);
        if (credentials !== "omit") {
          const cookie = get_cookie_header(url, request.headers.get("cookie"));
          if (cookie) request.headers.set("cookie", cookie);
          const authorization = event.request.headers.get("authorization");
          if (authorization && !request.headers.has("authorization")) request.headers.set("authorization", authorization);
        }
        if (!request.headers.has("accept")) request.headers.set("accept", "*/*");
        if (!request.headers.has("accept-language")) request.headers.set("accept-language", event.request.headers.get("accept-language"));
        const response = await internal_fetch(request, options2, manifest2, state2);
        for (const str of get_set_cookies(response.headers)) {
          const { name, value, ...options3 } = parseString(str, { decodeValues: false });
          set_internal(name, value, {
            path: options3.path ?? (url.pathname.split("/").slice(0, -1).join("/") || "/"),
            encode: /* @__PURE__ */ __name((value2) => value2, "encode"),
            ...options3
          });
        }
        return response;
      }, "fetch")
    });
  }, "server_fetch");
  return (input, init2) => {
    const response = server_fetch(input, init2);
    response.catch(noop2);
    return response;
  };
}
__name(create_fetch, "create_fetch");
function normalize_fetch_input(info, init2, url) {
  if (info instanceof Request) return info;
  return new Request(typeof info === "string" ? new URL(info, url) : info, init2);
}
__name(normalize_fetch_input, "normalize_fetch_input");
async function internal_fetch(request, options2, manifest2, state2) {
  if (request.signal) {
    if (request.signal.aborted) throw new DOMException("The operation was aborted.", "AbortError");
    let remove_abort_listener = noop2;
    const abort_promise = new Promise((_, reject) => {
      const on_abort = /* @__PURE__ */ __name(() => {
        reject(new DOMException("The operation was aborted.", "AbortError"));
      }, "on_abort");
      request.signal.addEventListener("abort", on_abort, { once: true });
      remove_abort_listener = /* @__PURE__ */ __name(() => request.signal.removeEventListener("abort", on_abort), "remove_abort_listener");
    });
    const result = await Promise.race([respond(request, options2, manifest2, {
      ...state2,
      depth: state2.depth + 1
    }), abort_promise]);
    remove_abort_listener();
    return result;
  } else return await respond(request, options2, manifest2, {
    ...state2,
    depth: state2.depth + 1
  });
}
__name(internal_fetch, "internal_fetch");
var payload;
var etag;
var headers;
function get_public_env(request) {
  const script = request.url.endsWith(".script.js");
  payload ??= uneval(public_env);
  etag ??= `W/${Date.now()}`;
  headers ??= new Headers({
    "content-type": "application/javascript; charset=utf-8",
    etag
  });
  if (request.headers.get("if-none-match") === etag) return new Response(void 0, {
    status: 304,
    headers
  });
  if (script) return new Response(`globalThis.__sveltekit_sw={env:${payload}}`, { headers });
  return new Response(`export const env=${payload}`, { headers });
}
__name(get_public_env, "get_public_env");
var default_transform = /* @__PURE__ */ __name(({ html }) => html, "default_transform");
var default_filter = /* @__PURE__ */ __name(() => false, "default_filter");
var default_preload = /* @__PURE__ */ __name(({ type }) => type === "js" || type === "css", "default_preload");
var page_methods = /* @__PURE__ */ new Set([
  "GET",
  "HEAD",
  "POST"
]);
var allowed_page_methods = /* @__PURE__ */ new Set([
  "GET",
  "HEAD",
  "OPTIONS"
]);
var respond = propagate_context(internal_respond);
async function internal_respond(request, options2, manifest2, state2) {
  const url = new URL(request.url);
  const is_route_resolution_request = has_resolution_suffix2(url.pathname);
  const is_data_request = has_data_suffix2(url.pathname);
  const remote_id = get_remote_id(url);
  {
    const request_origin = request.headers.get("origin");
    if (remote_id) {
      if (request.method !== "GET" && request_origin !== url.origin) return json({ message: "Cross-site remote requests are forbidden" }, { status: 403 });
    } else if (options2.csrf_check_origin) {
      if (is_form_content_type(request) && (request.method === "POST" || request.method === "PUT" || request.method === "PATCH" || request.method === "DELETE") && request_origin !== url.origin && (!request_origin || !options2.csrf_trusted_origins.includes(request_origin))) {
        const message = `Cross-site ${request.method} form submissions are forbidden`;
        const opts = { status: 403 };
        if (request.headers.get("accept") === "application/json") return json({ message }, opts);
        return text(message, opts);
      }
    }
  }
  if (options2.hash_routing && url.pathname !== base + "/" && url.pathname !== "/[fallback]") return text("Not found", { status: 404 });
  let invalidated_data_nodes;
  if (is_route_resolution_request)
    url.pathname = strip_resolution_suffix2(url.pathname);
  else if (is_data_request) {
    url.pathname = strip_data_suffix2(url.pathname) + (url.searchParams.get("x-sveltekit-trailing-slash") === "1" ? "/" : "") || "/";
    url.searchParams.delete(TRAILING_SLASH_PARAM);
    invalidated_data_nodes = url.searchParams.get(INVALIDATED_PARAM)?.split("").map((node) => node === "1");
    url.searchParams.delete(INVALIDATED_PARAM);
  } else if (remote_id) {
    url.pathname = request.headers.get("x-sveltekit-pathname") ?? base;
    url.search = request.headers.get("x-sveltekit-search") ?? "";
  }
  const headers2 = {};
  const { cookies, new_cookies, get_cookie_header, set_internal, set_trailing_slash } = get_cookies(request, url);
  const event_state = {
    prerendering: state2.prerendering,
    transport: options2.hooks.transport,
    handleValidationError: options2.hooks.handleValidationError,
    tracing: { record_span },
    remote: {
      data: null,
      explicit: null,
      implicit: null,
      forms: null,
      requested: null,
      batches: null,
      live_iterators: null
    },
    is_in_remote_function: false,
    is_in_remote_form_or_command: false,
    is_in_remote_query: false,
    is_in_render: false,
    is_in_universal_load: false
  };
  const event = {
    cookies,
    fetch: null,
    getClientAddress: state2.getClientAddress || (() => {
      throw new Error(`@sveltejs/adapter-cloudflare does not specify getClientAddress. Please raise an issue`);
    }),
    locals: {},
    params: {},
    platform: state2.platform,
    request,
    route: { id: null },
    setHeaders: /* @__PURE__ */ __name((new_headers) => {
      for (const key2 in new_headers) {
        const lower = key2.toLowerCase();
        const value = new_headers[key2];
        if (lower === "set-cookie") throw new Error("Use `event.cookies.set(name, value, options)` instead of `event.setHeaders` to set cookies");
        else if (lower in headers2) {
          if (lower === "server-timing") headers2[lower] += ", " + value;
          else throw new Error(`"${key2}" header is already set`);
        } else {
          headers2[lower] = value;
          if (state2.prerendering && lower === "cache-control") state2.prerendering.cache = value;
        }
      }
    }, "setHeaders"),
    url,
    isDataRequest: is_data_request,
    isSubRequest: state2.depth > 0,
    isRemoteRequest: !!remote_id
  };
  event.fetch = create_fetch({
    event,
    options: options2,
    manifest: manifest2,
    state: state2,
    get_cookie_header,
    set_internal
  });
  if (state2.emulator?.platform) event.platform = await state2.emulator.platform({
    config: {},
    prerender: !!state2.prerendering?.fallback
  });
  let resolved_path = url.pathname;
  if (!remote_id) {
    const prerendering_reroute_state = state2.prerendering?.inside_reroute;
    try {
      if (state2.prerendering) state2.prerendering.inside_reroute = true;
      resolved_path = await options2.hooks.reroute({
        url: new URL(url),
        fetch: event.fetch
      }) ?? url.pathname;
    } catch {
      return text("Internal Server Error", { status: 500 });
    } finally {
      if (state2.prerendering) state2.prerendering.inside_reroute = prerendering_reroute_state;
    }
  }
  let resolve_opts = {
    transformPageChunk: default_transform,
    filterSerializedResponseHeaders: default_filter,
    preload: default_preload
  };
  let trailing_slash = "never";
  let page_nodes;
  try {
    resolved_path = decode_pathname(resolved_path);
  } catch {
    resolved_path = null;
    return await handle2();
  }
  if (resolved_path !== decode_pathname(url.pathname) && !state2.prerendering?.fallback && has_prerendered_path(manifest2, resolved_path)) {
    const url2 = new URL(request.url);
    url2.pathname = is_data_request ? add_data_suffix2(resolved_path) : is_route_resolution_request ? add_resolution_suffix2(resolved_path) : resolved_path;
    try {
      const response = await fetch(url2, request);
      const headers3 = new Headers(response.headers);
      if (headers3.has("content-encoding")) {
        headers3.delete("content-encoding");
        headers3.delete("content-length");
      }
      return new Response(response.body, {
        headers: headers3,
        status: response.status,
        statusText: response.statusText
      });
    } catch (error2) {
      return await handle_fatal_error(event, event_state, options2, error2);
    }
  }
  let route = null;
  if (base && !state2.prerendering?.fallback) {
    if (!resolved_path.startsWith(base)) return text("Not found", { status: 404 });
    resolved_path = resolved_path.slice(base.length) || "/";
  }
  if (is_route_resolution_request) return resolve_route(resolved_path, new URL(request.url), manifest2);
  if (resolved_path === `/_app/env.js` || resolved_path === `/_app/env.script.js`) return get_public_env(request);
  if (!remote_id && resolved_path.startsWith(`/_app`)) {
    const headers3 = new Headers();
    headers3.set("cache-control", "public, max-age=0, must-revalidate");
    return text("Not found", {
      status: 404,
      headers: headers3
    });
  }
  if (!state2.prerendering?.fallback) {
    const matchers = await manifest2._.matchers();
    const result = find_route(resolved_path, manifest2._.routes, matchers);
    if (result) {
      route = result.route;
      event.route = { id: route.id };
      event.params = result.params;
    }
  }
  try {
    page_nodes = route?.page ? new PageNodes(await load_page_nodes(route.page, manifest2)) : void 0;
    if (route && !remote_id) {
      if (url.pathname === base || url.pathname === base + "/") trailing_slash = "always";
      else if (page_nodes) trailing_slash = page_nodes.trailing_slash();
      else if (route.endpoint) trailing_slash = (await route.endpoint()).trailingSlash ?? "never";
      if (!is_data_request) {
        const normalized = normalize_path(url.pathname, trailing_slash);
        if (normalized !== url.pathname && !state2.prerendering?.fallback) return new Response(void 0, {
          status: 308,
          headers: {
            "x-sveltekit-normalize": "1",
            location: (normalized.startsWith("//") ? url.origin + normalized : normalized) + (url.search === "?" ? "" : url.search)
          }
        });
      }
      if (state2.before_handle || state2.emulator?.platform) {
        let config = {};
        let prerender = false;
        if (route.endpoint) {
          const node = await route.endpoint();
          config = node.config ?? config;
          prerender = node.prerender ?? prerender;
        } else if (page_nodes) {
          config = page_nodes.get_config() ?? config;
          prerender = page_nodes.prerender();
        }
        if (state2.emulator?.platform) event.platform = await state2.emulator.platform({
          config,
          prerender
        });
        if (state2.before_handle) return await state2.before_handle(event, config, prerender, handle2);
      }
    }
    return await handle2();
  } catch (e3) {
    if (e3 instanceof Redirect) try {
      const response = is_data_request || remote_id ? redirect_json_response(e3) : route?.page && is_action_json_request(event) ? action_json_redirect(e3) : redirect_response(e3.status, e3.location);
      add_cookies_to_headers(response.headers, new_cookies.values());
      return response;
    } catch (err) {
      return await handle_fatal_error(event, event_state, options2, err);
    }
    return await handle_fatal_error(event, event_state, options2, e3);
  }
  async function handle2() {
    set_trailing_slash(trailing_slash);
    if (state2.prerendering && !state2.prerendering.fallback && !state2.prerendering.inside_reroute) disable_search(url);
    const response = await record_span({
      name: "sveltekit.handle.root",
      attributes: {
        "http.route": event.route.id || "unknown",
        "http.method": event.request.method,
        "http.url": event.url.href,
        "sveltekit.is_data_request": is_data_request,
        "sveltekit.is_sub_request": event.isSubRequest
      },
      fn: /* @__PURE__ */ __name(async (root_span) => {
        const traced_event = {
          ...event,
          tracing: {
            enabled: false,
            root: root_span,
            current: root_span
          }
        };
        return await with_request_store({
          event: traced_event,
          state: event_state
        }, () => options2.hooks.handle({
          event: traced_event,
          resolve: /* @__PURE__ */ __name((event2, opts) => {
            return record_span({
              name: "sveltekit.resolve",
              attributes: { "http.route": event2.route.id || "unknown" },
              fn: /* @__PURE__ */ __name((resolve_span) => {
                return with_request_store(null, () => resolve2(merge_tracing(event2, resolve_span), page_nodes, opts).then((response2) => {
                  for (const key2 in headers2) {
                    const value = headers2[key2];
                    response2.headers.set(key2, value);
                  }
                  add_cookies_to_headers(response2.headers, new_cookies.values());
                  if (state2.prerendering && event2.route.id !== null) response2.headers.set("x-sveltekit-routeid", encodeURI(event2.route.id));
                  resolve_span.setAttributes({
                    "http.response.status_code": response2.status,
                    "http.response.body.size": response2.headers.get("content-length") || "unknown"
                  });
                  return response2;
                }));
              }, "fn")
            });
          }, "resolve")
        }));
      }, "fn")
    });
    if (response.status === 200 && response.headers.has("etag")) {
      let if_none_match_value = request.headers.get("if-none-match");
      if (if_none_match_value?.startsWith('W/"')) if_none_match_value = if_none_match_value.substring(2);
      const etag2 = response.headers.get("etag");
      if (if_none_match_value === etag2) {
        const headers3 = new Headers({ etag: etag2 });
        for (const key2 of [
          "cache-control",
          "content-location",
          "date",
          "expires",
          "vary"
        ]) {
          const value = response.headers.get(key2);
          if (value) headers3.set(key2, value);
        }
        for (const cookie of get_set_cookies(response.headers)) headers3.append("set-cookie", cookie);
        return new Response(void 0, {
          status: 304,
          headers: headers3
        });
      }
    }
    if (is_data_request && response.status >= 300 && response.status <= 308) {
      const location = response.headers.get("location");
      if (location) return redirect_json_response(new Redirect(response.status, location));
    }
    return response;
  }
  __name(handle2, "handle");
  async function resolve2(event2, page_nodes2, opts) {
    try {
      if (opts) resolve_opts = {
        transformPageChunk: opts.transformPageChunk || default_transform,
        filterSerializedResponseHeaders: opts.filterSerializedResponseHeaders || default_filter,
        preload: opts.preload || default_preload
      };
      if (resolved_path === null) return await respond_with_error({
        event: event2,
        event_state,
        options: options2,
        manifest: manifest2,
        state: state2,
        status: 400,
        error: new SvelteKitError(400, "Malformed URI", `Failed to decode URI: ${event2.url.pathname}`),
        resolve_opts
      });
      if (options2.hash_routing || state2.prerendering?.fallback) return await render_response({
        event: event2,
        event_state,
        options: options2,
        manifest: manifest2,
        state: state2,
        page_config: {
          ssr: false,
          csr: true
        },
        status: 200,
        error: null,
        branch: [{
          node: await manifest2._.nodes[0](),
          data: null,
          server_data: null
        }],
        fetched: [],
        resolve_opts,
        data_serializer: server_data_serializer(event2, event_state, options2)
      });
      if (remote_id) return await handle_remote_call(event2, event_state, options2, manifest2, remote_id);
      if (route) {
        const method = event2.request.method;
        let response2;
        if (is_data_request) response2 = await render_data(event2, event_state, route, options2, manifest2, state2, invalidated_data_nodes, trailing_slash);
        else if (route.endpoint && (!route.page || !state2.prerendering && is_endpoint_request(event2))) response2 = await render_endpoint(event2, event_state, await route.endpoint(), state2);
        else if (route.page) {
          if (!page_nodes2) throw new Error("page_nodes not found. This should never happen");
          else if (page_methods.has(method)) response2 = await render_page(event2, event_state, route.page, options2, manifest2, state2, page_nodes2, resolve_opts);
          else {
            const allowed_methods2 = new Set(allowed_page_methods);
            if ((await manifest2._.nodes[route.page.leaf]())?.server?.actions) allowed_methods2.add("POST");
            if (method === "OPTIONS") response2 = new Response(null, {
              status: 204,
              headers: { allow: Array.from(allowed_methods2.values()).join(", ") }
            });
            else {
              const mod = [...allowed_methods2].reduce((acc, curr) => {
                acc[curr] = true;
                return acc;
              }, {});
              response2 = method_not_allowed(mod, method);
            }
          }
        } else throw new Error("Route is neither page nor endpoint. This should never happen");
        if (request.method === "GET" && route.page && route.endpoint) {
          const vary = response2.headers.get("vary")?.split(",")?.map((v) => v.trim().toLowerCase());
          if (!(vary?.includes("accept") || vary?.includes("*"))) {
            response2 = new Response(response2.body, {
              status: response2.status,
              statusText: response2.statusText,
              headers: new Headers(response2.headers)
            });
            response2.headers.append("Vary", "Accept");
          }
        }
        return response2;
      }
      if (state2.error && event2.isSubRequest) {
        const headers3 = new Headers(request.headers);
        headers3.set("x-sveltekit-error", "true");
        return await fetch(request, { headers: headers3 });
      }
      if (state2.error) return text("Internal Server Error", { status: 500 });
      if (state2.depth === 0) return await respond_with_error({
        event: event2,
        event_state,
        options: options2,
        manifest: manifest2,
        state: state2,
        status: 404,
        error: new SvelteKitError(404, "Not Found", `Not found: ${event2.url.pathname}`),
        resolve_opts
      });
      if (state2.prerendering) return text("not found", { status: 404 });
      const response = await fetch(request);
      return new Response(response.body, response);
    } catch (e3) {
      return await handle_fatal_error(event2, event_state, options2, e3);
    } finally {
      event2.cookies.set = () => {
        throw new Error("Cannot use `cookies.set(...)` after the response has been generated");
      };
      event2.setHeaders = () => {
        throw new Error("Cannot use `setHeaders(...)` after the response has been generated");
      };
    }
  }
  __name(resolve2, "resolve");
}
__name(internal_respond, "internal_respond");
function load_page_nodes(page3, manifest2) {
  return Promise.all([...page3.layouts.map((n2) => n2 == void 0 ? n2 : manifest2._.nodes[n2]()), manifest2._.nodes[page3.leaf]()]);
}
__name(load_page_nodes, "load_page_nodes");
function propagate_context(fn) {
  return async (req, ...rest) => {
    return fn(req, ...rest);
  };
}
__name(propagate_context, "propagate_context");
function filter_env(env2, allowed, disallowed) {
  return Object.fromEntries(Object.entries(env2).filter(([k]) => k.startsWith(allowed) && (disallowed === "" || !k.startsWith(disallowed))));
}
__name(filter_env, "filter_env");
var init_promise;
var current = null;
var Server = class {
  static {
    __name(this, "Server");
  }
  /** @type {import('types').SSROptions} */
  #options;
  /** @type {import('@sveltejs/kit').SSRManifest} */
  #manifest;
  /** @param {import('@sveltejs/kit').SSRManifest} manifest */
  constructor(manifest2) {
    this.#options = options;
    this.#manifest = manifest2;
    if (IN_WEBCONTAINER2) {
      const respond2 = this.respond.bind(this);
      this.respond = async (...args) => {
        const { promise, resolve: resolve2 } = with_resolvers();
        const previous = current;
        current = promise;
        await previous;
        return respond2(...args).finally(resolve2);
      };
    }
    set_manifest(manifest2);
  }
  /**
  * @param {import('@sveltejs/kit').ServerInitOptions} opts
  */
  async init({ env: env2, read }) {
    const { env_public_prefix, env_private_prefix } = this.#options;
    set_private_env(filter_env(env2, env_private_prefix, env_public_prefix));
    set_public_env(filter_env(env2, env_public_prefix, env_private_prefix));
    if (read) {
      const wrapped_read = /* @__PURE__ */ __name((file) => {
        const result = read(file);
        if (result instanceof ReadableStream) return result;
        else return new ReadableStream({ async start(controller) {
          try {
            const stream = await Promise.resolve(result);
            if (!stream) {
              controller.close();
              return;
            }
            const reader = stream.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
            controller.close();
          } catch (error2) {
            controller.error(error2);
          }
        } });
      }, "wrapped_read");
      set_read_implementation(wrapped_read);
    }
    await (init_promise ??= (async () => {
      try {
        const module = await get_hooks();
        this.#options.hooks = {
          handle: module.handle || (({ event, resolve: resolve2 }) => resolve2(event)),
          handleError: module.handleError || (({ status, error: error2, event }) => {
            const error_message = format_server_error(status, error2, event);
            console.error(error_message);
          }),
          handleFetch: module.handleFetch || (({ request, fetch: fetch2 }) => fetch2(request)),
          handleValidationError: module.handleValidationError || (({ issues }) => {
            console.error("Remote function schema validation failed:", issues);
            return { message: "Bad Request" };
          }),
          reroute: module.reroute || noop2,
          transport: module.transport || {}
        };
        module.transport && Object.fromEntries(Object.entries(module.transport).map(([k, v]) => [k, v.decode]));
        if (module.init) await module.init();
      } catch (e3) {
        throw e3;
      }
    })());
  }
  /**
  * @param {Request} request
  * @param {import('types').RequestOptions} options
  */
  async respond(request, options2) {
    return respond(request, this.#options, this.#manifest, {
      ...options2,
      error: false,
      depth: 0
    });
  }
};

// .svelte-kit/cloudflare-tmp/manifest.js
var manifest = (() => {
  function __memo(fn) {
    let value;
    return () => value ??= value = fn();
  }
  __name(__memo, "__memo");
  return {
    appDir: "_app",
    appPath: "_app",
    assets: /* @__PURE__ */ new Set(["favicon.svg"]),
    mimeTypes: { ".svg": "image/svg+xml" },
    _: {
      client: { start: "_app/immutable/entry/start.CvxTYaPU.js", app: "_app/immutable/entry/app.Hf83VFc6.js", imports: ["_app/immutable/entry/start.CvxTYaPU.js", "_app/immutable/chunks/B90Er9NH.js", "_app/immutable/chunks/TqmLiPd2.js", "_app/immutable/entry/app.Hf83VFc6.js", "_app/immutable/chunks/TqmLiPd2.js", "_app/immutable/chunks/HclGiUj8.js", "_app/immutable/chunks/xihTtKlq.js"], stylesheets: [], fonts: [], uses_env_dynamic_public: true },
      nodes: [
        __memo(() => Promise.resolve().then(() => (init__(), __exports))),
        __memo(() => Promise.resolve().then(() => (init__2(), __exports2))),
        __memo(() => Promise.resolve().then(() => (init__3(), __exports3))),
        __memo(() => Promise.resolve().then(() => (init__4(), __exports4))),
        __memo(() => Promise.resolve().then(() => (init__5(), __exports5))),
        __memo(() => Promise.resolve().then(() => (init__6(), __exports6))),
        __memo(() => Promise.resolve().then(() => (init__7(), __exports7))),
        __memo(() => Promise.resolve().then(() => (init__8(), __exports8))),
        __memo(() => Promise.resolve().then(() => (init__9(), __exports9))),
        __memo(() => Promise.resolve().then(() => (init__10(), __exports10))),
        __memo(() => Promise.resolve().then(() => (init__11(), __exports11))),
        __memo(() => Promise.resolve().then(() => (init__12(), __exports12))),
        __memo(() => Promise.resolve().then(() => (init__13(), __exports13))),
        __memo(() => Promise.resolve().then(() => (init__14(), __exports14))),
        __memo(() => Promise.resolve().then(() => (init__15(), __exports15))),
        __memo(() => Promise.resolve().then(() => (init__16(), __exports16))),
        __memo(() => Promise.resolve().then(() => (init__17(), __exports17))),
        __memo(() => Promise.resolve().then(() => (init__18(), __exports18))),
        __memo(() => Promise.resolve().then(() => (init__19(), __exports19))),
        __memo(() => Promise.resolve().then(() => (init__20(), __exports20))),
        __memo(() => Promise.resolve().then(() => (init__21(), __exports21))),
        __memo(() => Promise.resolve().then(() => (init__22(), __exports22)))
      ],
      remotes: {},
      routes: [
        {
          id: "/",
          pattern: /^\/$/,
          params: [],
          page: { layouts: [0], errors: [1], leaf: 2 },
          endpoint: null
        },
        {
          id: "/activities/[id]",
          pattern: /^\/activities\/([^/]+?)\/?$/,
          params: [{ "name": "id", "optional": false, "rest": false, "chained": false }],
          page: { layouts: [0], errors: [1], leaf: 3 },
          endpoint: null
        },
        {
          id: "/activities/[id]/matched-routes",
          pattern: /^\/activities\/([^/]+?)\/matched-routes\/?$/,
          params: [{ "name": "id", "optional": false, "rest": false, "chained": false }],
          page: { layouts: [0], errors: [1], leaf: 4 },
          endpoint: null
        },
        {
          id: "/admin/jobs",
          pattern: /^\/admin\/jobs\/?$/,
          params: [],
          page: { layouts: [0], errors: [1], leaf: 5 },
          endpoint: null
        },
        {
          id: "/api/[...path]",
          pattern: /^\/api(?:\/([^]*))?\/?$/,
          params: [{ "name": "path", "optional": false, "rest": true, "chained": true }],
          page: null,
          endpoint: __memo(() => Promise.resolve().then(() => (init_server_ts(), server_ts_exports)))
        },
        {
          id: "/best-efforts",
          pattern: /^\/best-efforts\/?$/,
          params: [],
          page: { layouts: [0], errors: [1], leaf: 6 },
          endpoint: null
        },
        {
          id: "/best-efforts/[sport]",
          pattern: /^\/best-efforts\/([^/]+?)\/?$/,
          params: [{ "name": "sport", "optional": false, "rest": false, "chained": false }],
          page: { layouts: [0], errors: [1], leaf: 7 },
          endpoint: null
        },
        {
          id: "/best-efforts/[sport]/[distance]",
          pattern: /^\/best-efforts\/([^/]+?)\/([^/]+?)\/?$/,
          params: [{ "name": "sport", "optional": false, "rest": false, "chained": false }, { "name": "distance", "optional": false, "rest": false, "chained": false }],
          page: { layouts: [0], errors: [1], leaf: 8 },
          endpoint: null
        },
        {
          id: "/live/session/[id]",
          pattern: /^\/live\/session\/([^/]+?)\/?$/,
          params: [{ "name": "id", "optional": false, "rest": false, "chained": false }],
          page: { layouts: [0], errors: [1], leaf: 10 },
          endpoint: null
        },
        {
          id: "/live/[token]",
          pattern: /^\/live\/([^/]+?)\/?$/,
          params: [{ "name": "token", "optional": false, "rest": false, "chained": false }],
          page: { layouts: [0], errors: [1], leaf: 9 },
          endpoint: null
        },
        {
          id: "/login",
          pattern: /^\/login\/?$/,
          params: [],
          page: { layouts: [0], errors: [1], leaf: 11 },
          endpoint: null
        },
        {
          id: "/logout",
          pattern: /^\/logout\/?$/,
          params: [],
          page: null,
          endpoint: __memo(() => Promise.resolve().then(() => (init_server_ts2(), server_ts_exports2)))
        },
        {
          id: "/notifications",
          pattern: /^\/notifications\/?$/,
          params: [],
          page: { layouts: [0], errors: [1], leaf: 12 },
          endpoint: null
        },
        {
          id: "/people",
          pattern: /^\/people\/?$/,
          params: [],
          page: { layouts: [0], errors: [1], leaf: 13 },
          endpoint: null
        },
        {
          id: "/people/[id]",
          pattern: /^\/people\/([^/]+?)\/?$/,
          params: [{ "name": "id", "optional": false, "rest": false, "chained": false }],
          page: { layouts: [0], errors: [1], leaf: 14 },
          endpoint: null
        },
        {
          id: "/register",
          pattern: /^\/register\/?$/,
          params: [],
          page: { layouts: [0], errors: [1], leaf: 15 },
          endpoint: null
        },
        {
          id: "/settings",
          pattern: /^\/settings\/?$/,
          params: [],
          page: { layouts: [0], errors: [1], leaf: 16 },
          endpoint: null
        },
        {
          id: "/setup",
          pattern: /^\/setup\/?$/,
          params: [],
          page: { layouts: [0], errors: [1], leaf: 17 },
          endpoint: null
        },
        {
          id: "/setup/account",
          pattern: /^\/setup\/account\/?$/,
          params: [],
          page: { layouts: [0], errors: [1], leaf: 18 },
          endpoint: null
        },
        {
          id: "/upload",
          pattern: /^\/upload\/?$/,
          params: [],
          page: { layouts: [0], errors: [1], leaf: 19 },
          endpoint: null
        },
        {
          id: "/upload/activity",
          pattern: /^\/upload\/activity\/?$/,
          params: [],
          page: { layouts: [0], errors: [1], leaf: 20 },
          endpoint: null
        },
        {
          id: "/upload/strava",
          pattern: /^\/upload\/strava\/?$/,
          params: [],
          page: { layouts: [0], errors: [1], leaf: 21 },
          endpoint: null
        }
      ],
      prerendered_routes: /* @__PURE__ */ new Set([]),
      matchers: /* @__PURE__ */ __name(async () => {
        return {};
      }, "matchers"),
      server_assets: {}
    }
  };
})();
var prerendered = /* @__PURE__ */ new Set([]);
var base_path = "";

// .svelte-kit/cloudflare/_worker.js
import { env } from "cloudflare:workers";
async function e(e3, t22) {
  let n2 = "string" != typeof t22 && "HEAD" === t22.method;
  n2 && (t22 = new Request(t22, { method: "GET" }));
  let r3 = await e3.match(t22);
  return n2 && r3 && (r3 = new Response(null, r3)), r3;
}
__name(e, "e");
function t3(e3, t22, n2, o22) {
  return ("string" == typeof t22 || "GET" === t22.method) && r2(n2) && (n2.headers.has("Set-Cookie") && (n2 = new Response(n2.body, n2)).headers.append("Cache-Control", "private=Set-Cookie"), o22.waitUntil(e3.put(t22, n2.clone()))), n2;
}
__name(t3, "t");
var n = /* @__PURE__ */ new Set([200, 203, 204, 300, 301, 404, 405, 410, 414, 501]);
function r2(e3) {
  if (!n.has(e3.status)) return false;
  if (~(e3.headers.get("Vary") || "").indexOf("*")) return false;
  let t22 = e3.headers.get("Cache-Control") || "";
  return !/(private|no-cache|no-store)/i.test(t22);
}
__name(r2, "r");
function o2(n2) {
  return async function(r3, o22) {
    let a2 = await e(n2, r3);
    if (a2) return a2;
    o22.defer(((e3) => {
      t3(n2, r3, e3, o22);
    }));
  };
}
__name(o2, "o");
var s2 = caches.default;
var c = t3.bind(0, s2);
var r22 = e.bind(0, s2);
var e2 = o2.bind(0, s2);
var server = new Server(manifest);
var app_path = `/${manifest.appPath}`;
var immutable = `${app_path}/immutable/`;
var version_file = `${app_path}/version.json`;
var origin;
var initialized = server.init({
  // @ts-expect-error env contains environment variables and bindings
  env,
  read: /* @__PURE__ */ __name(async (file) => {
    const url = `${origin}/${file}`;
    const response = await /** @type {{ ASSETS: { fetch: typeof fetch } }} */
    env.ASSETS.fetch(
      url
    );
    if (!response.ok) {
      throw new Error(
        `read(...) failed: could not fetch ${url} (${response.status} ${response.statusText})`
      );
    }
    return response.body;
  }, "read")
});
var worker_default = {
  /**
   * @param {Request} req
   * @param {{ ASSETS: { fetch: typeof fetch } }} env
   * @param {ExecutionContext} ctx
   * @returns {Promise<Response>}
   */
  async fetch(req, env2, ctx) {
    if (!origin) {
      origin = new URL(req.url).origin;
    }
    await initialized;
    let pragma = req.headers.get("cache-control") || "";
    let res = !pragma.includes("no-cache") && await r22(req);
    if (res) return res;
    let { pathname, search } = new URL(req.url);
    try {
      pathname = decodeURIComponent(pathname);
    } catch {
    }
    const stripped_pathname = pathname.replace(/\/$/, "");
    let is_static_asset = false;
    const filename = stripped_pathname.slice(base_path.length + 1);
    if (filename) {
      is_static_asset = manifest.assets.has(filename) || manifest.assets.has(filename + "/index.html") || filename in manifest._.server_assets || filename + "/index.html" in manifest._.server_assets;
    }
    let location = pathname.at(-1) === "/" ? stripped_pathname : pathname + "/";
    if (is_static_asset || prerendered.has(pathname) || pathname === version_file || pathname.startsWith(immutable)) {
      res = await env2.ASSETS.fetch(req);
    } else if (location && prerendered.has(location)) {
      if (search) location += search;
      res = new Response("", {
        status: 308,
        headers: {
          location
        }
      });
    } else {
      res = await server.respond(req, {
        platform: {
          env: env2,
          ctx,
          context: ctx,
          // deprecated in favor of ctx
          // @ts-expect-error webworker types from worktop are not compatible with Cloudflare Workers types
          caches,
          // @ts-expect-error the type is correct but ts is confused because platform.cf uses the type from index.ts while req.cf uses the type from index.d.ts
          cf: req.cf
        },
        getClientAddress() {
          return (
            /** @type {string} */
            req.headers.get("cf-connecting-ip")
          );
        }
      });
    }
    pragma = res.headers.get("cache-control") || "";
    return pragma && res.status < 400 ? c(req, res, ctx) : res;
  }
};

// worker.js
var worker_default2 = {
  fetch(request, env2, context3) {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/events" || pathname === "/api/v1/events") {
      return env2.KONDIS_API.fetch(request);
    }
    return worker_default.fetch(request, env2, context3);
  }
};
export {
  worker_default2 as default
};
/**
* @file
* @license @lucide/svelte v1.38.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
/*!
* cookie
* Copyright(c) 2012-2014 Roman Shtylman
* Copyright(c) 2015 Douglas Christopher Wilson
* MIT Licensed
*/
//# sourceMappingURL=worker.js.map
