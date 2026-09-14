var fs = require("fs");
var path = require("path");
var childProcess = require("child_process");

/**
 * Execute selected JavaScript fences from a how-to page in a temporary directory.
 * Only package imports are available; examples cannot rely on local helpers.
 * @param {string} pageName Documentation filename without its extension.
 * @param {number[]} indexes Zero-based JavaScript fence indexes, in execution order.
 * @param {string} directory Directory containing the example's input.pdf.
 * @param {string} resultExpression Expression whose JSON result is returned.
 * @returns {unknown} The example's JSON-serializable result.
 */
module.exports = function (pageName, indexes, directory, resultExpression) {
  var markdown = fs.readFileSync(
    path.join(__dirname, "../../native/docs/how-to", pageName + ".md"),
    "utf8",
  );
  var blocks = Array.from(markdown.matchAll(/```javascript\n([\s\S]*?)```/g));
  var source = indexes.map(function (index) {
    if (!blocks[index]) {
      throw new Error(
        "Missing JavaScript example " + index + " in " + pageName,
      );
    }
    return blocks[index][1];
  });
  source.unshift(
    'require.cache[require.resolve("@muhammara/native")] = { exports: require("@muhammara/native-with-source") };',
  );
  source.push("console.log(JSON.stringify(" + resultExpression + "));");
  return JSON.parse(
    childProcess.execFileSync(process.execPath, ["-e", source.join("\n")], {
      cwd: directory,
      encoding: "utf8",
      env: Object.assign({}, process.env, {
        NODE_PATH: path.join(__dirname, "../../../node_modules"),
      }),
    }),
  );
};
