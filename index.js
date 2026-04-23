const Baileys = require('@whiskeysockets/baileys');
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    DisconnectReason, 
    delay, 
    jidDecode,
    getContentType
} = Baileys;

// حل حاسم لمشكلة makeInMemoryStore
const makeInMemoryStore = Baileys.makeInMemoryStore || (() => ({ bind: () => {}, readFromFile: () => {}, writeToFile: () => {} }));

const pino = require('pino');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const qrcode = require('qrcode-terminal');

// --- الإعدادات الأساسية ---
const AUTH_DIR = 'auth_info';
const PASSWORD = '22Seif333';
const ADMIN_NUMBER = '201226599219';
const ADMIN_JID = ADMIN_NUMBER + '@s.whatsapp.net';
const DEVELOPER_EMAIL = 'seiferfanerfan@gmail.com';

// --- مخازن البيانات ---
const userState = new Map();
const passwordAttempts = new Map();
const authenticatedUsers = new Set();
const registeredUsers = new Map();
let totalUsersCount = 0;
let dailyMessageCount = 0;
let botActive = true;

// --- العبارات العربية ---
const destroyMessages = [
    "خد", "خد يبن أل شرمؤطة", "ؤلأ يأ هلفؤت رد", "أنت يألأ أشتمني", "مش عندك أيد يألأ",
    "ؤلأ أيدك في طيزك", "أه صح نسيت أني قطعتلك ايدك", "اه يالا انا قطعت ايدك",
    "انا حاسس بيك انت مكسسور", "انا دوستك يالا", "مش كان قصدي ادوسك", "خلاص متعيطش يالا",
    "انشف يا خول فين ايه", "امك صعبانه عليا اوي", "عماله تعيط ياض", "يعيني 😍 مش كان قصدي اكسرك",
    "زوبري واقف عليك", "بوس زب بابا يخول", "ي الا ي كسمك", "انزل علي رجلك ي خول",
    "هههههههههههههههههههههههههههههه", "نفسي ترد شرفك يالا", "انا المجال دا =انا",
    "يا ديوث ي ابن المعرصة ي كلب البنات", "انا هنا آلفلســطــيني آلكآرف وبــس",
    "ي معرص ي عبيط", "ي شمام ي عبيط", "ي كس ي عبيط", "بوس رجلي. يخول",
    "رد عليا ي زاني", "ي ابن الزواني", "هفضل انيك فيك", "امك شغاله في شقه دعاره ي ابن الحمارة",
    "انا كلامي دا سيف", "انا ال بااااشاا با خروف", "وطي ياسطا مص في زبي", "هديك جنيه يلا",
    "عسسسل يكسسسمك 😁😁😁😁😁😁😁"
];

const logger = pino({ level: 'silent' });
const store = makeInMemoryStore({ logger });

async function startBot() {
    console.log('🔥 جاري تشغيل النسخة المضمونة 100%: SEIFER ULTIMATE V10.4...');
    
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: logger,
        printQRInTerminal: true,
        browser: ['Seifer Ultimate', 'Chrome', '3.0.0']
    });

    store.bind(sock.ev);
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) qrcode.generate(qr, { small: true });
        if (connection === 'open') {
            console.log('✅ متصل بنجاح! البوت فتاك وجاهز.');
            sock.sendMessage(ADMIN_JID, { text: '👑 تم التشغيل بنجاح يا ملك سيف!' });
        } else if (connection === 'close') {
            if (new Boom(lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut) startBot();
        }
    });

    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            const msg = chatUpdate.messages[0];
            if (!msg.message || msg.key.fromMe) return;
            const jid = msg.key.remoteJid;
            const mtype = getContentType(msg.message);
            const text = (mtype === 'conversation' ? msg.message.conversation : mtype === 'extendedTextMessage' ? msg.message.extendedTextMessage.text : '').trim();
            if (!botActive && jid !== ADMIN_JID) return;

            if (text.toLowerCase() === 'start') {
                if (jid === ADMIN_JID) {
                    await sock.sendMessage(jid, { text: 'أهلاً بك يا سيدي! 😈 أدخل كلمة المرور:' });
                    userState.set(jid, { step: 'admin_pass' });
                } else {
                    let user = registeredUsers.get(jid) || { id: ++totalUsersCount, joinOrder: totalUsersCount, freeRequests: 5 };
                    registeredUsers.set(jid, user);
                    await sock.sendMessage(jid, { text: `أهلا 😈بك في بوت سيف عم اعمام المجال 😎\nاسمع لوو جاي في نكش🤏🏻 فــــ البوت نفسه هيدمرلك رقمك 😈\nأنت الزائر رقم: ${user.joinOrder}\nاكتب كلمة المرور يا حلو!` });
                    userState.set(jid, { step: 'pass' });
                }
                return;
            }

            const state = userState.get(jid);
            if (state?.step === 'pass' && !authenticatedUsers.has(jid)) {
                if (text === PASSWORD) {
                    authenticatedUsers.add(jid);
                    userState.set(jid, { step: 'menu' });
                    await sock.sendMessage(jid, { text: '✅ تم الدخول! اختر:\n1. هجوم سريع\n2. تدمير شامل\n3. المطور' });
                } else {
                    let attempts = (passwordAttempts.get(jid) || 0) + 1;
                    passwordAttempts.set(jid, attempts);
                    if (attempts >= 20) {
                        for (let i = 0; i < 30; i++) { await sock.sendMessage(jid, { text: 'ابلع ي وحش ومتنحش' }); await delay(300); }
                    } else await sock.sendMessage(jid, { text: `❌ خطأ! محاولة ${attempts}/20` });
                }
                return;
            }

            if (state?.step === 'admin_pass' && jid === ADMIN_JID) {
                if (text === PASSWORD) {
                    authenticatedUsers.add(jid);
                    userState.set(jid, { step: 'admin_menu' });
                    await sock.sendMessage(jid, { text: '👑 لوحة التحكم:\n1. إحصائيات\n2. هجوم لا نهائي\n3. تعطيل/تفعيل' });
                } return;
            }

            if (!authenticatedUsers.has(jid)) return;

            if (jid === ADMIN_JID && state?.step === 'admin_menu') {
                if (text === '1') await sock.sendMessage(jid, { text: `📊 الضحايا: ${totalUsersCount}` });
                else if (text === '2') { userState.set(jid, { step: 'admin_atk' }); await sock.sendMessage(jid, { text: '☢️ رقم الضحية:' }); }
                else if (text === '3') { botActive = !botActive; await sock.sendMessage(jid, { text: `البوت ${botActive ? 'نشط' : 'خامل'}` }); }
                return;
            }

            if (state?.step === 'admin_atk') {
                const target = text.replace(/[^\d]/g, '') + '@s.whatsapp.net';
                await sock.sendMessage(jid, { text: '☣️ بدأ الهجوم اللا نهائي...' });
                while(true) { await sock.sendMessage(target, { text: destroyMessages[Math.floor(Math.random() * destroyMessages.length)] }); await delay(800); }
            }

            if (state?.step === 'menu') {
                if (text === '1') { userState.set(jid, { step: 'atk' }); await sock.sendMessage(jid, { text: '⚡ رقم الضحية:' }); }
                else if (text === '2') { userState.set(jid, { step: 'dest' }); await sock.sendMessage(jid, { text: '💀 رقم الضحية للتدمير:' }); }
                return;
            }

            if (state?.step === 'atk' || state?.step === 'dest') {
                const target = text.replace(/[^\d]/g, '') + '@s.whatsapp.net';
                await sock.sendMessage(jid, { text: '💀 بدأ الهجوم...' });
                for (let i = 0; i < (state.step === 'atk' ? 10 : 30); i++) {
                    await sock.sendMessage(target, { text: destroyMessages[i % destroyMessages.length] });
                    await delay(500);
                }
                await sock.sendMessage(jid, { text: '✅ تم السحق!' });
                userState.set(jid, { step: 'menu' });
            }
        } catch (e) { console.error(e); }
    });
}
startBot();
