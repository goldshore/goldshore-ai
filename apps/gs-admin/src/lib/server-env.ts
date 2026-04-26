export function getServerEnv(locals: any) {
  return locals.runtime?.env || process.env;
}
