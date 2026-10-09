# Тапкыч ордо — долбоор боюнча эскертмелер

«Акыл ордо» форматындагы интеллектуалдык оюн платформасы (окуу жайлары жана студенттер үчүн).
Колдонуучуга толук маалымат `README.md` файлында, ал эми бул файл долбоорду иштеп чыгуучу үчүн.

## Негизги эрежелер

- **Колдонуучу менен кыргызча сүйлөшүңүз.** Интерфейс эки тилде: КЫР (негизги) жана РУС.
- **Бардык UI тексттери** `client/src/i18n/ky.ts` файлында. Орусча котормосу `ru.ts`'те, ал `Ky` тибинде болгондуктан, ky.ts'ке кошулган ар бир ачкычты ru.ts'ке да кошуу керек, болбосо `tsc` ката берет. Компоненттерде текстти түз жазбаңыз.
- **Терминдер:** катышуучуларды **«студент / студенттер»** деп атаңыз («окуучу» деген сөздү колдонбоңуз), алардын тобун **«топ»** деп («класс» эмес), ал эми мекемени **«окуу жайы»** деп атаңыз («мектеп» эмес). Орусчасы: «студент», «группа», «учебное заведение».
- **Ариптер:** Montserrat (баш аттар) жана Inter. Ө/Ү/Ң тамгаларын колдобогон арипти тандабаңыз (ушул себептен Unbounded алынып салынган).
- **Сервер гана чечет:** жоопту текшерүү, таймер жана упайды сервер гана эсептейт. Туура жооп REVEAL фазасына чейин эч бир клиентке жөнөтүлбөйт.
- **Коопсуздук:** оюнга ар бир оюнчу өзүнүн PIN коду менен гана кирет. Ачык добуш берүү `/watch/КОД` аркылуу гана болот жана упайга таасир этпейт.
- Коммит билдирүүлөрү кыргызча жазылат.

## Оюндун форматы

- 12 оюнчу → **1-тур** (10 суроо, 15 сек) → 6 оюнчу **2-турга** өтөт (10 суроо) → 3 оюнчу **финалга** өтөт (демейки боюнча 5 суроо).
- Ар бир турда упай нөлдөн башталат. Упай тең болсо, жоопко аз убакыт короткон оюнчу жогору турат.
- Тур бүткөндөн кийин алып баруучу өткөн оюнчуларды ырастайт жана керек болсо оңдойт.
- Абал машинасы: `LOBBY → ROUND1 → ROUND2 → FINAL → FINISHED`. Ар бир турдун фазалары: `IDLE / READY / QUESTION / REVEAL / ROUND_END`.

## Технологиялар

| Бөлүк | Стек |
|---|---|
| server | Node 22+ (жергиликтүү 24), Express 5, Socket.IO 4.8, Prisma 6.19 + `@prisma/adapter-libsql`, ExcelJS, zod, JWT, scrypt |
| client | React 19, Vite 8, Tailwind 4 (`@theme` токендери `index.css`'те), framer-motion, react-router 7, dnd-kit, qrcode.react, canvas-confetti |
| база | Жергиликтүү: SQLite (`server/dev.db`). Продакшн: Turso (libSQL) |

## Түзүлүшү

```
render.yaml            Render Blueprint (бир сервис: API + сайт)
ИШТЕТҮҮ.bat            Windows үчүн бир баскыч менен иштетүү (окуу жайынын компьютери)
server/
  prisma/schema.prisma Teacher, Question, Game, Player, GameQuestion, Answer, AudienceVote,
                       ScoreAdjustment, Student, Season, Assignment, AssignmentQuestion,
                       Submission, Upload
  prisma/migrations/   init, phases, archive_students_rating, school_features, teacher_google
  prisma/seed.ts       база бош болсо, 25 мисал суроо кошот
  src/index.ts         Express + Socket.IO; client/dist'ти да берет
  src/migrate.ts       өзүнчө жазылган migrator (`_ordo_migrations` таблицасы; Turso'до да иштейт)
  src/config.ts        .env; Render'де демейки сыр сөзгө тыюу салынат
  src/google.ts        «Google менен кирүү»: ID-токенди tokeninfo аркылуу текшерүү (aud, iss, exp, email_verified)
  src/auth.ts          requireAdmin / requireSuper / ownedWhere / assertOwner (ownerId: null = башкы алып баруучу)
  src/game/engine.ts   оюндун логикасы (startGame, showQuestion, submitAnswer, 50/50, добуш берүү…)
  src/game/state.ts    ролдор боюнча snapshot'тор: admin, screen, player, audience
  src/game/scoring.ts  rankScores, overallStandings, teamStandings
  src/sockets/index.ts socket окуялары
  src/routes/          questions, games, public (login), importExport, uploads, students,
                       rating, teachers, seasons, assignments (+ ачык /api/hw)
client/src/
  i18n/                ky.ts, ru.ts, lang.ts (localStorage `ordo_lang`)
  lib/                 api.ts (API_BASE, assetUrl, adminToken, staffUser), types.ts,
                       questions.ts, useGameSocket.ts, sound.ts, image.ts
  components/          ui.tsx (Button, Modal, useDialogs…), game.tsx (OptionCard, Podium,
                       RingTimer…), Ornament.tsx (Logo, OrnamentBand, SunTunduk), LangSwitch.tsx
  pages/Home.tsx       лендинг (sticky header)
  pages/player/        Join (PIN), Play, Watch (залдагы көрүүчүлөр), Homework
  pages/screen/        Screen (проектор)
  pages/admin/         AdminLayout (каптал меню), Dashboard, Questions, Import, NewGame,
                       GameControl + control/ (Lobby/Live/ResultsPanel), Pins, Students,
                       History, Replay, Teachers, Seasons, Assignments, AssignmentDetail
```

Маршруттар: `/`, `/join`, `/screen/:code`, `/watch/:code`, `/hw/:code`, `/rating`, `/rating/student/:id`, `/certificate`, `/admin/*`.

## Буйруктар

```bash
npm run setup          # биринчи жолу: орнотуу + база + build
npm run dev            # server :3000 + client :5173 (Vite /api'ни 3000-портко багыттайт)
npm run build          # server (prisma generate + tsc) жана client (tsc -b + vite build)
cd client && npx tsc -b            # тип текшерүү
cd server && npx tsc --noEmit
```

- Windows'то `prisma generate` **EPERM** катасын берсе, демек иштеп жаткан сервер DLL'ди кармап турат. Адегенде серверди токтотуңуз.
- Колдонуучунун dev сервери адатта **3000-портто** иштеп турат. Аны токтотпоңуз жана анын базасына тест маалыматтарын жазбаңыз. Тесттер үчүн өзүнчө порт (мис. 3200) жана өзүнчө база файлын колдонуңуз.
- Автоматтык тесттер репозиторийде жок. Мурунку сессияларда алар scratchpad'да убактылуу скрипт катары жазылган (жалпы ~115 текшерүү: оюндун толук агымы, архив, рейтинг, тапшырмалар). Скриншоттор Playwright-core жана Edge (`channel: 'msedge'`) менен алынат.
- Shell'де heredoc/sed менен кириллица жана тырмакчалар бузулуп кетиши мүмкүн. Мындай учурда Edit/Write куралдарын же .cjs скриптти колдонуңуз.

## Деплой

- **GitHub:** https://github.com/Nabiev005/tapkych-ordo (ачык), `main` бутагы.
- **Render (негизги дарек):** https://tapkych-ordo.onrender.com
  - `render.yaml` боюнча API жана сайт бир сервисте иштейт. Сервер `client/dist`'ти өзү берет.
  - `main`'ге push кылынганда автоматтык түрдө жайгашат (`buildFilter`: `server/**`, `client/**`, `render.yaml`).
  - Жаңы версия чыкканын `/api/health` → `version` (коммиттин алгачкы 7 белгиси) аркылуу текшерсе болот.
  - Акысыз план: бир аз убакыт колдонулбаса, сервер «уктап калат». Биринчи ачылышы ~1 мүнөт созулушу мүмкүн.
- **Turso:** `TURSO_DATABASE_URL` жана `TURSO_AUTH_TOKEN` Render'де коюлган, туташуу иштейт. Булар болбосо, ар бир кайра жайгаштырууда база тазаланат.
- **Vercel** (https://tapkych-ordo.vercel.app) — кошумча фронтенд, `VITE_API_URL` аркылуу Render'ге туташат. Production домени жаңы версияларга өзү өтпөй калган учурлар болгон (Rollback'тан кийин) — Deployments → Promote аркылуу оңдолот.

## Аткарылган иштер (хронология)

1. Негизги платформа: оюндун агымы, PIN менен кирүү, проектор, кайра туташуу, Excel экспорт, 25 seed суроо, кыргызча README.
2. Улуттук оюу-оймолор менен кооз фронтенд, үндөр, конфетти.
3. GitHub → Render + Vercel. Оңдолгон көйгөйлөр: 401, сыр сөздөгү `\n`, Chrome'дун авто-котормосунан чыккан `insertBefore` катасы.
4. Суроонун тексти оюнчунун телефонунда да көрүнөт.
5. Суроолор архиви (колдонулган суроолор өчпөйт), оюндардын тарыхы, студенттер (аты + тобу), рейтинг. Turso туташтырылды.
6. 14 кошумча функция: суроо түрлөрү (Тандоо / Туура-Туура эмес / Иретке келтирүү), темалар жана кыйынчылык, сүрөт жана аудио, топ топко каршы режими, ылдам жооп бонусу, 50/50, залдагы көрүүчүлөрдүн добушу, оюнду кайталап көрүү, мугалимдердин аккаунттары, сезондор, грамоталар, студенттин баракчасы, үй тапшырмалары, орус тили.
7. Лендинг башкы бет (эмне үчүн, кантип колдонулат, мүмкүнчүлүктөр, ким үчүн, көп берилүүчү суроолор). Header бет жылганда ордунда турат.
8. Админ панелинин жаңы дизайны: каптал меню (телефондо ачылма меню), Dashboard'до саламдашуу, сандар, тез аракеттер, жүрүп жаткан жана акыркы оюндар.
9. Терминдер: «окуучу» → «студент», «класс» → «топ», «мектеп» → «окуу жайы».
10. «Google менен кирүү» мугалимдер жана алып баруучу үчүн. Админдин Gmail'дери `ADMIN_EMAILS` өзгөрмөсүндө. Мугалимдер Google менен **өздөрү катталат**: жаңы Gmail кирсе, `Teacher` жазуусу `approved = false` абалында түзүлөт, кирүүгө `TEACHER_PENDING` катасы кайтат (эң көп 50 өтүнмө). Башкы алып баруучу «Мугалимдер» бетинен ырастайт же четке кагат (четке кагуу = жазууну өчүрүү). Dashboard'до өтүнмөлөр тууралуу эскертүү чыгат. Google'дун талабы боюнча `/privacy` жана `/terms` беттери кошулду (`pages/Legal.tsx`, тексттер `ky.legal`). Жөндөө тартиби README'нин 6.1-бөлүмүндө.

## Калган иштер жана идеялар

- [ ] **Google менен кирүү — колдонуучунун тарабы (2026-10-09):** OAuth Client ID «My Project 5063» (`clear-destiny-500409-u9`) долбоорунда түзүлдү («peak-bricolage-6mn89» Starter Tier болгондуктан колдонулбайт). Калганы:
  - Branding'ге home page, `/privacy`, `/terms` шилтемелерин жана authorized domain'ди кошуу;
  - **Publish app** баскычы менен In production абалына өткөрүү;
  - Render'ге `GOOGLE_CLIENT_ID` жана `ADMIN_EMAILS` өзгөрмөлөрүн кошуу;
  - Client secret скриншотто көрүнүп калган — аны Reset кылуу (биз аны колдонбойбуз).

  Студенттер үчүн Google менен кирүү (үй тапшырмасы, жеке баракча) кийинчерээк кошулат.
- [ ] Render'дин уктап калышы: UptimeRobot же GitHub Actions аркылуу `/api/health` дарегине ар 5–10 мүнөттө кайрылып туруу сунушталды (колдонуучу азырынча чечим кабыл ала элек).

- [ ] **Домен:** колдонуучу домен тууралуу сураган (мис. `.kg` же `.com`), бирок азырынча чечим кабыл алына элек. Домен алынса, аны Render'дин Custom Domain бөлүмүнө туташтыруу керек.
- [ ] Админ панелинин башка беттери (Суроолор, Студенттер, Тарых ж.б.) жаңы каптал менюнун стилине толук ылайыкташтырыла элек. Аларды текшерип, керек болсо жаңыртуу керек.
- [ ] Автоматтык тесттерди репозиторийге кошуу (`server/test/`) жана `npm test` буйругун түзүү.
- [ ] `client/tsconfig.tsbuildinfo` git'те сакталып жатат. Аны `.gitignore`'го кошуу керек.
- [ ] Render'дин акысыз планында сервер уктап калат. Чыныгы оюн алдында сайтты алдын ала ачып коюу керек, же акылуу планга өтүү керек.
