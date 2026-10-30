# Тапкыч ордо — долбоор боюнча эскертмелер

«Акыл ордо» форматындагы интеллектуалдык оюн платформасы (окуу жайлары жана студенттер үчүн).
Колдонуучуга толук маалымат `README.md` файлында, ал эми бул файл долбоорду иштеп чыгуучу үчүн.

## Негизги эрежелер

- **Колдонуучу менен кыргызча сүйлөшүңүз.** Интерфейс 7 тилде: КЫР (негизги), РУС, ENG, OʻZB (латын), ҚАЗ, ТОҶ, TÜR.
- **Бардык UI тексттери** `client/src/i18n/ky.ts` файлында. Котормолор: `ru.ts`, `en.ts`, `uz.ts`, `kk.ts`, `tg.ts`, `tr.ts` — баары `Ky` тибинде, ошондуктан ky.ts'ке кошулган ар бир ачкычты **6 котормонун баарына** кошуу керек, болбосо `tsc` ката берет. Тилдердин тизмеси, locale жана Google locale — `i18n/lang.ts` (`LANGS`), сөздүктү тандоо — ky.ts'тин аягындагы `DICTS`. Жаңы котормолорду (uz/kk/tg/tr) Claude жазган — эне тилдүү адам текшериши керек. Компоненттерде текстти түз жазбаңыз.
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
                       teacher_approval, library, packs_student_practice, league, telegram, game_intro
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
  src/library/stats.ts суроолордун статистикасы (libraryStats: машыгуу + күндүн суроолору + көчүрмөлөр
                       менен оюндар; bankStats: оюндар). Сакталбайт — суралганда эсептелет. MIN_ANSWERS = 5
  src/practice/activity.ts bishkekDay, lastDays, streakFromDays; practiceLeaderboard — топтордун жумалык
                       рейтинги (activity = аткарылган күндөр / (студенттер × 7)) + серия чемпиондору
  src/practice/analytics.ts teacherAnalytics(className) — мугалимдин аналитикасы: студенттин абалы
                       (ACTIVE / STOPPED ≥3 күн / NEVER / NO_CODE), темалар боюнча тактык, алсыз тема
  src/league/standings.ts computeLeague — мектептер аралык лиганын эсеби (турдагы мектеп = топ-N катышуучунун
                       суммасы; орун үчүн упай 10/8/6/5/4/3/2/1; таблица: упай → жалпы сумма)
  src/telegram/bot.ts  Telegram-бот (TELEGRAM_BOT_TOKEN): туташтыруу /start КОД, күндүн суроолору inline-баскычтар менен
                       (абал callback_data'да: q|YYYYMMDD|жооптор|ORDER-тандоо), эскертмелер 18–22 саат, 403 → ажыратуу.
                       Render'де webhook (RENDER_EXTERNAL_URL), болбосо polling. Тест — жасалма Telegram API менен
  src/routes/leagues.ts /api/leagues (мугалим, ээлик боюнча) + /api/league/:code (ачык). Турлар — Assignment.leagueId
  test/                npm test: unit, auth, game, library, me (пакеттер + студенттин кабинети), stats, league
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
15. (2026-10-15) **Суроолордун статистикасы.** `GET /api/questions` жана `GET /api/library` ар бир суроого `stats: { answered, correct }` кайтарат; китепкана `?sort=hard|easy` (маалымат аз суроолор аягында, баракчалар иреттөөдөн кийин). UI: `AccuracyBadge` (Questions.tsx) — ≥90% «Өтө жеңил», ≤25% «текшериңиз», <5 жооп «маалымат аз». Ошондой эле: бүгүнкү күндүн суроолору машыгуудан **студент аларды аткарганга чейин гана** жашырылат (`hiddenDailyIds`) — кичине китепканада машыгуу бош калбашы үчүн.
16. (2026-10-15) **Топтордун машыгуу рейтинги.** `GET /api/me/leaderboard` (студент; + myGroup, myId) жана `GET /api/students/activity` (мугалим). Акыркы 7 күн, иреттөө: activity → accuracy → аты; топсуз студенттер топ рейтингине кирбейт, серия чемпиондоруна (топ 10) кирет. UI: `components/PracticeBoard.tsx` (dark — /me, ачык — Dashboard; Dashboard'до кимдир бирөө аткаргандан кийин гана көрүнөт).
17. (2026-10-15) **Бөлүшүү карточкасы** (`components/ShareCard.tsx`): canvas'та PNG — пост 1080×1350 же сторис 1080×1920; күн-түндүк, оюу тилкеси, пьедестал (бийиктиги бош орунга жараша), www.tapkych.com. Алып баруучу — ResultsPanel'деги «Жеңүүчүлөрдүн карточкасы»; оюнчу — Play.tsx Finished'теги «Жыйынтыгымды бөлүшүү» (өз орду менен). Web Share API (телефондо) же жүктөп алуу. Сервер: playerSnapshot'ко `podium`, `players`, `championTeam`; base'ке `finishedAt`. Ариптер `document.fonts.load` менен күтүлөт.
18. (2026-10-16) **Мугалимдин аналитикасы** (`/admin/analytics`, `pages/admin/Analytics.tsx`; сервер `GET /api/students/analytics?className=`, `practice/analytics.ts`). Топ боюнча чыпка; плиткалар (студенттер, жумада машыккан, токтоп калган, кирбеген, жумалык тактык); темалар боюнча тактык (машыгуунун details'и → китепкананын category'си + оюндардагы жооптор GameQuestion.category аркылуу; эң алсызы жогоруда, MIN_ANSWERS = 5); студенттер таблицасы (абалы, 7 күндүк чекиттер, серия, тактык, алсыз тема ≥3 жооп жана <60%, акыркы жолу). «Көңүл буруу керек» чыпкасы — токтоп калгандар + кирбегендер.
19. (2026-10-16) **Мектептер аралык лига** (`/admin/leagues`, `/admin/leagues/:id`, ачык `/league/:code`). Модель `League` (code 6 белги, schools JSON, topN) + `Assignment.leagueId` + `Submission.school` (миграция `20261016120000_league`). Турлар — тапшырма механизми (`createAssignment` бөлүнүп чыкты, `AssignmentFormModal` клиентте кайра колдонулат); лиганын турлары «Тапшырмалар» тизмесинде көрүнбөйт. `/hw/:code` лиганын туру болсо студенттер тизмесин бербейт — катышуучу мектебин тандап, атын жазат (ошол эле мектеп + ат кайра кирсе — мурунку жыйынтыгы). Ачык бет 30 сек сайын жаңырат. Лиганын жыйынтыктары рейтингге кирбейт (studentId жок).
20. (2026-10-16) **Telegram-бот** (`server/src/telegram/bot.ts`). Student'ке `telegramChatId`, `telegramLinkCode`, `telegramRemindedDay` (миграция `20261016150000_telegram`). `/me`: `telegram: { bot, linked }`, `POST /api/me/telegram/link` → t.me шилтемеси, `DELETE /api/me/telegram`. Кабинетте Telegram картасы (бот иштесе гана көрүнөт); аналитикада туташкандардын белгиси. Бот иштеши үчүн Render'ге `TELEGRAM_BOT_TOKEN` коюу керек (README 6.2). Тексттер — кыргызча, эмодзисиз.

21. (2026-10-16) **Башкы бет жаңыланды:** hero'до лига жана Telegram-бот, badges'ке «Мектептер аралык лига», «Telegram-бот», «Акысыз»; «Мүмкүнчүлүктөр» башында 6 жаңы карта `isNew` (сары рамка + «Жаңы» белгиси): лига, бот, аналитика, бөлүшүү карточкасы, топтордун рейтинги, суроолордун статистикасы (жалпы 20 карта, 4 тилке); FAQ'ко лига, бот жана акысыздык; index.html meta description.
22. (2026-10-16) **Түндүк туудагыдай:** `components/flagSun.ts` — Кыргызстандын азыркы туусундагы күндүн расмий SVG формасы (Wikimedia, коомдук менчик; 40 түз нур + кесилишкен жаалуу түндүк, evenodd). `SunTunduk`: нурлар маска менен дисктен тышкары айланат, диск/түндүк кыймылсыз, астындагы кызыл тегерек түндүктүн сызыктарын кызыл кылат. ShareCard'дагы `drawSun` (Path2D) жана `public/favicon.svg` да ушул форма менен.
23. (2026-10-20) **Кардардын үч талабы** (миграция `20261020120000_game_intro`, тест `test/extras.test.ts`):
    - **Интро:** `Game.introEnabled` (демейки true) + `introVideoUrl` (`POST /api/uploads/video`, mp4/webm ≤25 МБ, `/uploads/:id` Range колдойт). Экранда `pages/screen/Intro.tsx` — ROUND1 + IDLE + index −1 болгондо: видео болсо видео (үнү бөгөттөлсө — үнсүз), жок болсо 9 сек анимация (`sfx.intro`). «Биринчи суроо» басылса токтойт; `base().startedAt` боюнча кайра жүктөлгөндө кайталанбайт. Жөндөө — `components/IntroSettings.tsx` (NewGame жана Lobby; акыркы видео localStorage `ordo_intro_video`'до).
    - **Суроолордун саны:** лоббиде PATCH settings, оюн учурунда `setRoundCount { round, count }` аракети (учурдагы/кийинки тур; көрсөтүлгөн суроодон азайбайт; кошулганда банктан ушул оюнда жок суроо алынат — ошол тур/кыйынчылык биринчи). adminSnapshot'то `spare`. UI — `control/RoundCounts.tsx`.
    - **Финалда ким биринчи басты:** `pressOrder` (screen + admin snapshot, FINAL'да гана, QUESTION/REVEAL): жооп берген тартибинде аты жана убактысы, туура/ката жок. Экранда «БИРИНЧИ БАСТЫ» баннери (`sfx.buzz`) жана оюнчулардын чиптеринде тартип номери.
24. (2026-10-20) **Бренд логолору** `client/public/brand/` (icon, mascot, logo-dark, logo-light, header-light; булагы — кардар берген SVG'лер). `Logo` (Ornament.tsx): `sm` — иконка + HTML аталыш (караңгы фон) же header-light (`onDark={false}`); md/lg/xl — logo-dark/light сүрөтү. `Mascot` — оюнчунун лоббиси (Play), `/me` кирүү, Home hero. `public/favicon.svg` = tapkych-icon (мурунку туудагы күн формасы ShareCard'да жана SunTunduk'та калды).
25. (2026-10-21) **Финал: «биринчи баскан жооп берет» режими** (миграция `20261021120000_final_buzzer`: `Game.finalBuzzer`, `Answer.judgedAt`). `isBuzzer(game, round)` (load.ts) — FINAL'да гана. Оюнчу `player:buzz` → Answer `choice = 'BUZZ'` (`BUZZ_CHOICE`), points 0; кадимки `player:answer` жана 50/50 бул режимде INVALID_ACTION. Алып баруучу `judgeBuzz { correct }` — кезектеги биринчи бааланбаган басууну баалайт: туура → упай (+ ылдамдык бонусу) жана автоматтык REVEAL; ката → кезек кийинкиге. `pressOrder[].status` (pending/wrong/correct) ушул режимде гана; `base.buzzer`; playerSnapshot `myPress { place, status, queue }` (кадимки финалда да — «Сиз N-болуп бастыңыз»). UI: Play `BuzzPad`, LivePanel `BuzzPanel` (оюнчу жооп берип жатканда негизги «ачуу» баскычы жашырылат), Screen `BuzzBanner`. `Toggle` эми `components/ui.tsx`'те.
26. (2026-10-21) **Ачык жооп суроолору** (`type: 'OPEN'`, миграция жок). optionA — туура жооп, optionB/C/D — кошумча жазылыштар (бош болушу мүмкүн), correct дайыма `'A'`. Текшерүү — `game/openAnswer.ts` (`normalizeOpen`: кичине тамга, тыныш белгилер, ё→е, ң/ө/ү→н/о/у; Левенштейн: 5+ белги — 1, 9+ — 2 ката, сандар так; ≤100 белги). Answer.choice — оюнчунун тексти. **REVEAL'га чейин** OPEN'дин options'у оюнчуга/экранга/көрүүчүгө бош жөнөтүлөт (`questionInfo(q, showText, revealed)`). Алып баруучу `markAnswer { playerId, correct }` менен оңдойт (QUESTION/REVEAL). Зал добуш бербейт, optionStats null. OPEN **оюндар үчүн гана**: `LIBRARY_TYPES` (китепкана, share, импорт `allowOpen=false`), тапшырмалар `type: { not: 'OPEN' }`. Клиентте `GAME_QUESTION_TYPES` (банк формасы), `QUESTION_TYPES` (китепкана).
27. (2026-10-26) **1-этап:** суроонун өзүнчө убактысы (`Question/GameQuestion.timerSeconds`, `questionMs(game, q)` — load.ts; `base.timerSeconds` учурдагы суроонукун көрсөтөт), суроолорду аралаштыруу (`Game.shuffle`, startGame/setRoundCount), видео суроолор (`videoUrl`, китепканада жок), аватарлар (`Player.avatar`, `AVATARS` — server types.ts ↔ components/Avatar.tsx, `player:avatar`), залдын реакциялары (`reaction` окуясы — көрүүчү/оюнчу → экран, сакталбайт, 700 мс чек; components/Reactions.tsx), англис тили. Миграция `20261026120000_phase1`, тест `test/phase1.test.ts`. useGameSocket'те `send` (жооп күтпөй) жана payload'дуу handlers.
28. (2026-10-26) **7 тил жана желектүү тил тандоочу:** `components/Flag.tsx` (жөнөкөйлөтүлгөн SVG желектер; эмодзи-желектер Windows'то көрүнбөйт), `LangSwitch` — framer-motion менен ачылма тизме (`up` — өйдө ачылат, AdminLayout'то). Лендинг жаңы функцияларга дал келтирилди (7 жаңы `isNew` карта, белгилер, FAQ), Home.tsx `ICONS`'ка hand/keyboard/clapper/video/smile/sliders/languages. Бардык сөздүктөр бир бандлга кирет (~430 КБ index.js) — керек болсо кийин тилдерди өзүнчө жүктөөгө өткөрсө болот.
29. (2026-10-30) **2-этап: Брейн-ринг** (миграция `20261030120000_brain_ring`: `Game.mode` CLASSIC | BRAIN_RING). `gameRounds(game)` / `lastRound(game)` (load.ts) — Брейн-рингде `['ROUND1']` гана: startGame, confirmAdvance (кийинки тур жок), finishGame (ROUND1'ден кийин), setRoundCount, overallStandings ушуларды колдонот. `isBuzzer` — BRAIN_RING'де ар бир суроо. Режим `teamMode = true`ну мажбурлайт; командасы < 2 болсо `NOT_ENOUGH_TEAMS`. Buzz: бир суроого бир командадан бир гана басуу (`teamOf`), playerSnapshot `teamPressed`. `pressOrder` эми каалаган «биринчи баскан» турда (мурун FINAL гана) жана `team`ди камтыйт. «Биринчи баскан» режиминде баспаган оюнчунун `correct`/`myCorrect` = null (нейтралдуу). Лоббиде командасын өзгөртүү (`PATCH /players/:pid { team }`). Экранда `TeamScores`, баннерде команданын аты. Тест `test/brainring.test.ts`.
## Калган иштер жана идеялар

- [x] **Google менен кирүү иштейт (2026-10-10, www.tapkych.com'до сыналды).** OAuth Client ID «My Project 5063» (`clear-destiny-500409-u9`) долбоорунда түзүлгөн («peak-bricolage-6mn89» Starter Tier болгондуктан колдонулбайт). Колдонмо жарыяланган (In production). Origins: onrender, vercel.app, www.tapkych.com, tapkych.com, localhost:3000/5173. Render'де `GOOGLE_CLIENT_ID` жана `ADMIN_EMAILS` коюлган.
- [ ] Google: **Verify branding** (кирүү терезесинде «Тапкыч ордо» деген ат көрүнүшү үчүн) — адегенде Search Console'до `tapkych.com` ырасталышы керек. Client secret скриншотто көрүнүп калган, аны Reset кылуу сунушталды (биз аны колдонбойбуз).
- [ ] Search Console: `tapkych.com` доменин ырастоо жана `https://www.tapkych.com/sitemap.xml` дарегин жөнөтүү.
- [ ] **Китепкананын баштапкы топтомун текшерүү:** ~130 суроону Claude жазган — продакшнда «Баштапкы топтомду кошуу» басылгандан кийин башкы алып баруучу ар бирин фактысы боюнча текшерип ырастоосу керек.
- [ ] Кийинки идеялар (статистика, топтордун рейтинги, бөлүшүү карточкасы, мугалимдин аналитикасы, мектептер аралык лига жана Telegram-бот аткарылды): ЖРТ даярдоо режими, ата-энеге шилтеме, майрамдык шаблондор, офлайн .exe.
- [ ] Студенттер үчүн Google менен кирүү — азыр код менен кирет (`/me`); керек болсо кийинчерээк.
- [x] **Render'дин уктап калышы (2026-10-14):** UptimeRobot (бекер план) ар 5 мүнөттө `https://tapkych-ordo.onrender.com/api/health` дарегин текшерет, иштебей калса ajbeknabiev90@gmail.com'го кат келет. Акылуу планга азыр каражат жок. Келечекте Oracle Cloud Always Free'ге көчүү варианты бар. Эскертүү: `www.tapkych.com/api/health` серверди ойготпойт — ал Vercel'дин index.html'ин берет.
- [ ] Админ панелинин башка беттери (Суроолор, Студенттер, Тарых ж.б.) жаңы каптал менюнун стилине толук ылайыкташтырыла элек. Аларды текшерип, керек болсо жаңыртуу керек.
- [x] **Автоматтык тесттер (2026-10-14):** 50 тест — unit (rankScores, validChoice, questionSchema, FailLimiter), auth (логин, 401/403, мугалимдердин бөлүнүшү, PIN бөгөтү), game (толук агым, жооп REVEAL чейин ачылбайт, тыныгуу, 50/50, таймер, kick, session:replaced, өчүрүү). Студенттер, рейтинг, сезондор, тапшырмалар, импорт/экспорт үчүн тесттер али жок.
- [x] `*.tsbuildinfo` `.gitignore`'го кошулду (`client/tsconfig.tsbuildinfo` git'тен `git rm --cached` менен алынышы керек).
- [ ] `npm audit`: csv-parse (<7.0.2), deepmerge-ts (prisma аркылуу), uuid (exceljs аркылуу) — оңдоо major жаңыртууну талап кылат, текшерилип чыгышы керек.
- [ ] Windows'то `npm install` Prisma'нын postinstall'ун иштетпей калышы мүмкүн → `@prisma/client did not initialize yet`. Чечими: `cd server && npx prisma generate`.
- [ ] Render'дин акысыз планында сервер уктап калат. Чыныгы оюн алдында сайтты алдын ала ачып коюу керек, же акылуу планга өтүү керек.
