/**
 * Мектептер аралык лиганын эсеби.
 *  - Турдагы мектептин упайы: эң мыкты topN катышуучунун упайларынын суммасы (аз катышса — аз упай,
 *    ошондуктан мектептер көбүрөөк студентти тартууга кызыкдар).
 *  - Турдагы орун боюнча лиганын упайы: 1-орун 10, 2-орун 8, 3-орун 6, 4 → 5, 5 → 4, 6 → 3, 7 → 2, андан ары 1.
 *    Катышпаган мектеп ошол турдан 0 алат. Упайы бирдей мектептер бир орунду бөлүшөт.
 *  - Лиганын таблицасы: упайлардын суммасы, андан кийин турлардагы упайлардын жалпы суммасы.
 */

export const ROUND_POINTS = [10, 8, 6, 5, 4, 3, 2];
export const pointsForPlace = (place: number) => ROUND_POINTS[place - 1] ?? 1;

export function leagueSchools(league: { schools: string }): string[] {
  try {
    const list = JSON.parse(league.schools);
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

interface Sub {
  name: string;
  school: string;
  score: number;
  answers: string;
  finishedAt: Date | null;
}

interface Round {
  id: number;
  code: string;
  title: string;
  active: boolean;
  closesAt: Date | null;
  createdAt: Date;
  _count: { questions: number };
  submissions: Sub[];
}

const durationOf = (s: Sub) => {
  try {
    return (JSON.parse(s.answers) as { ms: number }[]).reduce((n, a) => n + (a.ms ?? 0), 0);
  } catch {
    return 0;
  }
};

export function computeLeague(league: { schools: string; topN: number }, rounds: Round[]) {
  const listed = leagueSchools(league);
  const all = [...new Set([...listed, ...rounds.flatMap((r) => r.submissions.map((s) => s.school).filter(Boolean))])];
  const totals = new Map(all.map((school) => [school, { school, points: 0, score: 0, rounds: 0, participants: 0 }]));
  const players = new Map<string, { name: string; school: string; score: number; rounds: number; durationMs: number }>();

  const roundViews = [...rounds]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((r, i) => {
      const done = r.submissions.filter((s) => s.finishedAt && s.school);
      for (const s of done) {
        const key = `${s.school}\n${s.name.toLocaleLowerCase('ky')}`;
        const p = players.get(key) ?? { name: s.name, school: s.school, score: 0, rounds: 0, durationMs: 0 };
        p.score += s.score;
        p.rounds++;
        p.durationMs += durationOf(s);
        players.set(key, p);
      }
      const schools = all
        .map((school) => {
          const mine = done.filter((s) => s.school === school).sort((a, b) => b.score - a.score || durationOf(a) - durationOf(b));
          return { school, participants: mine.length, score: mine.slice(0, league.topN).reduce((n, s) => n + s.score, 0), place: 0, points: 0 };
        })
        .sort((a, b) => b.score - a.score || b.participants - a.participants || a.school.localeCompare(b.school, 'ky'));
      let place = 0;
      schools.forEach((s, k) => {
        if (!s.participants) return;
        if (k === 0 || s.score !== schools[k - 1].score) place = k + 1;
        s.place = place;
        s.points = pointsForPlace(place);
        const t = totals.get(s.school)!;
        t.points += s.points;
        t.score += s.score;
        t.rounds++;
        t.participants += s.participants;
      });
      return {
        id: r.id,
        number: i + 1,
        code: r.code,
        title: r.title,
        open: r.active && (!r.closesAt || r.closesAt > new Date()),
        closesAt: r.closesAt,
        questions: r._count.questions,
        participants: done.length,
        schools,
      };
    });

  const standings = [...totals.values()].sort((a, b) => b.points - a.points || b.score - a.score || a.school.localeCompare(b.school, 'ky'));
  const ranked = standings.map((s) => ({ ...s, place: 0, listed: listed.includes(s.school) }));
  ranked.forEach((s, k) => (s.place = k > 0 && s.points === ranked[k - 1].points && s.score === ranked[k - 1].score ? ranked[k - 1].place : k + 1));

  const topPlayers = [...players.values()]
    .sort((a, b) => b.score - a.score || a.durationMs - b.durationMs || a.name.localeCompare(b.name, 'ky'))
    .slice(0, 10)
    .map(({ durationMs: _d, ...p }) => p);

  return { schools: listed, rounds: roundViews, standings: ranked, topPlayers };
}
