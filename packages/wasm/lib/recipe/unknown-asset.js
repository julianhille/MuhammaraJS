/**
 * Creates the error for an asset name that is not registered. A non-string
 * name is described by its type only, so bytes passed in place of a name never
 * end up in the message.
 * @param {string} message - Message prefix, such as `Unknown PDF`.
 * @param {*} name - The name the caller passed.
 * @returns {Error} A TypeError for a non-string name, otherwise an Error.
 */
export function unknownAsset(message, name) {
  if (typeof name === "string") return new Error(`${message}: ${name}`);
  return new TypeError(
    `${message}: expected a registered name, received ${name?.constructor?.name ?? typeof name}`,
  );
}
