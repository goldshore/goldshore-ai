export const formConfigs: Record<string, any> = {};
export function getFormConfig(slug: string) {
  return formConfigs[slug];
}
export const forms = [];