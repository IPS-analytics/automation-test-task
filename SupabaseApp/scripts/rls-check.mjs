// Проверяет изоляцию данных напрямую через API Supabase, в обход интерфейса.
// Запуск: npm run rls-check — берёт VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY из .env.local.
// Пользователи: RLS_A_EMAIL / RLS_A_PASSWORD и RLS_B_EMAIL / RLS_B_PASSWORD. Без них создаются новые —
// только для проекта с выключенным подтверждением email (локально или staging); удалить их скрипт не может.
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error('Нужны VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY (например, в .env.local).');
  process.exit(1);
}

const newClient = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function login(label) {
  const client = newClient();
  const presetEmail = process.env[`RLS_${label}_EMAIL`];
  if (presetEmail) {
    const password = process.env[`RLS_${label}_PASSWORD`] ?? '';
    const { data, error } = await client.auth.signInWithPassword({ email: presetEmail, password });
    if (error) throw new Error(`${label}: не удалось войти как ${presetEmail}: ${error.message}`);
    return { client, userId: data.user.id, email: presetEmail };
  }
  const email = `rls-${label.toLowerCase()}-${Date.now()}@example.com`;
  const { data, error } = await client.auth.signUp({ email, password: `pw-${crypto.randomUUID()}` });
  if (error || !data.session) {
    const reason = error?.message ?? `включено подтверждение email — задайте RLS_${label}_EMAIL и RLS_${label}_PASSWORD`;
    throw new Error(`${label}: не удалось создать пользователя ${email}: ${reason}`);
  }
  return { client, userId: data.user.id, email };
}

let failures = 0;
function check(title, ok, details) {
  console.log(`${ok ? '✓' : '✗'} ${title}${!ok && details ? ` — ${details}` : ''}`);
  if (!ok) failures += 1;
}

const a = await login('A');
const b = await login('B');
console.log(`A: ${a.email}\nB: ${b.email}\n`);

const created = await a.client
  .from('requests')
  .insert({ title: 'Проверка RLS', description: 'Заявка пользователя A', category: 'bot' })
  .select()
  .single();
check(
  'A создаёт заявку: статус «Новая», автор — A',
  !created.error && created.data.status === 'new' && created.data.user_id === a.userId,
  created.error?.message,
);
const id = created.data?.id;

const withStatus = await a.client.from('requests').insert({ title: 'x', description: 'x', category: 'bot', status: 'done' });
check('Нельзя создать заявку сразу в другом статусе', withStatus.error?.code === '42501', withStatus.error?.message ?? 'вставка прошла');

const blank = await a.client.from('requests').insert({ title: ' \n\t ', description: 'x', category: 'bot' });
const tooLong = await a.client.from('requests').insert({ title: 'x'.repeat(201), description: 'x', category: 'bot' });
check(
  'База отклоняет название из одних пробелов и длиннее 200 символов',
  blank.error?.code === '23514' && tooLong.error?.code === '23514',
  `пробелы: ${blank.error?.code ?? 'прошло'}, 201 символ: ${tooLong.error?.code ?? 'прошло'}`,
);

const asOther = await b.client.from('requests').insert({ title: 'x', description: 'x', category: 'bot', user_id: a.userId });
check('Нельзя создать заявку от имени другого пользователя', asOther.error?.code === '42501', asOther.error?.message ?? 'вставка прошла');

const listB = await b.client.from('requests').select('id');
check('B не видит заявку A в своём списке', !listB.error && !listB.data.some((r) => r.id === id), listB.error?.message);

const readB = await b.client.from('requests').select('*').eq('id', id);
check('B не может прочитать заявку A по id', !readB.error && readB.data.length === 0, readB.error?.message ?? `строк: ${readB.data?.length}`);

const updateB = await b.client.from('requests').update({ title: 'Чужая правка', status: 'done' }).eq('id', id).select();
check('B не может изменить заявку A', !updateB.error && updateB.data.length === 0, updateB.error?.message ?? `строк: ${updateB.data?.length}`);

const deleteB = await b.client.from('requests').delete().eq('id', id).select();
check('B не может удалить заявку A', Boolean(deleteB.error) || deleteB.data.length === 0, `строк: ${deleteB.data?.length}`);

const anon = await newClient().from('requests').select('id');
check('Без входа заявки недоступны', Boolean(anon.error) || anon.data.length === 0, `строк: ${anon.data?.length}`);

const updateA = await a.client.from('requests').update({ status: 'in_progress' }).eq('id', id).select().single();
check('A меняет статус своей заявки', !updateA.error && updateA.data.status === 'in_progress', updateA.error?.message);

const giveAway = await a.client.from('requests').update({ user_id: b.userId }).eq('id', id);
check('A не может передать заявку другому пользователю', giveAway.error?.code === '42501', giveAway.error?.message ?? 'обновление прошло');

const backdate = await a.client.from('requests').update({ created_at: '2000-01-01T00:00:00Z' }).eq('id', id);
check('A не может подменить дату создания', backdate.error?.code === '42501', backdate.error?.message ?? 'обновление прошло');

const after = await a.client.from('requests').select('title, status').eq('id', id).single();
check(
  'Заявка A не изменилась от действий B',
  after.data?.title === 'Проверка RLS' && after.data?.status === 'in_progress',
  JSON.stringify(after.data ?? after.error),
);

console.log(failures ? `\nПровалено проверок: ${failures}` : '\nВсе проверки пройдены.');
process.exit(failures ? 1 : 0);
