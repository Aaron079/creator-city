import moduleBuiltin from 'module'
import { join } from 'path'

type ResolveFilename = (request: string, parent: unknown, isMain: boolean, options?: unknown) => string

const resolver = moduleBuiltin as unknown as {
  _resolveFilename: ResolveFilename
  __creatorCityWebAliasPatched?: boolean
}

export function registerWebAlias() {
  if (resolver.__creatorCityWebAliasPatched) return
  const originalResolve = resolver._resolveFilename
  resolver._resolveFilename = function resolveCreatorCityAlias(request, parent, isMain, options) {
    if (request.startsWith('@/')) {
      const mapped = join(process.cwd(), 'apps/web/src', request.slice(2))
      return originalResolve.call(this, mapped, parent, isMain, options)
    }
    return originalResolve.call(this, request, parent, isMain, options)
  } as ResolveFilename
  resolver.__creatorCityWebAliasPatched = true
}
