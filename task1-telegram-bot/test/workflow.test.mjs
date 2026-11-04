// Прогоняет код узла «Build replies» прямо из workflow.json на сценариях из задания.
// Запуск: node --test task1-telegram-bot/test/workflow.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const raw = readFileSync(new URL('../workflow.json', import.meta.url), 'utf8');
const workflow = JSON.parse(raw);
const node = (name) => workflow.nodes.find((n) => n.name === name);
const buildReplies = new Function('$input', '$', node('Build replies').parameters.jsCode);

function run(update, rows) {
  const $input = { all: () => rows.map((json) => ({ json })) };
  const $ = (name) => {
    assert.equal(name, 'Telegram Trigger');
    return { first: () => ({ json: update }) };
  };
  return buildReplies($input, $).map((item) => item.json);
}

const start = (text = '/start') => ({ update_id: 1, message: { message_id: 1, chat: { id: 42 }, text } });
const press = (data) => ({
  update_id: 2,
  callback_query: { id: 'cb-1', from: { id: 42 }, message: { message_id: 7, chat: { id: 42 } }, data },
});
// Лист как его отдаёт узел Google Sheets: строки с row_number, чекбокс — 'TRUE'/'FALSE'.
const sheet = (total, active) => Array.from({ length: total }, (_, i) => ({
  row_number: i + 2,
  id: String(i + 1),
  name: `Услуга ${i + 1}`,
  active: i < active ? 'TRUE' : 'FALSE',
}));
const buttons = ([reply]) => (reply.payload.reply_markup?.inline_keyboard ?? []).map(([b]) => b);

for (const count of [2, 5, 9]) {
  test(`/start показывает ${count} кнопок при ${count} активных услугах`, () => {
    const out = run(start(), sheet(10, count));
    assert.equal(out.length, 1);
    assert.equal(out[0].method, 'sendMessage');
    assert.equal(out[0].payload.chat_id, 42);
    assert.deepEqual(buttons(out), sheet(count, count).map((r) => ({ text: r.name, callback_data: `svc:${r.id}` })));
  });
}

test('добавление, переименование и отключение услуги видны после повторного /start', () => {
  const rows = sheet(3, 3);
  rows.push({ row_number: 5, id: '4', name: 'Новая услуга', active: 'TRUE' }); // добавили
  rows[0].name = 'Консультация (онлайн)';                                     // переименовали
  rows[1].active = 'FALSE';                                                    // отключили
  assert.deepEqual(buttons(run(start(), rows)).map((b) => b.text), ['Консультация (онлайн)', 'Услуга 3', 'Новая услуга']);
  rows.splice(2, 1);                                                           // удалили строку
  assert.deepEqual(buttons(run(start(), rows)).map((b) => b.callback_data), ['svc:1', 'svc:4']);
});

test('нет активных услуг — понятный текст без клавиатуры', () => {
  for (const rows of [sheet(5, 0), [{}]]) { // [{}] — пустой лист при alwaysOutputData
    const [reply] = run(start(), rows);
    assert.equal(reply.payload.text, 'Сейчас нет доступных услуг. Загляните позже.');
    assert.equal(reply.payload.reply_markup, undefined);
  }
});

test('нажатие кнопки: услуга определяется по ID, приходит её актуальное название', () => {
  const rows = sheet(9, 9);
  for (const id of ['1', '5', '9']) {
    const out = run(press(`svc:${id}`), rows);
    assert.deepEqual(out, [
      { method: 'sendMessage', payload: { chat_id: 42, text: `Вы выбрали услугу: Услуга ${id}` } },
      { method: 'answerCallbackQuery', payload: { callback_query_id: 'cb-1' } },
    ]);
  }
  rows[4].name = 'Переименованная';
  assert.equal(run(press('svc:5'), rows)[0].payload.text, 'Вы выбрали услугу: Переименованная');
});

test('кнопка из старого меню: отключённая или удалённая услуга', () => {
  const rows = sheet(3, 2); // услуга 3 отключена
  for (const data of ['svc:3', 'svc:404']) {
    const [reply, answer] = run(press(data), rows);
    assert.match(reply.payload.text, /больше недоступна/);
    assert.equal(answer.method, 'answerCallbackQuery');
  }
  assert.deepEqual(run(press('other'), rows).map((r) => r.method), ['answerCallbackQuery']);
});

test('варианты команды и прочие сообщения', () => {
  for (const text of ['/start', '/start@ld_services_bot', '/start promo']) {
    assert.equal(buttons(run(start(text), sheet(2, 2))).length, 2, text);
  }
  const sticker = { update_id: 4, message: { message_id: 2, chat: { id: 42 }, sticker: {} } };
  for (const update of [start('/started'), start('привет'), sticker]) {
    assert.equal(run(update, sheet(2, 2))[0].payload.text, 'Отправьте /start, чтобы открыть меню услуг.');
  }
  assert.deepEqual(run({ update_id: 3, edited_message: {} }, sheet(2, 2)), []);
});

test('формат данных: признак активности, регистр заголовков, дубли и длинные ID', () => {
  const rows = [
    { ID: '1', Name: ' Чекбокс ', Active: true },
    { id: '2', name: 'Текст «да»', active: 'Да' },
    { id: '3', name: 'Единица', active: 1 },
    { id: '4', name: 'Выключена', active: 'FALSE' },
    { id: '5', name: 'Пусто', active: '' },
    { id: '', name: 'Без ID', active: 'TRUE' },
    { id: '1', name: 'Дубль ID', active: 'TRUE' },
    { id: 'x'.repeat(61), name: 'Слишком длинный ID', active: 'TRUE' },
  ];
  assert.deepEqual(buttons(run(start(), rows)).map((b) => b.text), ['Чекбокс', 'Текст «да»', 'Единица']);
});

test('workflow: цепочка узлов, подписка на апдейты, отсутствие секретов', () => {
  const next = (name) => workflow.connections[name].main[0][0].node;
  assert.equal(next('Telegram Trigger'), 'Read services');
  assert.equal(next('Read services'), 'Build replies');
  assert.equal(next('Build replies'), 'Telegram Bot API');
  assert.deepEqual(node('Telegram Trigger').parameters.updates, ['message', 'callback_query']);
  assert.equal(node('Read services').alwaysOutputData, true);
  assert.match(node('Telegram Bot API').parameters.url, /botYOUR_BOT_TOKEN\/\{\{ \$json\.method \}\}$/);
  assert.doesNotMatch(raw, /\d{8,10}:[\w-]{35}/, 'в экспорте не должно быть токена бота');
  assert.ok(workflow.nodes.every((n) => !n.credentials), 'credentials выбираются после импорта');
});
