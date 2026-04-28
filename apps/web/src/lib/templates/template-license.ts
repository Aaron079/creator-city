import {
  ORIGINAL_TEMPLATE_LICENSE,
  PEXELS_TEMPLATE_LICENSE,
  PIXABAY_TEMPLATE_LICENSE,
  REFERENCE_ONLY_TEMPLATE_LICENSE,
  type PublicTemplateLicense,
  type PublicTemplateLicenseType,
} from './template-workflow'

export {
  ORIGINAL_TEMPLATE_LICENSE,
  PEXELS_TEMPLATE_LICENSE,
  PIXABAY_TEMPLATE_LICENSE,
  REFERENCE_ONLY_TEMPLATE_LICENSE,
}

export function getTemplateLicenseLabel(type: PublicTemplateLicenseType | string | undefined) {
  if (type === 'pexels') return PEXELS_TEMPLATE_LICENSE.label
  if (type === 'pixabay') return PIXABAY_TEMPLATE_LICENSE.label
  if (type === 'original') return ORIGINAL_TEMPLATE_LICENSE.label
  if (type === 'reference-only') return REFERENCE_ONLY_TEMPLATE_LICENSE.label
  if (type === 'public-domain') return 'Public domain'
  if (type === 'cc0') return 'CC0'
  if (type === 'cc-by') return 'CC BY'
  return 'Needs review'
}

export function getTemplateUsageNote(license: PublicTemplateLicense) {
  return license.usageNote
}
