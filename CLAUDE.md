# Тапкыч ордо — долбоор боюнча эскертмелер

«Акыл ордо» форматындагы интеллектуалдык оюн платформасы (окуу жайлары жана студенттер үчүн).
Колдонуучуга толук маалымат `README.md` файлында, ал эми бул файл долбоорду иштеп чыгуучу үчүн.

## Негизги эрежелер

- **Колдонуучу менен кыргызча сүйлөшүңүз.** Интерфейс эки тилде: КЫР (негизги) жана РУС.
- **Бардык UI тексттери** `client/src/i18n/ky.ts` файлында. Орусча котормосу `ru.ts`'те, ал `Ky` тибинде болгондуктан, ky.ts'ке кошулган ар бир ачкычты ru.ts'ке да кошуу керек, болбосо `tsc` ката берет. Компоненттерде текстти түз жазбаңыз.
- **Терминдер:** катышуучуларды **«студент / студенттер»** деп атаңыз («окуучу» деген сөздү колдонбоңуз), алардын тобун **«топ»** деп («класс» эмес), ал эми мекемени **«окуу жайы»** деп атаңыз («мектеп» эмес). Орусчасы: «студент», «группа», «учебное заведение».
- **Иконкалар — эмодзи эмес, `lucide-react`.** Тексттин ичинде: `<Icon className="ico" />` (`.ico` — index.css, тамганын өлчөмүндө). `Button`'дун `icon` prop'уна `icon={<Plus />}` — өлчөмү өзү коюлат. Медалдар: `RankMedal` (components/game.tsx). Оюн пакетинин белгиси базада аты менен сакталат (`'mountain'`), көрсөтүү — `PackIcon` (components/PackIcon.tsx). Лендингдеги иконкалар `ky.landing` ичинде аты менен (`'library'`), `Home.tsx`'теги `ICONS` картасы аркылуу. i18n тексттерине эмодзи жазбаңыз.
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
                       Submission, Upload, LibraryQuestion (Question.libraryId — көчүрмөнүн булагы),
                       LibraryPack + LibraryPackItem, PracticeAttempt (Student.accessCode)
  prisma/migrations/   init, phases, archive_students_rating, school_features, teacher_google,
                       teacher_approval, library, packs_student_practice
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
  src/routes/          questions, games, public (login), importExport (parseQuestionRows — банк
                       жана китепкана үчүн жалпы), uploads, students, rating, teachers, seasons,
                       assignments (+ ачык /api/hw), library (+ /packs), me (студенттин кабинети)
  src/library/starter.ts китепкананын баштапкы топтому (~130 суроо → PENDING) + STARTER_PACKS, buildPack
  test/                npm test: unit, auth, game, library, me (пакеттер + студенттин кабинети)
client/src/
  i18n/                ky.ts, ru.ts, lang.ts (localStorage `ordo_lang`)
  lib/                 api.ts (API_BASE, assetUrl, adminToken, staffUser), types.ts,
                       questions.ts, useGameSocket.ts, sound.ts, image.ts
  components/          ui.tsx (Button, Modal, useDialogs…), game.tsx (OptionCard, Podium,
                       RingTimer…), Ornament.tsx (Logo, OrnamentBand, SunTunduk), LangSwitch.tsx
  pages/Home.tsx       лендинг (sticky header)
  pages/player/        Join (PIN), Play, Watch (залдагы көрүүчүлөр), Homework
  pages/student/       Me — студенттин кабинети (Login, Cabinet, Quiz, Result); studentApi/studentToken (lib/api.ts)
  pages/screen/        Screen (проектор)
  pages/admin/         AdminLayout (каптал меню), Dashboard, Questions (QuestionForm, OptionsPreview —
                       Library да колдонот; library=true режими), Library, Import, NewGame,
                       GameControl + control/ (Lobby/Live/ResultsPanel), Pins, Students,
                       History, Replay, Teachers, Seasons, Assignments, AssignmentDetail
```

Маршруттар: `/`, `/join`, `/me`, `/screen/:code`, `/watch/:code`, `/hw/:code`, `/rating`, `/rating/student/:id`, `/certificate`, `/admin/*`. Рейтинг жана студенттин баракчасы админ панелинин ичинде да ачылат: `/admin/rating`, `/admin/rating/student/:id` (`Rating` / `StudentProfile` компоненттеринин `embedded` режими; ачык `/rating` бети студенттер жана проектор үчүн калат).

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
- **Тесттер:** `npm test` (тамырдан же `server/`'ден) — `node:test` + tsx, `server/test/*.test.ts`. `helpers.ts` ар бир файл үчүн серверди бош портто жана `prisma/test-<ат>-<pid>.db` убактылуу базасында иштетет (миграциялар менен, seed жок), анан өчүрөт. Socket.IO үчүн `socket.io-client` (server devDependency) жана `Client` классы (`waitFor(pred)`). Жаңы функция кошулса — тест да кошуу керек. Скриншоттор Playwright-core жана Edge (`channel: 'msedge'`) менен алынат.
- Shell'де heredoc/sed менен кириллица жана тырмакчалар бузулуп кетиши мүмкүн. Мындай учурда Edit/Write куралдарын же .cjs скриптти колдонуңуз.

## Деплой

- **GitHub:** https://github.com/Nabiev005/tapkych-ordo (ачык), `main` бутагы.
- **Негизги домен (2026-10-10):** https://www.tapkych.com. Домен Vercel'ден алынган, DNS да Vercel'де (`ns1/ns2.vercel-dns.com`). `tapkych.com` → `www.tapkych.com` (308). Сайтты Vercel берет, ал эми API жана Socket.IO Render'де (`VITE_API_URL`). Canonical, sitemap, robots жана JSON-LD ушул доменге жазылган (`client/index.html`, `client/public/`).
- **Render (сервер, ошондой эле толук резервдик дарек):** https://tapkych-ordo.onrender.com
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
11. (2026-10-14) Автоматтык тесттер (`npm test`), рейтинг админ панелинин ичинде (`/admin/rating`), UptimeRobot.
12. (2026-10-14) **Суроолор китепканасы** (`/admin/library`, `LibraryQuestion`). Статустар: PENDING → APPROVED, четке кагуу = өчүрүү. Мугалим ырасталгандарды көрөт жана көчүрөт (`POST /api/library/copy`, round: AUTO = кыйынчылыгына жараша же белгилүү тур; кайра көчүрүлбөйт — `Question.libraryId` боюнча). Мугалим «Суроолор» бетинен бөлүшөт (`/share` → PENDING; админ бөлүшсө — дароо APPROVED; китепканадан алынган же китепканада бар текст бөлүшүлбөйт). Башкы алып баруучу гана: түз кошуу/оңдоо, approve/reject, Excel импорт («Тур» мамычасы милдеттүү эмес), баштапкы топтом. Тексттин кайталанышы `norm()` менен текшерилет (боштуктар, чоң/кичине тамга). Dashboard'до модерация тууралуу эскертүү.
13. (2026-10-14) **Оюн пакеттери** (`LibraryPack`, `/api/library/packs`, `/packs/:id/copy` — `copyToBank` аркылуу, ар бир суроо өз турунда). Баштапкы топтом 3 пакет түзөт (`buildPack`: финалдан баштап кыйын → орто → жеңил, темалар аралаштырылат; аталышы уникалдуу, кайра түзүлбөйт). Мугалим ырасталган суроолору бар пакеттерди гана көрөт. Пакет түзүү/өчүрүү — башкы алып баруучу гана.
14. (2026-10-14) **Студенттин кабинети** (`/me`, `/api/me`). Кирүү — `Student.accessCode` (6 белги, 0/O/1/I жок; `POST /api/students/codes`, `/:id/code`), JWT `role: 'student'` (30 күн; staff токендери менен аралашпайт — `verifyStaffToken` студенттикин кабыл албайт жана тескерисинче). «Күндүн суроолору»: ырасталган китепканадан `seededShuffle('daily:'+күн)` менен 5 суроо, күн Бишкек убактысы (UTC+6) боюнча, күнүнө бир жолу (`PracticeAttempt` kind=DAILY), серия (streak) катар күндөр боюнча. Машыгуу: тема боюнча 10 кокус суроо; **бүгүнкү күндүн суроолору машыгууда чыкпайт жана текшерилбейт** (антпесе жоопторду алдын ала билип алса болот). Жоопторду сервер гана текшерет; туура жооп тапшыргандан кийин гана кайтат. «Студенттер» бетинде коддор жана басып чыгаруучу карточкалар (`print:` класстары).

## Калган иштер жана идеялар

- [x] **Google менен кирүү иштейт (2026-10-10, www.tapkych.com'до сыналды).** OAuth Client ID «My Project 5063» (`clear-destiny-500409-u9`) долбоорунда түзүлгөн («peak-bricolage-6mn89» Starter Tier болгондуктан колдонулбайт). Колдонмо жарыяланган (In production). Origins: onrender, vercel.app, www.tapkych.com, tapkych.com, localhost:3000/5173. Render'де `GOOGLE_CLIENT_ID` жана `ADMIN_EMAILS` коюлган.
- [ ] Google: **Verify branding** (кирүү терезесинде «Тапкыч ордо» деген ат көрүнүшү үчүн) — адегенде Search Console'до `tapkych.com` ырасталышы керек. Client secret скриншотто көрүнүп калган, аны Reset кылуу сунушталды (биз аны колдонбойбуз).
- [ ] Search Console: `tapkych.com` доменин ырастоо жана `https://www.tapkych.com/sitemap.xml` дарегин жөнөтүү.
- [ ] **Китепкананын баштапкы топтомун текшерүү:** ~130 суроону Claude жазган — продакшнда «Баштапкы топтомду кошуу» басылгандан кийин башкы алып баруучу ар бирин фактысы боюнча текшерип ырастоосу керек.
- [ ] Кийинки идеялар: ЖРТ даярдоо режими, суроолор боюнча статистика (канча % туура жооп берилди), студенттин кабинетинде топтун серия рейтинги, мугалимге студенттердин машыгуу активдүүлүгү.
- [ ] Студенттер үчүн Google менен кирүү — азыр код менен кирет (`/me`); керек болсо кийинчерээк.
- [x] **Render'дин уктап калышы (2026-10-14):** UptimeRobot (бекер план) ар 5 мүнөттө `https://tapkych-ordo.onrender.com/api/health` дарегин текшерет, иштебей калса ajbeknabiev90@gmail.com'го кат келет. Акылуу планга азыр каражат жок. Келечекте Oracle Cloud Always Free'ге көчүү варианты бар. Эскертүү: `www.tapkych.com/api/health` серверди ойготпойт — ал Vercel'дин index.html'ин берет.
- [ ] Админ панелинин башка беттери (Суроолор, Студенттер, Тарых ж.б.) жаңы каптал менюнун стилине толук ылайыкташтырыла элек. Аларды текшерип, керек болсо жаңыртуу керек.
- [x] **Автоматтык тесттер (2026-10-14):** 50 тест — unit (rankScores, validChoice, questionSchema, FailLimiter), auth (логин, 401/403, мугалимдердин бөлүнүшү, PIN бөгөтү), game (толук агым, жооп REVEAL чейин ачылбайт, тыныгуу, 50/50, таймер, kick, session:replaced, өчүрүү). Студенттер, рейтинг, сезондор, тапшырмалар, импорт/экспорт үчүн тесттер али жок.
- [x] `*.tsbuildinfo` `.gitignore`'го кошулду (`client/tsconfig.tsbuildinfo` git'тен `git rm --cached` менен алынышы керек).
- [ ] `npm audit`: csv-parse (<7.0.2), deepmerge-ts (prisma аркылуу), uuid (exceljs аркылуу) — оңдоо major жаңыртууну талап кылат, текшерилип чыгышы керек.
- [ ] Windows'то `npm install` Prisma'нын postinstall'ун иштетпей калышы мүмкүн → `@prisma/client did not initialize yet`. Чечими: `cd server && npx prisma generate`.
- [ ] Render'дин акысыз планында сервер уктап калат. Чыныгы оюн алдында сайтты алдын ала ачып коюу керек, же акылуу планга өтүү керек.
