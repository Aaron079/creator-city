import assert from "node:assert/strict";
import test from "node:test";

import { LOCAL_CINEMATIC_KNOWLEDGE_PACK } from "./local-cinematic-pack";
import type { CreativeKnowledgeDomain } from "./types";
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

  try {
    (content.beats[1] as { name: string }).name = "changed";
  } catch {
    // Frozen objects throw in strict mode and ignore writes otherwise.
  }
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

const REQUIRED_CINEMATIC_RULES = {
  "script-scene-objective": {
    domain: "script",
    guidance: "每场明确目标、阻力与变化",
  },
  "cinematic-screen-direction": {
    domain: "cinematography",
    guidance: "连续动作保持屏幕方向，换轴必须可见地建立。",
  },
  "composition-subject-hierarchy": {
    domain: "composition",
    guidance: "一个镜头优先服务一个可读的视觉主体层级。",
  },
  "lighting-motivation": {
    domain: "lighting",
    guidance: "关键光源应有叙事或空间动机，无法确认时标记待审核。",
  },
  "continuity-action-match": {
    domain: "continuity",
    guidance: "跨镜头动作续接需要可验证的起止状态。",
  },
  "continuity-eyeline": {
    domain: "continuity",
    guidance: "对话镜头的视线方向应与空间关系一致。",
  },
} as const satisfies Record<string, { domain: CreativeKnowledgeDomain; guidance: string }>;

function expectedContentHash(ruleId: string, guidance: string): string {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(`${ruleId}\n${guidance}`)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return `ckh1_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

test("local cinematic knowledge pack contains the reviewed creator-owned rules", () => {
  assert.equal(LOCAL_CINEMATIC_KNOWLEDGE_PACK.packId, "creator-city-cinematic-core");
  assert.equal(LOCAL_CINEMATIC_KNOWLEDGE_PACK.revision, "1.0.0");
  assert.equal(LOCAL_CINEMATIC_KNOWLEDGE_PACK.records.length, 6);

  const domains = new Set(LOCAL_CINEMATIC_KNOWLEDGE_PACK.records.map((record) => record.domain));
  const requiredDomains: readonly CreativeKnowledgeDomain[] = [
    "script",
    "cinematography",
    "lighting",
    "composition",
    "continuity",
  ];
  for (const domain of requiredDomains) {
    assert(domains.has(domain));
  }

  const expectedRuleIds = Object.keys(REQUIRED_CINEMATIC_RULES);
  assert.deepEqual(
    LOCAL_CINEMATIC_KNOWLEDGE_PACK.records.map((record) => record.knowledgeId),
    expectedRuleIds,
  );

  const recordIds = new Set<string>();
  const contentHashes = new Set<string>();
  for (const record of LOCAL_CINEMATIC_KNOWLEDGE_PACK.records) {
    const expected = REQUIRED_CINEMATIC_RULES[record.knowledgeId as keyof typeof REQUIRED_CINEMATIC_RULES];
    assert(expected);
    assert.equal(record.domain, expected.domain);
    assert.equal(record.provenance.sourceType, "creator-owned");
    assert.equal(record.provenance.sourceId, "creator-city:cinematic-core-editorial-v1");
    assert.equal(record.provenance.licenseStatus, "verified");
    assert.deepEqual(record.provenance.allowedUses, ["retrieval", "rule-authoring", "evaluation"]);
    assert.equal(record.review.status, "approved");
    assert.equal(record.review.reviewerId, "creator-city-editorial");
    assert.equal(record.revision, "1");
    assert.deepEqual(record.evidence, [
      { sourceRef: "creator-city:cinematic-core-editorial-v1" },
    ]);
    assert.deepEqual(Object.keys(record.content), ["ruleId", "guidance"]);
    assert.deepEqual(record.content, { ruleId: record.knowledgeId, guidance: expected.guidance });
    assert.match(record.contentHash, /^ckh1_/);
    assert.equal(record.contentHash, expectedContentHash(record.knowledgeId, expected.guidance));
    assert.notEqual(record.contentHash, `ckh1_${record.knowledgeId}`);
    assert.equal(recordIds.has(record.knowledgeId), false);
    recordIds.add(record.knowledgeId);
    contentHashes.add(record.contentHash);
  }
  assert.equal(recordIds.size, expectedRuleIds.length);
  assert.equal(contentHashes.size, LOCAL_CINEMATIC_KNOWLEDGE_PACK.records.length);
});
