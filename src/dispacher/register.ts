import { Class, Klass } from './types'

export type Registry = {
    [ key: string ]: {
        klass: Klass
        omit: ReadonlyArray<string>
    }
}

export type RegisterOptions<T> = {
    omit?: ReadonlyArray<keyof T>
}

const registry: Registry = {}

/**
 * Register the given class as serializable.
 *
 * @param options
 * @param options.omit List of properties to omit from serialization
 *
 * @private
 */
export function register<T extends any>(klass: Class<T>, name: string, options: RegisterOptions<T> = {}) {
    Object.defineProperty(klass, '_classRegistryKey', {
        value: name,
        writable: false
    });
    registry[name] = {
        klass,
        omit: options.omit || []
    } as unknown as Registry[string];
}
export default registry


// Register //////////////////////////////////////////////////////////////////////////////////////////////////////

register(Error, 'Error')
register(Object, 'Object')