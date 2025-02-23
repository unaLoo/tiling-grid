/*
 * Call an asynchronous function on an array of arguments,
 * calling `callback` with the completed results of all calls.
 *
 * @param array input to each call of the async function.
 * @param fn an async function with signature (data, callback)
 * @param callback a callback run after all async work is done.
 * called with an array, containing the results of each async call.
 * @private
 */
export function asyncAll<Item>(
    array: Array<Item>,
    fn: (item: Item, fnCallback: Function) => void,
    callback: Function,
): void {
    if (!array.length) { return callback(null, []); }
    let remaining = array.length;
    const results = new Array(array.length);
    let error: unknown = null;
    array.forEach((item, i) => {
        fn(item, (err: Error, result: unknown) => {
            if (err) error = err;
            results[i] = result;
            if (--remaining === 0) callback(error, results);
        });
    });
}

/**
 * Given an array of member function names as strings, replace all of them
 * with bound versions that will always refer to `context` as `this`. This
 * is useful for classes where otherwise event bindings would reassign
 * `this` to the evented object or some other value: this lets you ensure
 * the `this` value always.
 *
 * @param fns list of member function names
 * @param context the context value
 * @example
 * function MyClass() {
 *   bindAll(['ontimer'], this);
 *   this.name = 'Tom';
 * }
 * MyClass.prototype.ontimer = function() {
 *   alert(this.name);
 * };
 * var myClass = new MyClass();
 * setTimeout(myClass.ontimer, 100);
 * @private
 */
export function bindAll(fns: Array<string>, context: any): void {
    fns.forEach((fn) => {
        if (!context[fn]) { return; }
        context[fn] = context[fn].bind(context);
    });
}

/* global WorkerGlobalScope */
/**
 *  Returns true if run in the web-worker context.
 *
 * @private
 * @returns {boolean}
 */
export function isWorker(): boolean {
    return typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined' && self instanceof WorkerGlobalScope;
}


let id = 1;
export function uniqueId(): number {
    return id++;
}


import registry from "./register"
import { Klass, Serialized, SerializedObject, Transferable } from './types'

function isArrayBuffer(val: any): boolean {

    return val instanceof ArrayBuffer
}

function isImageBitmap(val: any): boolean {

    return val instanceof ImageBitmap
}
/**
 * Serialize the given object for transfer to or from a web worker.
 *
 * For non-builtin types, recursively serialize each property (possibly
 * omitting certain properties - see register()), and package the result along
 * with the constructor's `name` so that the appropriate constructor can be
 * looked up in `deserialize()`.
 *
 * If a `transferables` set is provided, add any transferable objects (i.e.,
 * any ArrayBuffers or ArrayBuffer views) to the list. (If a copy is needed,
 * this should happen in the client code, before using serialize().)
 *
 * @private
 */
export function serialize(input: unknown, transferables?: Set<Transferable>): Serialized {

    if (
        input === null ||
        input === undefined ||
        typeof input === 'boolean' ||
        typeof input === 'number' ||
        typeof input === 'string' ||
        input instanceof Boolean ||
        input instanceof Number ||
        input instanceof String ||
        input instanceof Date ||
        input instanceof RegExp
    ) return input as Serialized

    if (isArrayBuffer(input) || isImageBitmap(input)) {
        transferables?.add(input as Transferable)
        return input as any
    }

    if (ArrayBuffer.isView(input)) {
        const view = input as ArrayBufferView
        transferables?.add(view.buffer as Transferable)
        return view
    }

    if (input instanceof ImageData) {
        transferables?.add(input.data.buffer as Transferable)
        return input
    }

    if (Array.isArray(input)) {
        const serialized: Array<Serialized> = input.map(item => serialize(item, transferables))
        return serialized
    }

    if (input instanceof Set) {
        const properties: { [key: number | string]: Serialized } = { '$name': 'Set' }
        //@ts-ignore Property 'forEach' does not exist on type 'SetIterator<any>'.ts(2339)
        input.values().forEach((value, index) => properties[index + 1] = serialize(value))
        return properties
    }

    if (typeof input === 'object') {
        const klass = input.constructor as Klass
        const name = klass._classRegistryKey
        if (!registry[name]) {
            throw new Error(`Cannot serialize object of unregistered class ${name}`)
        }

        const properties: SerializedObject = klass.serialize ? klass.serialize(input, transferables) : {}

        if (!klass.serialize) {
            for (const key in input) {
                if (!input.hasOwnProperty(key)) continue
                if (registry[name].omit.indexOf(key) >= 0) continue
                const property = (input as any)[key]
                properties[key] = serialize(property, transferables)
            }
            if (input instanceof Error) {
                properties['message'] = input.message
            }
        }

        if (properties['$name']) throw new Error('$name property is reserved for worker serialization logic.')
        if (name !== 'Object') properties['$name'] = name

        return properties
    }

    throw new Error(`Cannot serialize object of type ${typeof input}`);
}

export function deserialize(input: Serialized): unknown {

    if (
        input === null ||
        input === undefined ||
        typeof input === 'boolean' ||
        typeof input === 'number' ||
        typeof input === 'string' ||
        input instanceof Boolean ||
        input instanceof Number ||
        input instanceof String ||
        input instanceof Date ||
        input instanceof RegExp ||
        input instanceof ImageData ||
        isArrayBuffer(input) ||
        isImageBitmap(input) ||
        ArrayBuffer.isView(input)
    ) return input

    if (Array.isArray(input)) {
        return input.map(deserialize)
    }

    if (typeof input === 'object') {
        const name = (input as any).$name || 'Object'

        if (name === 'Set') {
            const set = new Set()
            for (const key of Object.keys(input)) {
                if (key === '$name') continue

                const value = (input as SerializedObject)[key]
                set.add(deserialize(value))
            }

            return set
        }

        const { klass } = registry[name]
        if (!klass) throw new Error(`Cannot deserialize unregistered class ${name}`)

        if (klass.deserialize) {
            return klass.deserialize(input)
        }

        const result: {
            [key: string]: any
        } = Object.create(klass.prototype)

        for (const key of Object.keys(input)) {
            if (key === '$name') continue

            const value = (input as SerializedObject)[key]
            result[key] = deserialize(value)
        }

        return result
    }
}