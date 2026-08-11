export function applyXpDelta(game, delta) {
  const xpToNext = Math.max(1, Number(game.xpToNext) || 1000);
  const level = Math.max(1, Number(game.level) || 1);
  const xp = Math.max(0, Number(game.xp) || 0);
  const lifetimeXp = Math.max(0, (level - 1) * xpToNext + xp + Number(delta || 0));

  return {
    ...game,
    level: Math.floor(lifetimeXp / xpToNext) + 1,
    xp: lifetimeXp % xpToNext,
    xpToNext
  };
}
