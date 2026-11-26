// Prints the version to release, for $GITHUB_OUTPUT: the newest of the git tags and package.json's version, bumped by
// the commits since the newest tag. Commit subjects start with a gitmoji: 💥 (or BREAKING) is a major change, ✨ or 🎉
// a new feature (minor), anything else a patch. With no new commits it prints the newest tag again and new=false.
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const parse = (version) => /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version)?.slice(1).map(Number) ?? null;
const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

export function bump([major, minor, patch], subjects) {
  if (subjects.some((s) => s.startsWith('💥') || s.includes('BREAKING'))) return [major + 1, 0, 0];
  if (subjects.some((s) => s.startsWith('✨') || s.startsWith('🎉'))) return [major, minor + 1, 0];
  return [major, minor, patch + 1];
}

/** tags: every git tag; pkg: package.json's version; subjectsSince(tag): commit subjects after tag (all if null) */
export function nextVersion(tags, pkg, subjectsSince) {
  const newestTag = tags.filter(parse).sort((a, b) => compare(parse(b), parse(a)))[0] ?? null;
  const subjects = subjectsSince(newestTag);
  if (newestTag && !subjects.length) return { version: newestTag, isNew: false };
  const base = [newestTag && parse(newestTag), parse(pkg) ?? [0, 0, 0]].filter(Boolean).sort((a, b) => compare(b, a))[0];
  return { version: bump(base, subjects).join('.'), isNew: true };
}

if (process.argv[1]?.endsWith('next-version.mjs')) {
  const git = (args) => execSync(`git ${args}`, { encoding: 'utf8' }).trim();
  const lines = (text) => text.split('\n').filter(Boolean);
  const { version, isNew } = nextVersion(
    lines(git('tag --list')),
    JSON.parse(fs.readFileSync('package.json', 'utf8')).version,
    (tag) => lines(git(`log --format=%s ${tag ? `${tag}..HEAD` : 'HEAD'}`))
  );
  console.log(`version=${version}\nnew=${isNew}`);
}
