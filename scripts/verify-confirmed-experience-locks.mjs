import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const defaultRegistryPath = 'docs/CONFIRMED_EXPERIENCE_LOCKS.json'

export function validateRegistry(registry) {
  const errors = []
  if (registry?.version !== 1) errors.push('Registry version must equal 1.')
  if (!Array.isArray(registry?.locks) || registry.locks.length === 0) {
    errors.push('Registry must include at least one lock.')
    return errors
  }

  const ids = new Set()
  for (const lock of registry.locks) {
    const id = typeof lock?.id === 'string' ? lock.id.trim() : ''
    if (!id) {
      errors.push('Lock is missing id.')
      continue
    }
    if (ids.has(id)) errors.push(`Duplicate lock id: ${id}`)
    ids.add(id)
    if (!Array.isArray(lock.owners) || lock.owners.length === 0) {
      errors.push(`${id}: owners required.`)
    }
    if (!Array.isArray(lock.checks) || lock.checks.length === 0) {
      errors.push(`${id}: checks required.`)
    }
  }
  return errors
}

function pathIsWithinRoot(root, filePath) {
  const relativePath = relative(root, resolve(root, filePath))
  return relativePath !== '..' && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath)
}

export function verifyRegistry({ root = repositoryRoot, registryPath = defaultRegistryPath } = {}) {
  const resolvedRoot = resolve(root)
  const resolvedRegistryPath = isAbsolute(registryPath)
    ? registryPath
    : resolve(resolvedRoot, registryPath)
  let registry

  try {
    registry = JSON.parse(readFileSync(resolvedRegistryPath, 'utf8'))
  } catch (error) {
    return [`Unable to read registry: ${error.message}`]
  }

  const errors = validateRegistry(registry)
  if (errors.length > 0) return errors

  for (const lock of registry.locks) {
    for (const [kind, paths] of [['owner', lock.owners], ['check', lock.checks]]) {
      for (const filePath of paths) {
        if (typeof filePath !== 'string' || isAbsolute(filePath) || !pathIsWithinRoot(resolvedRoot, filePath)) {
          errors.push(`${lock.id}: path escapes repository root: ${filePath}`)
        } else if (!existsSync(resolve(resolvedRoot, filePath))) {
          errors.push(`${lock.id}: missing ${kind} file: ${filePath}`)
        }
      }
    }
  }
  return errors
}

function parseArguments(argumentsList) {
  const options = { root: repositoryRoot, registryPath: defaultRegistryPath }
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index]
    if (argument === '--root') {
      const value = argumentsList[index + 1]
      if (!value || value.startsWith('--')) return { error: 'Missing value for --root.' }
      options.root = value
      index += 1
    } else if (argument === '--registry') {
      const value = argumentsList[index + 1]
      if (!value || value.startsWith('--')) return { error: 'Missing value for --registry.' }
      options.registryPath = value
      index += 1
    } else {
      return { error: `Unknown argument: ${argument}` }
    }
  }
  return options
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const options = parseArguments(process.argv.slice(2))
  const errors = options.error ? [options.error] : verifyRegistry(options)
  if (errors.length > 0) {
    for (const error of errors) console.error(`[ERROR] ${error}`)
    process.exitCode = 1
  } else {
    const registry = JSON.parse(readFileSync(
      isAbsolute(options.registryPath)
        ? options.registryPath
        : resolve(options.root, options.registryPath),
      'utf8',
    ))
    console.log(`[OK] Confirmed experience locks: ${registry.locks.length}`)
  }
}
