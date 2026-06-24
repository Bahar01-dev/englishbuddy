import type { SyllabusUnit } from "@/lib/syllabus";

// Стартовый набор юнитов силлабуса (FR-13, спецификация 5.5).
// Покрывает A1–A2 для треков work / relocation / conversational — приоритет первого
// пользователя (работа + переезд + разговорный). Каждый юнит: тема + грамматический
// фокус + лексика + сценарий ролевой практики. Расширяется в P1 (больше уровней/треков).
//
// ВАЖНО: id должны быть стабильными — по ним считается «пройденность» юнита
// (lesson_sessions.syllabus_unit_id у завершённых уроков). Не переименовывать id
// существующих юнитов, только добавлять новые.
//
// Порядок в массиве = порядок прохождения внутри одного уровня (selectNextUnit берёт
// первый непройденный сверху вниз).

export const SYLLABUS_UNITS: SyllabusUnit[] = [
  // ─────────────────────────── A1 · work ───────────────────────────
  {
    id: "a1-work-introductions",
    level: "A1",
    track: "work",
    title: "Знакомство с коллегами",
    grammarFocus: "глагол to be (I am / you are), простые вопросы (What's your name? Where are you from?)",
    vocab: [
      "Nice to meet you — приятно познакомиться",
      "My name is… — меня зовут…",
      "I work as a… — я работаю…",
      "Where are you from? — откуда ты?",
      "I'm from… — я из…",
    ],
    scenario:
      "Первый день на новой работе. Ты играешь роль нового коллеги, который подходит познакомиться. Ученик представляется и отвечает на простые вопросы о себе.",
  },
  {
    id: "a1-work-asking-help",
    level: "A1",
    track: "work",
    title: "Простая просьба о помощи на работе",
    grammarFocus: "вежливые просьбы Can you…? / Could you…?, please/thank you",
    vocab: [
      "Can you help me? — можешь помочь?",
      "Could you repeat that? — можешь повторить?",
      "I don't understand — я не понимаю",
      "Where is…? — где находится…?",
      "Thank you so much — большое спасибо",
    ],
    scenario:
      "Ученику нужно найти переговорную и попросить коллегу о помощи. Ты играешь роль дружелюбного коллеги, который объясняет дорогу.",
  },
  {
    id: "a1-work-daily-routine",
    level: "A1",
    track: "work",
    title: "Мой рабочий день",
    grammarFocus: "Present Simple (I start, I work, I finish), время (at 9 o'clock)",
    vocab: [
      "I start work at… — я начинаю работу в…",
      "I have a meeting — у меня встреча",
      "lunch break — обеденный перерыв",
      "I finish at… — я заканчиваю в…",
      "every day — каждый день",
    ],
    scenario:
      "Small talk у кофемашины. Ты играешь роль коллеги, который спрашивает про обычный рабочий день ученика. Ученик описывает свой распорядок.",
  },

  // ──────────────────────── A1 · relocation ────────────────────────
  {
    id: "a1-reloc-pharmacy",
    level: "A1",
    track: "relocation",
    title: "В аптеке",
    grammarFocus: "I need / I have, существительные с a/an, This/that",
    vocab: [
      "I need something for… — мне нужно что-то от…",
      "I have a headache — у меня болит голова",
      "How much is it? — сколько это стоит?",
      "Do you have…? — у вас есть…?",
      "painkiller — обезболивающее",
    ],
    scenario:
      "Ученик пришёл в аптеку с простудой. Ты играешь роль фармацевта: спрашиваешь о симптомах и предлагаешь лекарство.",
  },
  {
    id: "a1-reloc-grocery",
    level: "A1",
    track: "relocation",
    title: "Покупки в магазине",
    grammarFocus: "I'd like…, some/any, числа и цены",
    vocab: [
      "I'd like… — я бы хотел…",
      "How much is it? — сколько стоит?",
      "Do you have…? — у вас есть…?",
      "Where can I find…? — где найти…?",
      "Can I pay by card? — можно оплатить картой?",
    ],
    scenario:
      "Ученик в продуктовом магазине ищет товары и платит на кассе. Ты играешь роль продавца/кассира.",
  },
  {
    id: "a1-reloc-directions",
    level: "A1",
    track: "relocation",
    title: "Спросить дорогу",
    grammarFocus: "Where is…?, повелительное наклонение (turn left/go straight), prepositions of place",
    vocab: [
      "Excuse me — извините",
      "How do I get to…? — как пройти до…?",
      "turn left / turn right — поверни налево / направо",
      "go straight — иди прямо",
      "It's near… — это рядом с…",
    ],
    scenario:
      "Ученик потерялся в новом городе и ищет станцию метро. Ты играешь роль прохожего, который объясняет дорогу.",
  },

  // ─────────────────────── A1 · conversational ──────────────────────
  {
    id: "a1-conv-coffee",
    level: "A1",
    track: "conversational",
    title: "Заказать кофе в кафе",
    grammarFocus: "I'd like / Can I have…, a/an, размеры (small/medium/large)",
    vocab: [
      "Can I have a coffee, please? — можно кофе, пожалуйста?",
      "for here or to go? — здесь или с собой?",
      "anything else? — что-нибудь ещё?",
      "How much is that? — сколько с меня?",
      "Keep the change — сдачи не надо",
    ],
    scenario:
      "Ученик заказывает кофе и круассан. Ты играешь роль бариста: принимаешь заказ и уточняешь детали.",
  },
  {
    id: "a1-conv-smalltalk",
    level: "A1",
    track: "conversational",
    title: "Лёгкий разговор о погоде и выходных",
    grammarFocus: "It's…, Do you like…?, короткие ответы (Yes, I do / No, I don't)",
    vocab: [
      "How are you? — как дела?",
      "It's a nice day — хорошая погода",
      "What did you do at the weekend? — что делал на выходных?",
      "Do you like…? — тебе нравится…?",
      "Me too — я тоже",
    ],
    scenario:
      "Ученик встречает соседа в лифте. Ты играешь роль приветливого соседа и заводишь короткий small talk.",
  },

  // ─────────────────────────── A2 · work ───────────────────────────
  {
    id: "a2-work-meeting",
    level: "A2",
    track: "work",
    title: "Назначить встречу",
    grammarFocus: "Future (will / be going to), can/could для предложений, дни и время",
    vocab: [
      "Are you free on…? — ты свободен в…?",
      "Let's schedule a meeting — давай назначим встречу",
      "Does Tuesday work for you? — вторник подходит?",
      "I'm busy in the morning — утром я занят",
      "Let me check my calendar — посмотрю в календаре",
    ],
    scenario:
      "Ученику нужно договориться о времени встречи с коллегой. Ты играешь роль занятого коллеги, у которого мало свободных слотов.",
  },
  {
    id: "a2-work-email-call",
    level: "A2",
    track: "work",
    title: "Телефонный звонок по работе",
    grammarFocus: "вежливые конструкции (Could I speak to…?), present continuous, I'm calling about…",
    vocab: [
      "I'm calling about… — я звоню по поводу…",
      "Could I speak to…? — можно поговорить с…?",
      "Can I leave a message? — можно оставить сообщение?",
      "Hold on, please — подождите, пожалуйста",
      "I'll call you back — я перезвоню",
    ],
    scenario:
      "Ученик звонит в компанию по рабочему вопросу. Ты играешь роль секретаря, который отвечает и соединяет/принимает сообщение.",
  },
  {
    id: "a2-work-problem",
    level: "A2",
    track: "work",
    title: "Сообщить о проблеме на работе",
    grammarFocus: "Past Simple (was/were, didn't work), there is/are, because",
    vocab: [
      "There is a problem with… — есть проблема с…",
      "It's not working — это не работает",
      "Can you fix it? — можешь починить?",
      "I think the reason is… — думаю, причина в…",
      "As soon as possible — как можно скорее",
    ],
    scenario:
      "У ученика не работает рабочий ноутбук. Ты играешь роль сотрудника техподдержки: задаёшь вопросы и предлагаешь решение.",
  },

  // ──────────────────────── A2 · relocation ────────────────────────
  {
    id: "a2-reloc-apartment",
    level: "A2",
    track: "relocation",
    title: "Аренда квартиры",
    grammarFocus: "вопросы How much / How many, there is/are, сравнения (bigger, cheaper)",
    vocab: [
      "I'm looking for an apartment — я ищу квартиру",
      "How much is the rent? — какая аренда?",
      "Is it furnished? — она с мебелью?",
      "Are bills included? — счета включены?",
      "Can I see it? — можно посмотреть?",
    ],
    scenario:
      "Ученик хочет снять квартиру. Ты играешь роль агента/арендодателя: рассказываешь о квартире и отвечаешь на вопросы.",
  },
  {
    id: "a2-reloc-doctor",
    level: "A2",
    track: "relocation",
    title: "Запись и приём у врача",
    grammarFocus: "have/has got (симптомы), How long…?, советы should",
    vocab: [
      "I'd like to make an appointment — хочу записаться на приём",
      "I've got a sore throat — у меня болит горло",
      "How long have you felt like this? — как давно это у вас?",
      "You should rest — вам нужно отдохнуть",
      "prescription — рецепт",
    ],
    scenario:
      "Ученик записывается к врачу и описывает симптомы на приёме. Ты играешь роль регистратора, затем врача.",
  },
  {
    id: "a2-reloc-bank",
    level: "A2",
    track: "relocation",
    title: "Открыть счёт в банке",
    grammarFocus: "I'd like to…, need to + инфинитив, вопросы о документах",
    vocab: [
      "I'd like to open an account — хочу открыть счёт",
      "What documents do I need? — какие нужны документы?",
      "Do you have proof of address? — есть подтверждение адреса?",
      "Fill in this form — заполните анкету",
      "debit card — дебетовая карта",
    ],
    scenario:
      "Ученик открывает банковский счёт после переезда. Ты играешь роль банковского сотрудника: спрашиваешь документы и объясняешь шаги.",
  },

  // ─────────────────────── A2 · conversational ──────────────────────
  {
    id: "a2-conv-plans",
    level: "A2",
    track: "conversational",
    title: "Договориться о встрече с друзьями",
    grammarFocus: "be going to, Would you like to…?, suggestions (Let's…, Why don't we…?)",
    vocab: [
      "Would you like to…? — хочешь…?",
      "Let's meet at… — давай встретимся в…",
      "Why don't we…? — почему бы нам не…?",
      "Sounds good — звучит хорошо",
      "See you then — тогда до встречи",
    ],
    scenario:
      "Ученик планирует выходные с другом. Ты играешь роль друга: предлагаешь идеи и договариваешься о времени и месте.",
  },
  {
    id: "a2-conv-restaurant",
    level: "A2",
    track: "conversational",
    title: "Ужин в ресторане",
    grammarFocus: "I'll have…, countable/uncountable, вежливые просьбы (Could we…?)",
    vocab: [
      "A table for two, please — столик на двоих, пожалуйста",
      "Could I see the menu? — можно меню?",
      "I'll have… — я буду…",
      "Could we get the bill? — можно счёт?",
      "Is service included? — обслуживание включено?",
    ],
    scenario:
      "Ученик ужинает в ресторане. Ты играешь роль официанта: принимаешь заказ, отвечаешь на вопросы, приносишь счёт.",
  },
  {
    id: "a2-conv-hobbies",
    level: "A2",
    track: "conversational",
    title: "Рассказать о себе и хобби",
    grammarFocus: "Present Simple для привычек, наречия частоты (usually/often), like + -ing",
    vocab: [
      "In my free time I… — в свободное время я…",
      "I'm interested in… — я увлекаюсь…",
      "I usually… — обычно я…",
      "How about you? — а ты?",
      "That sounds fun — звучит интересно",
    ],
    scenario:
      "Ученик знакомится с новым человеком на встрече по интересам. Ты играешь роль собеседника: расспрашиваешь о хобби и делишься своими.",
  },
];
