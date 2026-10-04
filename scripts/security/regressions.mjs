import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";

export function checkBraces(braces) {
  for (const [open, close] of [
    ["{", "}"],
    ["(", ")"],
  ]) {
    for (const method of ["parse", "compile", "expand", "stringify"]) {
      const pattern = (depth) => open.repeat(depth) + "a" + close.repeat(depth);
      assert.doesNotThrow(() => braces[method](pattern(100)));
      for (const depth of [101, 1000, 4000]) {
        assert.throws(() => braces[method](pattern(depth)), {
          name: "SyntaxError",
          message: /exceeds max depth/,
        });
      }
      assert.throws(
        () => braces[method](pattern(101), { maxDepth: Infinity }),
        /exceeds max depth/,
      );
      assert.throws(
        () => braces[method](pattern(101), { maxDepth: 10000 }),
        /exceeds max depth/,
      );
      assert.doesNotThrow(() => braces[method](pattern(1), { maxDepth: 1.5 }));
      assert.throws(
        () => braces[method](pattern(2), { maxDepth: 1.5 }),
        /exceeds max depth/,
      );
      assert.throws(
        () => braces[method](pattern(1), { maxDepth: 0 }),
        /exceeds max depth/,
      );
    }
  }
  assert.throws(
    () => braces.compile("{".repeat(51) + "(".repeat(50) + "a"),
    /exceeds max depth/,
  );
  // The public methods also accept ASTs, which bypass the string parser.
  for (const method of ["compile", "expand", "stringify"]) {
    let ast = { type: "text", value: "a" };
    for (let index = 0; index < 4000; index++)
      ast = { type: "brace", nodes: [ast] };
    ast = { type: "root", nodes: [ast] };
    assert.throws(() => braces[method](ast), {
      name: "RangeError",
      message: /exceeds max depth/,
    });
  }
  const cyclic = { type: "paren", nodes: [{ type: "text", value: "a" }] };
  cyclic.parent = cyclic;
  // Bound this check so a missing cycle guard fails rather than hanging CI.
  assert.throws(
    () =>
      runInNewContext(
        "braces.expand(ast)",
        { braces, ast: cyclic },
        { timeout: 250 },
      ),
    /parent chain contains a cycle/,
  );
  assert.deepEqual(braces.expand("docs/{install,usage}/*.{md,mdx}"), [
    "docs/install/*.md",
    "docs/install/*.mdx",
    "docs/usage/*.md",
    "docs/usage/*.mdx",
  ]);
  assert.deepEqual(braces.expand("foo/({a,b})"), ["foo/(a)", "foo/(b)"]);
  for (const pattern of [
    "{{a}}",
    "{a,{b}}",
    "{{x}y}",
    "{a,{b,{c}}",
    "{}{a}",
    "{1..8}",
  ]) {
    assert.equal(braces.stringify(pattern, { escapeInvalid: true }), pattern);
  }
  // Escaped, quoted and bracketed braces are literals, not nesting.
  for (const pattern of [
    "\\{".repeat(101),
    '"' + "{".repeat(101) + '"',
    "[" + "{".repeat(101) + "]",
  ]) {
    assert.doesNotThrow(() => braces.compile(pattern));
  }
}

export function checkCache(CachePolicy) {
  const request = {
    url: "https://example.test/private",
    method: "GET",
    headers: { host: "example.test" },
  };
  const response = (headers) => ({ status: 200, headers });
  const staleRequest = (value) => ({
    ...request,
    headers: { ...request.headers, "cache-control": value },
  });
  const blocked = [
    { "cache-control": "max-age=3600", "set-cookie": "session=secret" },
    { "cache-control": "proxy-revalidate, max-age=3600" },
    { "cache-control": "no-cache, max-age=3600" },
    { "cache-control": "no-store, max-age=3600" },
    { "cache-control": "private, max-age=3600" },
    { "cache-control": "max-age=3600", vary: "*" },
  ];
  for (const headers of blocked) {
    const policy = new CachePolicy(request, response(headers));
    // Policies can be serialized into persistent/shared cache storage.
    for (const cached of [policy, CachePolicy.fromObject(policy.toObject())]) {
      for (const directive of ["max-stale", "max-stale=999999"]) {
        assert.equal(
          cached.satisfiesWithoutRevalidation(staleRequest(directive)),
          false,
          JSON.stringify(headers),
        );
        const decision = cached.evaluateRequest(staleRequest(directive));
        assert.equal(decision.response, undefined);
        assert.equal(decision.revalidation.synchronous, true);
      }
    }
    const stale = new CachePolicy(
      request,
      response({
        ...headers,
        "cache-control":
          headers["cache-control"] +
          ", stale-while-revalidate=3600, stale-if-error=3600",
      }),
    );
    assert.equal(stale.useStaleWhileRevalidate(), false);
    assert.equal(
      stale.revalidatedPolicy(request, { status: 500, headers: {} }).modified,
      true,
    );
  }
  const publicPolicy = new CachePolicy(
    request,
    response({
      "cache-control": "public, max-age=3600",
      "set-cookie": "explicit=public",
    }),
  );
  assert.equal(publicPolicy.satisfiesWithoutRevalidation(request), true);
  const privatePolicy = new CachePolicy(
    request,
    response({
      "cache-control": "private, max-age=3600",
      "set-cookie": "session=private",
    }),
    { shared: false },
  );
  assert.equal(privatePolicy.satisfiesWithoutRevalidation(request), true);
  const ordinaryStale = new CachePolicy(
    request,
    response({ "cache-control": "public, max-age=1", age: "10" }),
  );
  assert.equal(
    ordinaryStale.satisfiesWithoutRevalidation(staleRequest("max-stale=20")),
    true,
  );
  assert.equal(
    ordinaryStale.satisfiesWithoutRevalidation(staleRequest("max-stale=1")),
    false,
  );
}
