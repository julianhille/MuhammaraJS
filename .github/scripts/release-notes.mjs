// Build the body of a GitHub release from the package changelog and the
// repository history between the previous tag with the same prefix and the
// released tag.
//
//   node .github/scripts/release-notes.mjs <changelog> <tag-prefix> <tag> [--output <file>]
//
// Reads GITHUB_TOKEN (or GH_TOKEN) for the GitHub REST API and
// GITHUB_REPOSITORY for the repository, which defaults to
// julianhille/MuhammaraJS. Prints the notes to stdout unless --output names a
// file. Works for an already released tag, so a release page can be
// reproduced locally.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

var defaultRepository = "julianhille/MuhammaraJS";
var apiBase = "https://api.github.com";
var versionPattern =
  /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;
var closingKeywords =
  /\b(?:close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved)\s*:?\s+(?:https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/issues\/|#)(\d+)/gi;

/**
 * Parse a semantic version string.
 *
 * @param {string} version version without the tag prefix
 * @returns {{major: number, minor: number, patch: number, prerelease: (string|number)[]}|null} parsed version, or null when it is not a semantic version
 */
export function parseVersion(version) {
  var match = versionPattern.exec(version);
  if (!match) {
    return null;
  }
  var prerelease = match[4]
    ? match[4].split(".").map(function (identifier) {
        return /^\d+$/.test(identifier) ? Number(identifier) : identifier;
      })
    : [];
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: prerelease,
  };
}

/**
 * Compare two prerelease identifiers by the semantic versioning rules.
 *
 * @param {string|number} left left identifier
 * @param {string|number} right right identifier
 * @returns {number} negative, zero, or positive
 */
function compareIdentifiers(left, right) {
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  if (typeof left === "number") {
    return -1;
  }
  if (typeof right === "number") {
    return 1;
  }
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Compare two parsed versions by the semantic versioning precedence rules.
 *
 * @param {ReturnType<typeof parseVersion>} left left version
 * @param {ReturnType<typeof parseVersion>} right right version
 * @returns {number} negative when left precedes right, zero when equal, positive otherwise
 */
export function compareVersions(left, right) {
  for (var part of ["major", "minor", "patch"]) {
    if (left[part] !== right[part]) {
      return left[part] - right[part];
    }
  }
  if (left.prerelease.length === 0 || right.prerelease.length === 0) {
    return right.prerelease.length - left.prerelease.length;
  }
  var count = Math.min(left.prerelease.length, right.prerelease.length);
  for (var index = 0; index < count; index += 1) {
    var difference = compareIdentifiers(
      left.prerelease[index],
      right.prerelease[index],
    );
    if (difference !== 0) {
      return difference;
    }
  }
  return left.prerelease.length - right.prerelease.length;
}

/**
 * Find the tag released before the given one: the highest semantic version
 * with the same prefix that precedes it. Tags with another prefix, such as the
 * documentation tags or the other package's tags, are ignored.
 *
 * @param {string[]} tags all tag names of the repository
 * @param {string} prefix tag prefix such as "native-v"
 * @param {string} tag the released tag
 * @returns {string|null} the previous tag, or null when this is the first release
 */
export function previousTag(tags, prefix, tag) {
  if (!tag.startsWith(prefix)) {
    throw new Error(`Tag ${tag} does not start with ${prefix}`);
  }
  var released = parseVersion(tag.slice(prefix.length));
  if (!released) {
    throw new Error(`Tag ${tag} is not a semantic version`);
  }
  var best = null;
  for (var name of tags) {
    if (!name.startsWith(prefix) || name === tag) {
      continue;
    }
    var version = parseVersion(name.slice(prefix.length));
    if (!version || compareVersions(version, released) >= 0) {
      continue;
    }
    if (!best || compareVersions(version, best.version) > 0) {
      best = { name: name, version: version };
    }
  }
  return best ? best.name : null;
}

/**
 * Extract the section of a Keep a Changelog file that documents one version.
 *
 * @param {string} changelog changelog contents
 * @param {string} version released version without the tag prefix
 * @returns {string} the section body without its heading
 */
export function changelogSection(changelog, version) {
  var lines = changelog.split(/\r?\n/);
  var heading = `## [${version}]`;
  var start = lines.findIndex(function (line) {
    return line === heading || line.startsWith(`${heading} `);
  });
  if (start === -1) {
    throw new Error(`The changelog has no "${heading}" section`);
  }
  var body = [];
  for (var line of lines.slice(start + 1)) {
    if (line.startsWith("## ")) {
      break;
    }
    body.push(line);
  }
  var section = body.join("\n").trim();
  if (section === "") {
    throw new Error(`The changelog "${heading}" section is empty`);
  }
  return section;
}

/**
 * Point the relative links of a changelog section at the repository at the
 * released tag, so they resolve on the release page. Absolute URLs, fragment
 * links, and reference-style links stay as they are.
 *
 * @param {string} section changelog section
 * @param {{repository: string, tag: string, directory: string}} options where the changelog lives in the repository
 * @returns {string} the section with repository links
 */
export function absoluteLinks(section, options) {
  return section.replace(/\]\(([^)\s]+)\)/g, function (match, target) {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target)) {
      return match;
    }
    var split = target.split("#");
    var resolved = path.posix.normalize(
      path.posix.join(options.directory || ".", split[0]),
    );
    if (resolved === "." || resolved.startsWith("../")) {
      return match;
    }
    var fragment = split.length > 1 ? `#${split.slice(1).join("#")}` : "";
    return `](https://github.com/${options.repository}/blob/${options.tag}/${resolved}${fragment})`;
  });
}

/**
 * Find where a changelog lives inside its repository: its directory relative
 * to the nearest ancestor that holds a `.git` entry, which a worktree has too.
 *
 * @param {string} changelogPath path of the changelog file
 * @returns {string} POSIX path of the changelog's directory, "." at the root
 */
export function changelogDirectory(changelogPath) {
  var directory = path.resolve(path.dirname(changelogPath));
  var root = directory;
  while (!existsSync(path.join(root, ".git"))) {
    var parent = path.dirname(root);
    if (parent === root) {
      return ".";
    }
    root = parent;
  }
  return path.relative(root, directory).split(path.sep).join("/") || ".";
}

/**
 * Collect the issues a pull request closes, from the closing keywords in its
 * description. Issues of other repositories are ignored.
 *
 * @param {string|null|undefined} body pull request description
 * @param {string} repository "owner/name" of this repository
 * @returns {number[]} issue numbers in ascending order
 */
export function closedIssues(body, repository) {
  var numbers = new Set();
  for (var match of (body || "").matchAll(closingKeywords)) {
    if (match[1] && match[1].toLowerCase() !== repository.toLowerCase()) {
      continue;
    }
    numbers.add(Number(match[2]));
  }
  return Array.from(numbers).sort(function (left, right) {
    return left - right;
  });
}

/**
 * Tell whether a GitHub account is a bot.
 *
 * @param {{login: string, type?: string}|null|undefined} user GitHub account
 * @returns {boolean} true for bots and missing accounts
 */
export function isBot(user) {
  return !user || user.type === "Bot" || /\[bot\]$/i.test(user.login);
}

/**
 * Compare two logins case-insensitively for sorting.
 *
 * @param {string} left left login
 * @param {string} right right login
 * @returns {number} negative, zero, or positive
 */
function compareLogins(left, right) {
  return left.localeCompare(right, "en", { sensitivity: "base" });
}

/**
 * Create a minimal GitHub REST API client.
 *
 * @param {{token?: string, fetch?: typeof fetch}} [options] API options
 * @returns {{get: function(string): Promise<any>, paginate: function(string, function(any): any[]): Promise<any[]>, oldest: function(string): Promise<any>}} API client
 */
export function createApi(options) {
  var settings = options || {};
  var fetchImplementation = settings.fetch || fetch;
  var headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "MuhammaraJS-release-notes",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (settings.token) {
    headers.Authorization = `Bearer ${settings.token}`;
  }

  /**
   * Request one page.
   *
   * @param {string} url absolute URL or API path
   * @returns {Promise<{body: any, next: string|null, last: string|null}>} parsed body and pagination links
   */
  async function request(url) {
    var absolute = url.startsWith("https://") ? url : `${apiBase}${url}`;
    var response = await fetchImplementation(absolute, { headers: headers });
    if (!response.ok) {
      throw new Error(
        `GitHub API ${response.status} for ${absolute}: ${await response.text()}`,
      );
    }
    var links = {};
    for (var part of (response.headers.get("link") || "").split(",")) {
      var link = /<([^>]+)>;\s*rel="([^"]+)"/.exec(part);
      if (link) {
        links[link[2]] = link[1];
      }
    }
    return {
      body: await response.json(),
      next: links.next || null,
      last: links.last || null,
    };
  }

  return {
    /**
     * Fetch one resource.
     *
     * @param {string} path API path
     * @returns {Promise<any>} parsed body
     */
    get: async function (path) {
      return (await request(path)).body;
    },
    /**
     * Fetch every page of a list.
     *
     * @param {string} path API path with its query string
     * @param {function(any): any[]} [pick] selects the list from a page body
     * @returns {Promise<any[]>} all items
     */
    paginate: async function (path, pick) {
      var items = [];
      var url = path;
      while (url) {
        var page = await request(url);
        items.push(...(pick ? pick(page.body) : page.body));
        url = page.next;
      }
      return items;
    },
    /**
     * Fetch the last item of a list that the API returns newest first.
     *
     * @param {string} path API path with its query string
     * @returns {Promise<any>} the last item, or undefined for an empty list
     */
    oldest: async function (path) {
      var page = await request(path);
      if (page.last) {
        page = await request(page.last);
      }
      return page.body[page.body.length - 1];
    },
  };
}

/**
 * Gather the pull requests, contributors, and first-time contributors between
 * the previous tag and the released tag.
 *
 * @param {ReturnType<typeof createApi>} api GitHub API client
 * @param {{repository: string, prefix: string, tag: string}} options what to collect
 * @returns {Promise<{tag: string, previous: string|null, pullRequests: {number: number, title: string, author: string, issues: number[]}[], contributors: string[], newContributors: {login: string, pullRequest: number|null}[]}>} the collected release data
 */
export async function collectRelease(api, options) {
  var repository = options.repository;
  var tags = await api.paginate(`/repos/${repository}/tags?per_page=100`);
  var previous = previousTag(
    tags.map(function (entry) {
      return entry.name;
    }),
    options.prefix,
    options.tag,
  );
  var release = {
    tag: options.tag,
    previous: previous,
    pullRequests: [],
    contributors: [],
    newContributors: [],
  };
  if (!previous) {
    return release;
  }

  var commits = await api.paginate(
    `/repos/${repository}/compare/${previous}...${options.tag}?per_page=100`,
    function (page) {
      return page.commits;
    },
  );
  var commitShas = new Set();
  var users = new Map();
  var pullRequests = new Map();
  for (var commit of commits) {
    commitShas.add(commit.sha);
    if (!isBot(commit.author)) {
      users.set(commit.author.login, commit.author);
    }
    var associated = await api.get(
      `/repos/${repository}/commits/${commit.sha}/pulls`,
    );
    for (var pull of associated) {
      if (pull.state === "closed" && !pull.merged_at) {
        continue;
      }
      if (!isBot(pull.user)) {
        users.set(pull.user.login, pull.user);
      }
      pullRequests.set(pull.number, {
        number: pull.number,
        title: pull.title.trim(),
        author: pull.user ? pull.user.login : null,
        issues: closedIssues(pull.body, repository),
      });
    }
  }
  release.pullRequests = Array.from(pullRequests.values()).sort(
    function (left, right) {
      return left.number - right.number;
    },
  );
  release.contributors = Array.from(users.keys()).sort(compareLogins);

  for (var login of release.contributors) {
    var oldest = await api.oldest(
      `/repos/${repository}/commits?author=${encodeURIComponent(login)}&per_page=100`,
    );
    if (!oldest || !commitShas.has(oldest.sha)) {
      continue;
    }
    var firstPull = release.pullRequests.find(function (pull) {
      return pull.author === login;
    });
    release.newContributors.push({
      login: login,
      pullRequest: firstPull ? firstPull.number : null,
    });
  }
  return release;
}

/**
 * Render the release body.
 *
 * @param {{repository: string, changelog: string, release: Awaited<ReturnType<typeof collectRelease>>}} input the changelog section and the collected release data
 * @returns {string} Markdown release body
 */
export function renderNotes(input) {
  var release = input.release;
  var repositoryUrl = `https://github.com/${input.repository}`;
  var lines = ["## Changelog", "", input.changelog];

  if (release.pullRequests.length > 0) {
    lines.push("", "## Pull requests", "");
    for (var pull of release.pullRequests) {
      var line = `- #${pull.number} ${pull.title}`;
      if (pull.author) {
        line += ` by @${pull.author}`;
      }
      if (pull.issues.length > 0) {
        line += `, closes ${pull.issues
          .map(function (issue) {
            return `#${issue}`;
          })
          .join(", ")}`;
      }
      lines.push(line);
    }
  }

  if (release.contributors.length > 0) {
    lines.push(
      "",
      "## Contributors",
      "",
      release.contributors
        .map(function (login) {
          return `@${login}`;
        })
        .join(", "),
    );
  }

  if (release.newContributors.length > 0) {
    lines.push("", "## New contributors", "");
    for (var contributor of release.newContributors) {
      lines.push(
        contributor.pullRequest
          ? `- @${contributor.login} made their first contribution in #${contributor.pullRequest}`
          : `- @${contributor.login} made their first contribution`,
      );
    }
  }

  if (release.previous) {
    lines.push(
      "",
      `**Full changelog**: ${repositoryUrl}/compare/${release.previous}...${release.tag}`,
    );
  }
  return lines.join("\n") + "\n";
}

/**
 * Parse the command line.
 *
 * @param {string[]} argv arguments after the script path
 * @returns {{changelog: string, prefix: string, tag: string, output: string|null}} parsed arguments
 */
export function parseArguments(argv) {
  var positional = [];
  var output = null;
  for (var index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--output") {
      output = argv[index + 1];
      index += 1;
      if (!output) {
        throw new Error("--output needs a file path");
      }
    } else {
      positional.push(argv[index]);
    }
  }
  if (positional.length !== 3) {
    throw new Error(
      "Usage: node .github/scripts/release-notes.mjs <changelog> <tag-prefix> <tag> [--output <file>]",
    );
  }
  return {
    changelog: positional[0],
    prefix: positional[1],
    tag: positional[2],
    output: output,
  };
}

/**
 * Run the command line.
 *
 * @param {string[]} argv arguments after the script path
 * @param {NodeJS.ProcessEnv} env environment variables
 * @returns {Promise<string>} the rendered notes
 */
export async function main(argv, env) {
  var options = parseArguments(argv);
  var repository = env.GITHUB_REPOSITORY || defaultRepository;
  var changelog = absoluteLinks(
    changelogSection(
      readFileSync(options.changelog, "utf8"),
      options.tag.startsWith(options.prefix)
        ? options.tag.slice(options.prefix.length)
        : options.tag,
    ),
    {
      repository: repository,
      tag: options.tag,
      directory: changelogDirectory(options.changelog),
    },
  );
  var api = createApi({ token: env.GITHUB_TOKEN || env.GH_TOKEN });
  var release = await collectRelease(api, {
    repository: repository,
    prefix: options.prefix,
    tag: options.tag,
  });
  var notes = renderNotes({
    repository: repository,
    changelog: changelog,
    release: release,
  });
  if (options.output) {
    writeFileSync(options.output, notes);
  } else {
    process.stdout.write(notes);
  }
  return notes;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main(process.argv.slice(2), process.env);
}
