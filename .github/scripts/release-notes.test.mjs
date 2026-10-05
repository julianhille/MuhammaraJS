import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  absoluteLinks,
  changelogDirectory,
  changelogSection,
  closedIssues,
  collectRelease,
  compareVersions,
  createApi,
  isBot,
  parseArguments,
  parseVersion,
  previousTag,
  renderNotes,
} from "./release-notes.mjs";

var repository = "julianhille/MuhammaraJS";
var tags = [
  "native-v7.1.0",
  "native-doc-v7.0.0",
  "native-v7.0.0",
  "native-v7.0.0-rc.2",
  "native-v7.0.0-rc.1",
  "native-v6.0.6",
  "wasm-doc-v1.0.0",
  "wasm-v1.1.0",
  "wasm-v1.0.0",
  "wasm-v1.0.0-rc.2",
  "v6.0.5",
];
var changelog = [
  "# Changelog",
  "",
  "## [Unreleased]",
  "",
  "### Added",
  "",
  "- Something not released yet",
  "",
  "## [7.1.0] - 2026-10-05",
  "",
  "### Added",
  "",
  "- `recryptAsync()` [#872](https://github.com/julianhille/MuhammaraJS/issues/872)",
  "",
  "### Fixed",
  "",
  "- Keep going",
  "",
  "## [7.0.0] - 2026-10-01",
  "",
  "### Breaking Changes",
  "",
  "- Old news",
  "",
].join("\n");

/**
 * Create a GitHub user record.
 *
 * @param {string} login account name
 * @param {string} [type] account type
 * @returns {{login: string, type: string}} user record
 */
function user(login, type) {
  return { login: login, type: type || "User" };
}

/**
 * Build a fake API client over canned responses.
 *
 * @param {Record<string, any>} responses responses by API path
 * @param {Record<string, any>} oldestCommits oldest commit by login
 * @returns {{api: ReturnType<typeof createApi>, calls: string[]}} the client and the paths it requested
 */
function fakeApi(responses, oldestCommits) {
  var calls = [];

  /**
   * Look up a canned response.
   *
   * @param {string} path API path
   * @returns {any} the response
   */
  function respond(path) {
    calls.push(path);
    assert.ok(path in responses, `Unexpected request ${path}`);
    return responses[path];
  }

  return {
    calls: calls,
    api: {
      get: async function (path) {
        return respond(path);
      },
      paginate: async function (path, pick) {
        var body = respond(path);
        return pick ? pick(body) : body;
      },
      oldest: async function (path) {
        calls.push(path);
        var login = decodeURIComponent(/author=([^&]+)/.exec(path)[1]);
        return oldestCommits[login];
      },
    },
  };
}

describe("parseVersion and compareVersions", function () {
  it("parses release and prerelease versions", function () {
    assert.deepEqual(parseVersion("7.1.0"), {
      major: 7,
      minor: 1,
      patch: 0,
      prerelease: [],
    });
    assert.deepEqual(parseVersion("8.0.0-alpha.2"), {
      major: 8,
      minor: 0,
      patch: 0,
      prerelease: ["alpha", 2],
    });
    assert.equal(parseVersion("7.0.0.1"), null);
    assert.equal(parseVersion("v7.0.0"), null);
  });

  it("orders versions by semantic versioning precedence", function () {
    /**
     * Compare two version strings.
     *
     * @param {string} left left version
     * @param {string} right right version
     * @returns {number} sign of the comparison
     */
    function order(left, right) {
      return Math.sign(
        compareVersions(parseVersion(left), parseVersion(right)),
      );
    }
    assert.equal(order("7.0.0", "7.0.0"), 0);
    assert.equal(order("7.0.0", "7.1.0"), -1);
    assert.equal(order("7.0.0-rc.2", "7.0.0"), -1);
    assert.equal(order("7.0.0", "7.0.0-rc.2"), 1);
    assert.equal(order("7.0.0-rc.1", "7.0.0-rc.2"), -1);
    assert.equal(order("7.0.0-alpha.1", "7.0.0-beta.1"), -1);
    assert.equal(order("7.0.0-alpha", "7.0.0-alpha.1"), -1);
    assert.equal(order("7.0.0-1", "7.0.0-alpha"), -1);
    assert.equal(order("8.0.0-alpha.1", "7.1.0"), 1);
  });
});

describe("previousTag", function () {
  it("selects the highest earlier tag with the same prefix", function () {
    assert.equal(
      previousTag(tags, "native-v", "native-v7.1.0"),
      "native-v7.0.0",
    );
    assert.equal(previousTag(tags, "wasm-v", "wasm-v1.1.0"), "wasm-v1.0.0");
  });

  it("compares a prerelease against the latest tag before it", function () {
    assert.equal(
      previousTag(tags, "native-v", "native-v8.0.0-alpha.1"),
      "native-v7.1.0",
    );
    assert.equal(
      previousTag(tags, "native-v", "native-v7.0.0-rc.2"),
      "native-v7.0.0-rc.1",
    );
    assert.equal(
      previousTag(tags, "native-v", "native-v7.0.0"),
      "native-v7.0.0-rc.2",
    );
  });

  it("ignores documentation tags, legacy tags, and the other package", function () {
    assert.equal(
      previousTag(tags, "native-v", "native-v7.0.0-rc.1"),
      "native-v6.0.6",
    );
    assert.equal(previousTag(tags, "wasm-v", "wasm-v1.0.0-rc.2"), null);
    assert.equal(
      previousTag(["native-doc-v7.0.0"], "native-v", "native-v7.0.0"),
      null,
    );
  });

  it("rejects tags that do not match the prefix or are not versions", function () {
    assert.throws(function () {
      previousTag(tags, "native-v", "wasm-v1.1.0");
    }, /does not start with native-v/);
    assert.throws(function () {
      previousTag(tags, "native-v", "native-v7.0.0.1");
    }, /not a semantic version/);
  });
});

describe("changelogSection", function () {
  it("returns the body of the released version only", function () {
    assert.equal(
      changelogSection(changelog, "7.1.0"),
      [
        "### Added",
        "",
        "- `recryptAsync()` [#872](https://github.com/julianhille/MuhammaraJS/issues/872)",
        "",
        "### Fixed",
        "",
        "- Keep going",
      ].join("\n"),
    );
    assert.equal(
      changelogSection(changelog, "7.0.0"),
      "### Breaking Changes\n\n- Old news",
    );
  });

  it("accepts a heading without a date and CRLF line endings", function () {
    assert.equal(
      changelogSection("## [1.0.0]\r\n\r\n- Entry\r\n", "1.0.0"),
      "- Entry",
    );
  });

  it("fails when the version has no section or an empty one", function () {
    assert.throws(function () {
      changelogSection(changelog, "7.2.0");
    }, /no "## \[7\.2\.0\]" section/);
    assert.throws(function () {
      changelogSection("## [1.0.0]\n\n## [0.9.0]\n\n- Entry\n", "1.0.0");
    }, /section is empty/);
    assert.throws(function () {
      changelogSection(changelog, "7.1");
    }, /no "## \[7\.1\]" section/);
  });
});

describe("absoluteLinks", function () {
  it("points relative links at the repository at the tag", function () {
    assert.equal(
      absoluteLinks(
        [
          "see [Matrix](packages/native/docs/getting-started/installation.md#prebuilt-support-matrix)",
          "and [Breaking](docs/breaking-changes.md#version-1x) and [up](../README.md)",
          "and [issue](https://github.com/julianhille/MuhammaraJS/issues/1)",
          "and [here](#anchor) and [mail](mailto:a@b.c) and [ref][1]",
        ].join("\n"),
        {
          repository: repository,
          tag: "wasm-v1.1.0",
          directory: "packages/wasm",
        },
      ),
      [
        "see [Matrix](https://github.com/julianhille/MuhammaraJS/blob/wasm-v1.1.0/packages/wasm/packages/native/docs/getting-started/installation.md#prebuilt-support-matrix)",
        "and [Breaking](https://github.com/julianhille/MuhammaraJS/blob/wasm-v1.1.0/packages/wasm/docs/breaking-changes.md#version-1x) and [up](https://github.com/julianhille/MuhammaraJS/blob/wasm-v1.1.0/packages/README.md)",
        "and [issue](https://github.com/julianhille/MuhammaraJS/issues/1)",
        "and [here](#anchor) and [mail](mailto:a@b.c) and [ref][1]",
      ].join("\n"),
    );
    assert.equal(
      absoluteLinks("[root](CHANGELOG.md) [out](../other.md)", {
        repository: repository,
        tag: "native-v7.1.0",
        directory: ".",
      }),
      "[root](https://github.com/julianhille/MuhammaraJS/blob/native-v7.1.0/CHANGELOG.md) [out](../other.md)",
    );
  });
});

describe("changelogDirectory", function () {
  it("locates the changelog inside its repository", function () {
    var root = new URL("../../", import.meta.url).pathname;
    assert.equal(changelogDirectory(`${root}CHANGELOG.md`), ".");
    assert.equal(
      changelogDirectory(`${root}packages/wasm/CHANGELOG.md`),
      "packages/wasm",
    );
    assert.equal(changelogDirectory("/CHANGELOG.md"), ".");
  });
});

describe("closedIssues", function () {
  it("collects issues from every closing keyword and full URLs", function () {
    assert.deepEqual(
      closedIssues(
        [
          "Fixes #12 and resolves #3.",
          "Closes: https://github.com/julianhille/MuhammaraJS/issues/40",
          "Closed #12 again",
          "Closes https://github.com/other/repo/issues/99",
          "See #77",
          "",
          "Closes #41",
        ].join("\n"),
        repository,
      ),
      [3, 12, 40, 41],
    );
    assert.deepEqual(closedIssues(null, repository), []);
  });
});

describe("isBot", function () {
  it("recognizes bot accounts and missing accounts", function () {
    assert.equal(isBot(user("dependabot[bot]")), true);
    assert.equal(isBot(user("github-actions", "Bot")), true);
    assert.equal(isBot(null), true);
    assert.equal(isBot(user("julianhille")), false);
  });
});

describe("collectRelease", function () {
  var responses = {
    "/repos/julianhille/MuhammaraJS/tags?per_page=100": tags.map(
      function (name) {
        return { name: name };
      },
    ),
    "/repos/julianhille/MuhammaraJS/compare/native-v7.0.0...native-v7.1.0?per_page=100":
      {
        commits: [
          { sha: "a1", author: user("julianhille") },
          { sha: "a2", author: user("julianhille") },
          { sha: "b1", author: user("Newcomer") },
          { sha: "c1", author: user("dependabot[bot]", "Bot") },
          { sha: "d1", author: null },
          { sha: "e1", author: user("veteran") },
        ],
      },
    "/repos/julianhille/MuhammaraJS/commits/a1/pulls": [
      {
        number: 901,
        state: "closed",
        merged_at: "2026-10-03T00:00:00Z",
        title: " Keep recryptAsync off the time zone ",
        user: user("julianhille"),
        body: "Closes #896",
      },
    ],
    "/repos/julianhille/MuhammaraJS/commits/a2/pulls": [
      {
        number: 901,
        state: "closed",
        merged_at: "2026-10-03T00:00:00Z",
        title: "Keep recryptAsync off the time zone",
        user: user("julianhille"),
        body: "Closes #896",
      },
      {
        number: 950,
        state: "closed",
        merged_at: null,
        title: "Abandoned attempt",
        user: user("julianhille"),
        body: "Closes #1",
      },
    ],
    "/repos/julianhille/MuhammaraJS/commits/b1/pulls": [
      {
        number: 940,
        state: "closed",
        merged_at: "2026-10-02T00:00:00Z",
        title: "Add a thing",
        user: user("Newcomer"),
        body: "Fixes #935\nFixes #936",
      },
    ],
    "/repos/julianhille/MuhammaraJS/commits/c1/pulls": [
      {
        number: 930,
        state: "closed",
        merged_at: "2026-10-01T00:00:00Z",
        title: "Bump something",
        user: user("dependabot[bot]", "Bot"),
        body: null,
      },
    ],
    "/repos/julianhille/MuhammaraJS/commits/d1/pulls": [],
    "/repos/julianhille/MuhammaraJS/commits/e1/pulls": [
      {
        number: 961,
        state: "open",
        merged_at: null,
        title: "Prepare the release",
        user: user("veteran"),
        body: "",
      },
    ],
  };
  var oldestCommits = {
    julianhille: { sha: "0000" },
    Newcomer: { sha: "b1" },
    veteran: { sha: "e0" },
  };

  it("lists pull requests, contributors, and new contributors", async function () {
    var fake = fakeApi(responses, oldestCommits);
    var release = await collectRelease(fake.api, {
      repository: repository,
      prefix: "native-v",
      tag: "native-v7.1.0",
    });
    assert.deepEqual(release, {
      tag: "native-v7.1.0",
      previous: "native-v7.0.0",
      pullRequests: [
        {
          number: 901,
          title: "Keep recryptAsync off the time zone",
          author: "julianhille",
          issues: [896],
        },
        {
          number: 930,
          title: "Bump something",
          author: "dependabot[bot]",
          issues: [],
        },
        {
          number: 940,
          title: "Add a thing",
          author: "Newcomer",
          issues: [935, 936],
        },
        {
          number: 961,
          title: "Prepare the release",
          author: "veteran",
          issues: [],
        },
      ],
      contributors: ["julianhille", "Newcomer", "veteran"],
      newContributors: [{ login: "Newcomer", pullRequest: 940 }],
    });
    assert.deepEqual(
      fake.calls.filter(function (path) {
        return path.includes("author=");
      }),
      [
        "/repos/julianhille/MuhammaraJS/commits?author=julianhille&per_page=100",
        "/repos/julianhille/MuhammaraJS/commits?author=Newcomer&per_page=100",
        "/repos/julianhille/MuhammaraJS/commits?author=veteran&per_page=100",
      ],
    );
  });

  it("returns only the tag when there is no earlier release", async function () {
    var fake = fakeApi(responses, oldestCommits);
    var release = await collectRelease(fake.api, {
      repository: repository,
      prefix: "wasm-v",
      tag: "wasm-v1.0.0-rc.2",
    });
    assert.deepEqual(release, {
      tag: "wasm-v1.0.0-rc.2",
      previous: null,
      pullRequests: [],
      contributors: [],
      newContributors: [],
    });
    assert.equal(fake.calls.length, 1);
  });
});

describe("renderNotes", function () {
  it("renders every section and the compare link", function () {
    var notes = renderNotes({
      repository: repository,
      changelog: "### Added\n\n- Entry",
      release: {
        tag: "native-v7.1.0",
        previous: "native-v7.0.0",
        pullRequests: [
          {
            number: 901,
            title: "Keep going",
            author: "julianhille",
            issues: [896],
          },
          {
            number: 940,
            title: "Add a thing",
            author: "Newcomer",
            issues: [935, 936],
          },
          { number: 955, title: "No author", author: null, issues: [] },
        ],
        contributors: ["julianhille", "Newcomer"],
        newContributors: [
          { login: "Newcomer", pullRequest: 940 },
          { login: "Quiet", pullRequest: null },
        ],
      },
    });
    assert.equal(
      notes,
      [
        "## Changelog",
        "",
        "### Added",
        "",
        "- Entry",
        "",
        "## Pull requests",
        "",
        "- #901 Keep going by @julianhille, closes #896",
        "- #940 Add a thing by @Newcomer, closes #935, #936",
        "- #955 No author",
        "",
        "## Contributors",
        "",
        "@julianhille, @Newcomer",
        "",
        "## New contributors",
        "",
        "- @Newcomer made their first contribution in #940",
        "- @Quiet made their first contribution",
        "",
        "**Full changelog**: https://github.com/julianhille/MuhammaraJS/compare/native-v7.0.0...native-v7.1.0",
        "",
      ].join("\n"),
    );
  });

  it("renders only the changelog for a first release", function () {
    var notes = renderNotes({
      repository: repository,
      changelog: "- Entry",
      release: {
        tag: "wasm-v1.0.0",
        previous: null,
        pullRequests: [],
        contributors: [],
        newContributors: [],
      },
    });
    assert.equal(notes, "## Changelog\n\n- Entry\n");
  });
});

describe("createApi", function () {
  /**
   * Build a fetch stand-in that serves canned pages.
   *
   * @param {Record<string, {status?: number, body: any, link?: string}>} pages responses by URL
   * @returns {{fetch: typeof fetch, requests: {url: string, headers: Record<string, string>}[]}} fetch stand-in and the requests it saw
   */
  function fakeFetch(pages) {
    var requests = [];
    return {
      requests: requests,
      fetch: async function (url, init) {
        requests.push({ url: url, headers: init.headers });
        var page = pages[url];
        assert.ok(page, `Unexpected fetch ${url}`);
        return {
          ok: (page.status || 200) < 400,
          status: page.status || 200,
          headers: {
            get: function (name) {
              return name === "link" ? page.link || null : null;
            },
          },
          json: async function () {
            return page.body;
          },
          text: async function () {
            return JSON.stringify(page.body);
          },
        };
      },
    };
  }

  it("follows pagination links and sends the token", async function () {
    var stub = fakeFetch({
      "https://api.github.com/repos/o/r/tags?per_page=100": {
        body: [{ name: "a" }],
        link: '<https://api.github.com/repos/o/r/tags?per_page=100&page=2>; rel="next", <https://api.github.com/repos/o/r/tags?per_page=100&page=2>; rel="last"',
      },
      "https://api.github.com/repos/o/r/tags?per_page=100&page=2": {
        body: [{ name: "b" }],
        link: '<https://api.github.com/repos/o/r/tags?per_page=100&page=1>; rel="prev"',
      },
    });
    var api = createApi({ token: "secret", fetch: stub.fetch });
    assert.deepEqual(await api.paginate("/repos/o/r/tags?per_page=100"), [
      { name: "a" },
      { name: "b" },
    ]);
    assert.equal(stub.requests.length, 2);
    assert.equal(stub.requests[0].headers.Authorization, "Bearer secret");
  });

  it("jumps to the last page for the oldest item", async function () {
    var stub = fakeFetch({
      "https://api.github.com/repos/o/r/commits?author=x&per_page=100": {
        body: [{ sha: "new" }],
        link: '<https://api.github.com/repos/o/r/commits?author=x&per_page=100&page=2>; rel="next", <https://api.github.com/repos/o/r/commits?author=x&per_page=100&page=9>; rel="last"',
      },
      "https://api.github.com/repos/o/r/commits?author=x&per_page=100&page=9": {
        body: [{ sha: "older" }, { sha: "oldest" }],
      },
      "https://api.github.com/repos/o/r/commits?author=y&per_page=100": {
        body: [],
      },
    });
    var api = createApi({ fetch: stub.fetch });
    assert.deepEqual(
      await api.oldest("/repos/o/r/commits?author=x&per_page=100"),
      {
        sha: "oldest",
      },
    );
    assert.equal(
      await api.oldest("/repos/o/r/commits?author=y&per_page=100"),
      undefined,
    );
    assert.equal(stub.requests.length, 3);
    assert.equal(stub.requests[0].headers.Authorization, undefined);
  });

  it("reports failed requests with their status", async function () {
    var stub = fakeFetch({
      "https://api.github.com/repos/o/r/tags": {
        status: 403,
        body: { message: "nope" },
      },
    });
    var api = createApi({ fetch: stub.fetch });
    await assert.rejects(api.get("/repos/o/r/tags"), /GitHub API 403 .*nope/);
  });
});

describe("parseArguments", function () {
  it("reads the positional arguments and the output option", function () {
    assert.deepEqual(
      parseArguments(["CHANGELOG.md", "native-v", "native-v7.1.0"]),
      {
        changelog: "CHANGELOG.md",
        prefix: "native-v",
        tag: "native-v7.1.0",
        output: null,
      },
    );
    assert.deepEqual(
      parseArguments([
        "--output",
        "notes.md",
        "CHANGELOG.md",
        "wasm-v",
        "wasm-v1.1.0",
      ]),
      {
        changelog: "CHANGELOG.md",
        prefix: "wasm-v",
        tag: "wasm-v1.1.0",
        output: "notes.md",
      },
    );
  });

  it("rejects a missing argument", function () {
    assert.throws(function () {
      parseArguments(["CHANGELOG.md", "native-v"]);
    }, /Usage:/);
    assert.throws(function () {
      parseArguments(["CHANGELOG.md", "native-v", "native-v7.1.0", "--output"]);
    }, /--output needs a file path/);
  });
});
