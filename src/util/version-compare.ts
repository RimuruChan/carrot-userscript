/**
 * Compares version strings that are '.'-separated integers.
 */
export default function compareVersions(version1: string, version2: string): number {
  let s1 = version1.split('.');
  let s2 = version2.split('.');
  for (let i = 0; i < s1.length || i < s2.length; i++) {
    let v1 = Number(s1[i] || 0);
    let v2 = Number(s2[i] || 0);
    if (v1 !== v2) {
      return v1 - v2;
    }
  }
  return 0;
}
