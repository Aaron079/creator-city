import type { CreatorModelRequest, CreatorModelResponse } from './types'
import { runLocalCreatorModel } from './local-model'
import { callRemoteCreatorModel } from './remote-client'

export async function runCreatorModel(
  request: CreatorModelRequest,
): Promise<CreatorModelResponse> {
  const mode = process.env.CREATOR_MODEL_MODE || 'local'
  const endpoint = process.env.CREATOR_MODEL_ENDPOINT

  if (mode === 'remote' && endpoint) {
    const result = await callRemoteCreatorModel(request)
    if (result.mode === 'error') {
      return result
    }
    return result
  }

  return runLocalCreatorModel(request)
}
