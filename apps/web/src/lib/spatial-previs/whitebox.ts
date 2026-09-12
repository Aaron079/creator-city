import type {
  SpatialAssetSet,
  SpatialPrevisState,
  SpatialSceneReference,
  WhiteboxEntity,
} from './types'

// Fixed editor units make this a stable, editable starting template, not a media-derived scale estimate.
const FLOOR = {
  position: { x: 0, y: -0.05, z: 0 },
  size: { x: 24, y: 0.1, z: 16 },
}
const REFERENCE_PLANE = {
  position: { x: 0, y: 2, z: -4 },
  size: { x: 6, y: 4, z: 0.1 },
}
const VOLUME = {
  position: { x: 0, y: 1.5, z: 1 },
  size: { x: 4, y: 3, z: 4 },
}
const WALL = {
  position: { x: 3, y: 1.5, z: 1 },
  size: { x: 0.2, y: 3, z: 8 },
}
const REFERENCE_OFFSET_X = 8
const SCENE_SET_OFFSET_X = 28

function entity(
  id: string,
  label: string,
  confidence: number,
  kind: WhiteboxEntity['kind'],
  position: WhiteboxEntity['position'],
  size: WhiteboxEntity['size'],
  sourceAssetIds: string[],
): WhiteboxEntity {
  return {
    id,
    label,
    confidence,
    kind,
    position,
    rotationY: 0,
    size,
    sourceAssetIds,
  }
}

function reconstructionConfidence(references: readonly SpatialSceneReference[]) {
  return references.length > 1 || references.some((reference) => reference.mediaType === 'video')
    ? 0.75
    : 0.45
}

function expandedFloor(
  id: string,
  label: string,
  confidence: number,
  sourceAssetIds: string[],
  centerX: number,
  solids: readonly WhiteboxEntity[],
): WhiteboxEntity {
  const minX = Math.min(
    centerX + FLOOR.position.x - FLOOR.size.x / 2,
    ...solids.map((solid) => solid.position.x - solid.size.x / 2),
  )
  const maxX = Math.max(
    centerX + FLOOR.position.x + FLOOR.size.x / 2,
    ...solids.map((solid) => solid.position.x + solid.size.x / 2),
  )
  const minZ = Math.min(
    FLOOR.position.z - FLOOR.size.z / 2,
    ...solids.map((solid) => solid.position.z - solid.size.z / 2),
  )
  const maxZ = Math.max(
    FLOOR.position.z + FLOOR.size.z / 2,
    ...solids.map((solid) => solid.position.z + solid.size.z / 2),
  )

  return entity(id, label, confidence, 'floor', {
    ...FLOOR.position,
    x: (minX + maxX) / 2,
    z: (minZ + maxZ) / 2,
  }, {
    ...FLOOR.size,
    x: maxX - minX,
    z: maxZ - minZ,
  }, [...sourceAssetIds])
}

function legacyWhitebox(references: readonly SpatialSceneReference[]) {
  const confidence = reconstructionConfidence(references)
  const proxies = references.flatMap((reference, index) => {
    const sourceAssetIds = [reference.assetId]
    const x = index * REFERENCE_OFFSET_X
    return [
      entity(
        `reference-plane-${reference.id}-${index}`,
        `reference-plane-${reference.id}-${index}`,
        confidence,
        'referencePlane',
        { ...REFERENCE_PLANE.position, x: REFERENCE_PLANE.position.x + x },
        { ...REFERENCE_PLANE.size },
        sourceAssetIds,
      ),
      entity(
        `volume-${reference.id}-${index}`,
        `volume-${reference.id}-${index}`,
        confidence,
        'volume',
        { ...VOLUME.position, x: VOLUME.position.x + x },
        { ...VOLUME.size },
        sourceAssetIds,
      ),
      entity(
        `wall-${reference.id}-${index}`,
        `wall-${reference.id}-${index}`,
        confidence,
        'wall',
        { ...WALL.position, x: WALL.position.x + x },
        { ...WALL.size },
        sourceAssetIds,
      ),
    ]
  })

  return {
    entities: references.length === 0
      ? []
      : [
          expandedFloor(
            `floor-${references[0]!.id}-0`,
            `floor-${references[0]!.id}-0`,
            confidence,
            [references[0]!.assetId],
            0,
            proxies,
          ),
          ...proxies,
        ],
  }
}

function referencesForSet(
  referencesById: ReadonlyMap<string, SpatialSceneReference>,
  assetSet: SpatialAssetSet,
) {
  return assetSet.referenceIds.map((referenceId) => referencesById.get(referenceId)!)
}

function assertValidAssetSets(
  assetSets: readonly SpatialAssetSet[],
  referencesById: ReadonlyMap<string, SpatialSceneReference>,
) {
  const assetSetIds = new Set<string>()
  for (const assetSet of assetSets) {
    if (assetSetIds.has(assetSet.id)) {
      throw new TypeError(`Duplicate spatial asset set id: ${assetSet.id}`)
    }
    assetSetIds.add(assetSet.id)

    if (assetSet.referenceIds.length === 0) {
      throw new TypeError(`Missing spatial asset set reference ids: ${assetSet.id}`)
    }

    const referenceIds = new Set<string>()
    for (const referenceId of assetSet.referenceIds) {
      if (referenceIds.has(referenceId)) {
        throw new TypeError(`Duplicate spatial asset set reference id: ${assetSet.id}/${referenceId}`)
      }
      if (!referencesById.has(referenceId)) {
        throw new TypeError(`Unknown spatial asset set reference id: ${assetSet.id}/${referenceId}`)
      }
      referenceIds.add(referenceId)
    }
  }
}

function referencePlanes(
  assetSet: SpatialAssetSet,
  references: readonly SpatialSceneReference[],
  confidence: number,
  centerX: number,
) {
  return references.map((reference, index) => entity(
    `reference-plane-${assetSet.id}-${reference.id}`,
    `参考面 ${index + 1}`,
    confidence,
    'referencePlane',
    { ...REFERENCE_PLANE.position, x: centerX + index * REFERENCE_OFFSET_X },
    { ...REFERENCE_PLANE.size },
    [reference.assetId],
  ))
}

function sceneEntities(
  assetSet: SpatialAssetSet,
  references: readonly SpatialSceneReference[],
  setIndex: number,
) {
  const confidence = reconstructionConfidence(references)
  const sourceAssetIds = references.map((reference) => reference.assetId)
  const centerX = setIndex * SCENE_SET_OFFSET_X
  const solids = [
    entity(
      `wall-${assetSet.id}-north`,
      '北侧墙体',
      confidence,
      'wall',
      { x: centerX, y: 1.5, z: -7.9 },
      { x: 24, y: 3, z: 0.2 },
      [...sourceAssetIds],
    ),
    entity(
      `wall-${assetSet.id}-west`,
      '西侧墙体',
      confidence,
      'wall',
      { x: centerX - 11.9, y: 1.5, z: 0 },
      { x: 0.2, y: 3, z: 16 },
      [...sourceAssetIds],
    ),
    entity(
      `wall-${assetSet.id}-east`,
      '东侧墙体',
      confidence,
      'wall',
      { x: centerX + 11.9, y: 1.5, z: 0 },
      { x: 0.2, y: 3, z: 16 },
      [...sourceAssetIds],
    ),
    entity(
      `opening-${assetSet.id}`,
      '开口',
      confidence,
      'opening',
      { x: centerX - 4, y: 1.2, z: -7.75 },
      { x: 2, y: 2.4, z: 0.1 },
      [...sourceAssetIds],
    ),
    entity(
      `furniture-${assetSet.id}`,
      '家具体块',
      confidence,
      'furniture',
      { x: centerX, y: 0.5, z: 1 },
      { x: 2, y: 1, z: 1 },
      [...sourceAssetIds],
    ),
    ...referencePlanes(assetSet, references, confidence, centerX),
  ]

  return [
    expandedFloor(
      `floor-${assetSet.id}`,
      '地面',
      confidence,
      sourceAssetIds,
      centerX,
      solids,
    ),
    ...solids,
  ]
}

export function buildWhiteboxDraft(
  references: readonly SpatialSceneReference[],
  assetSets?: readonly SpatialAssetSet[],
) {
  if (assetSets === undefined) return legacyWhitebox(references)

  const referencesById = new Map(references.map((reference) => [reference.id, reference]))
  assertValidAssetSets(assetSets, referencesById)
  const entities = assetSets.flatMap((assetSet, setIndex) => {
    const selectedReferences = referencesForSet(referencesById, assetSet)
    if (assetSet.role === 'character') return []

    const confidence = reconstructionConfidence(selectedReferences)
    if (assetSet.role === 'reference') {
      return referencePlanes(assetSet, selectedReferences, confidence, setIndex * SCENE_SET_OFFSET_X)
    }
    if (assetSet.role === 'prop') {
      return [entity(
        `prop-${assetSet.id}`,
        '道具体块',
        confidence,
        'prop',
        { x: setIndex * SCENE_SET_OFFSET_X, y: 0.5, z: 1 },
        { x: 1, y: 1, z: 1 },
        selectedReferences.map((reference) => reference.assetId),
      )]
    }
    return sceneEntities(assetSet, selectedReferences, setIndex)
  })

  return { entities }
}

function isManualWhiteboxEntity(entity: WhiteboxEntity) {
  return entity.sourceAssetIds.length === 1 && entity.sourceAssetIds[0] === 'manual'
}

export function retainManualWhiteboxEntities(
  state: SpatialPrevisState,
  generated: { entities: WhiteboxEntity[] },
) {
  const manualEntities = state.scene.whitebox.entities
    .filter(isManualWhiteboxEntity)
    .map((entity) => ({
      ...entity,
      position: { ...entity.position },
      size: { ...entity.size },
      sourceAssetIds: [...entity.sourceAssetIds],
    }))
  const edited = new Set(state.studio?.calibration.editedEntityIds ?? [])
  return { entities: [...generated.entities.map(entity => {
    const previous = edited.has(entity.id) ? state.scene.whitebox.entities.find(item => item.id === entity.id) : null
    return previous ? { ...entity, position: { ...previous.position }, rotationY: previous.rotationY, size: { ...previous.size } } : entity
  }), ...manualEntities] }
}

export function replaceWhiteboxDraft(
  state: SpatialPrevisState,
  references: SpatialSceneReference[],
): SpatialPrevisState {
  const nextReferences = references.map((reference) => ({ ...reference }))
  const nextReferenceIds = new Set(nextReferences.map((reference) => reference.id))
  const nextAssetSets = state.scene.assetSets.flatMap((assetSet) => {
    const referenceIds = assetSet.referenceIds.filter((referenceId) => nextReferenceIds.has(referenceId))
    return referenceIds.length > 0 ? [{ ...assetSet, referenceIds }] : []
  })

  const generated = state.scene.assetSets.length === 0
    ? buildWhiteboxDraft(nextReferences)
    : buildWhiteboxDraft(nextReferences, nextAssetSets)

  return {
    ...state,
    scene: {
      ...state.scene,
      references: nextReferences,
      assetSets: nextAssetSets,
      whitebox: retainManualWhiteboxEntities(state, generated),
    },
  }
}
