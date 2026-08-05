import assert from "node:assert/strict";
import test from "node:test";

import {
  cloneCreativeKnowledgePack,
  isEligibleCreativeKnowledgeRecord,
  validateCreativeKnowledgeRecord,
} from "./validation";

function validRecord(overrides: Record<string, unknown> = {}) {
  return {
    knowledgeId: "script.beat-sheet.001",
    schemaVersion: 1,
    domain: "script",
    kind: "template",
    title: "Beat sheet",
    content: {
      beats: ["opening image", { name: "catalyst" }],
    },
    evidence: [
      {
        sourceRef: "creator-notes-001",
        excerpt: "A strong catalyst changes the story direction.",
        locator: "p. 12",
      },
    ],
    provenance: {
      sourceType: "creator-owned",
      sourceId: "creator-library",
      collectedAt: "2026-06-24T12:00:00.000Z",
      licenseStatus: "verified",
      allowedUses: ["retrieval", "evaluation"],
    },
    review: {
      status: "approved",
      reviewedAt: "2026-06-24T13:00:00.000Z",
      reviewerId: "reviewer-001",
    },
    revision: "1",
    contentHash: "sha256:example",
    ...overrides,
  };
}

test("valid approved verified record clone is immune to source mutation", () => {
  const source = validRecord();
  const result = validateCreativeKnowledgeRecord(source);

  (source.content.beats as unknown[])[1] = { name: "changed" };
  source.provenance.allowedUses.push("training");

  assert.deepEqual(result.content, {
    beats: ["opening image", { name: "catalyst" }],
  });
  assert.deepEqual(result.provenance.allowedUses, ["retrieval", "evaluation"]);
  assert(Object.isFrozen(result));
  assert(Object.isFrozen(result.content));
  assert(Object.isFrozen(result.provenance.allowedUses));
});

test("returned nested content cannot be mutated", () => {
  const result = validateCreativeKnowledgeRecord(validRecord());
  const content = result.content as { beats: Array<string | { name: string }> };

  assert.throws(() => {
    (content.beats[1] as { name: string }).name = "changed";
  });
  assert.deepEqual(result.content, {
    beats: ["opening image", { name: "catalyst" }],
  });
});

test("aliased content objects are independently cloned and isolated from the caller", () => {
  const shared = { name: "catalyst" };
  const result = validateCreativeKnowledgeRecord(
    validRecord({ content: { left: shared, right: shared } }),
  );
  const content = result.content as { left: { name: string }; right: { name: string } };

  shared.name = "changed";
  assert.notStrictEqual(content.left, content.right);
  assert.deepEqual(content, {
    left: { name: "catalyst" },
    right: { name: "catalyst" },
  });
});

test("hostile Proxy failures are normalized to TypeError", () => {
  const hostile = new Proxy(validRecord(), {
    ownKeys: () => {
      throw new Error("hostile");
    },
  });

  assert.throws(() => validateCreativeKnowledgeRecord(hostile), TypeError);
});

test("valid revoked and disabled records are accepted but ineligible for retrieval", () => {
  const revoked = validateCreativeKnowledgeRecord(
    validRecord({
      provenance: {
        ...validRecord().provenance,
        licenseStatus: "revoked",
      },
    }),
  );
  const disabled = validateCreativeKnowledgeRecord(
    validRecord({
      review: {
        ...validRecord().review,
        status: "disabled",
      },
    }),
  );

  assert.equal(revoked.provenance.licenseStatus, "revoked");
  assert.equal(disabled.review.status, "disabled");
  assert.equal(isEligibleCreativeKnowledgeRecord(revoked, "retrieval"), false);
  assert.equal(isEligibleCreativeKnowledgeRecord(disabled, "retrieval"), false);
});

test("empty allowedUses is rejected", () => {
  assert.throws(() =>
    validateCreativeKnowledgeRecord(
      validRecord({
        provenance: {
          ...validRecord().provenance,
          allowedUses: [],
        },
      }),
    ),
  );
});

test("optional evidence text may be absent but not explicitly undefined", () => {
  const accepted = validateCreativeKnowledgeRecord(
    validRecord({ evidence: [{ sourceRef: "creator-notes-001" }] }),
  );
  assert.deepEqual(accepted.evidence, [{ sourceRef: "creator-notes-001" }]);

  assert.throws(() =>
    validateCreativeKnowledgeRecord(
      validRecord({ evidence: [{ sourceRef: "creator-notes-001", excerpt: undefined }] }),
    ),
  );
  assert.throws(() =>
    validateCreativeKnowledgeRecord(
      validRecord({ evidence: [{ sourceRef: "creator-notes-001", locator: undefined }] }),
    ),
  );
});

test("evidence accessor and symbol keys are rejected", () => {
  const accessorEvidence = { sourceRef: "creator-notes-001" };
  Object.defineProperty(accessorEvidence, "excerpt", {
    enumerable: true,
    get: () => "A getter is not accepted",
  });
  assert.throws(() => validateCreativeKnowledgeRecord(validRecord({ evidence: [accessorEvidence] })));

  const symbolEvidence = { sourceRef: "creator-notes-001" };
  Object.defineProperty(symbolEvidence, Symbol("evidence"), { enumerable: true, value: "nope" });
  assert.throws(() => validateCreativeKnowledgeRecord(validRecord({ evidence: [symbolEvidence] })));
});

test("sparse and extended allowedUses arrays are rejected", () => {
  const sparse = ["retrieval"];
  sparse.length = 2;
  assert.throws(() =>
    validateCreativeKnowledgeRecord(
      validRecord({ provenance: { ...validRecord().provenance, allowedUses: sparse } }),
    ),
  );

  const extended = ["retrieval"];
  Object.defineProperty(extended, "extra", { enumerable: true, value: true });
  assert.throws(() =>
    validateCreativeKnowledgeRecord(
      validRecord({ provenance: { ...validRecord().provenance, allowedUses: extended } }),
    ),
  );
});

test("cyclic and non-finite content is rejected", () => {
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  assert.throws(() => validateCreativeKnowledgeRecord(validRecord({ content: cyclic })));
  assert.throws(() => validateCreativeKnowledgeRecord(validRecord({ content: { score: Number.NaN } })));
});

test("duplicate record ids are rejected by clone pack", () => {
  assert.throws(() =>
    cloneCreativeKnowledgePack({
      packId: "creative-foundations",
      revision: "1",
      records: [validRecord(), validRecord()],
    }),
  );
});
