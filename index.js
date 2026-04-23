const Baileys = require('@whiskeysockets/baileys');
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    DisconnectReason, 
    delay, 
    generateForwardMessageContent, 
    prepareWAMessageMedia, 
    generateWAMessageFromContent, 
    generateMessageID, 
    downloadContentFromMessage, 
    makeInMemoryStore, 
    jidDecode, 
    proto 
} = Baileys;
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const axios = require('axios');

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

// --- العبارات العربية (تم الحفاظ عليها وتطوير السياق) ---
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

// --- وظائف المساعدة ---
const logger = pino({ level: 'silent' });
const store = makeInMemoryStore({ logger });

async function startBot() {
    console.log('🔥 جاري تشغيل النسخة المطورة: SEIFER ULTIMATE V10...');
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: logger,
        printQRInTerminal: true,
        browser: ['Seifer Ultimate', 'Chrome', '3.0.0'],
        patchMessageBeforeSending: (message) => {
            const requiresPatch = !!(
                message.buttonsMessage ||
                message.templateMessage ||
                message.listMessage
            );
            if (requiresPatch) {
                message = {
                    viewOnceMessage: {
                        message: {
                            messageContextInfo: {
                                deviceListMetadata: {},
                                deviceListMetadataVersion: 2
                            },
                            ...message
                        }
                    }
                };
            }
            return message;
        }
    });

    store.bind(sock.ev);
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            console.log('✅ تم الاتصال بنجاح! البوت الآن فتاك وجاهز للعمل.');
        } else if (connection === 'close') {
            let reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
            console.log(`❌ انقطع الاتصال، السبب: ${reason}. جاري إعادة التشغيل...`);
            if (reason !== DisconnectReason.loggedOut) startBot();
        }
    });

    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            const msg = chatUpdate.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const jid = msg.key.remoteJid;
            const sender = msg.key.participant || msg.key.remoteJid;
            const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
            const lowerText = text.toLowerCase();

            // التحقق من حالة البوت
            if (!botActive && jid !== ADMIN_JID) return;

            // أمر البداية
            if (lowerText === 'start' || lowerText === '/start') {
                if (jid === ADMIN_JID) {
                    await sock.sendMessage(jid, { text: 'أهلاً بك يا سيدي وسيد هذا المجال! 😈\nأدخل كلمة المرور لتفعيل السيطرة الكاملة:' });
                    userState.set(jid, { step: 'admin_pass' });
                } else {
                    let user = registeredUsers.get(jid);
                    if (!user) {
                        totalUsersCount++;
                        user = { id: totalUsersCount, joinOrder: totalUsersCount, freeRequests: 5 };
                        registeredUsers.set(jid, user);
                    }
                    
                    const welcome = `أهلا 😈بك في بوت سيف عم اعمام المجال 😎\nاسمع لوو جاي في نكش🤏🏻 فــــ البوت نفسه هيدمرلك رقمك 😈\nخليك محترم عشان أنا بحب المحترم\n\nأنت الزائر رقم: ${user.joinOrder}\nلديك ${user.freeRequests} محاولات تدمير مجانية.\n\nاكتب كلمة المرور يا حلو علما بأن ٢٠ كلمة خطأه منك سيتم إرسال رسائل هجوميه عليك!`;
                    await sock.sendMessage(jid, { text: welcome });
                    userState.set(jid, { step: 'pass' });
                    passwordAttempts.set(jid, 0);
                }
                return;
            }

            const currentState = userState.get(jid);

            // نظام التحقق من كلمة المرور للمستخدمين العاديين
            if (currentState?.step === 'pass' && !authenticatedUsers.has(jid)) {
                if (text === PASSWORD) {
                    authenticatedUsers.add(jid);
                    userState.set(jid, { step: 'menu' });
                    await sock.sendMessage(jid, { text: '✅ تم إثبات الولاء! تم فتح قائمة التدمير:\n\n1. إرسال هجوم سريع ⚡\n2. ميزة تدمير الأخصام الشاملة 💀\n3. معلومات المطور 👨‍💻\n4. حالة حسابك 📊' });
                } else {
                    let attempts = (passwordAttempts.get(jid) || 0) + 1;
                    passwordAttempts.set(jid, attempts);
                    if (attempts >= 20) {
                        await sock.sendMessage(jid, { text: 'لقد تجاوزت الحد! ابلع ي وحش ومتنحش 😈🔥' });
                        // هجوم تلقائي
                        for (let i = 0; i < 50; i++) {
                            await sock.sendMessage(jid, { text: 'ابلع ي وحش ومتنحش' });
                            await delay(200);
                        }
                        passwordAttempts.set(jid, 0);
                    } else {
                        await sock.sendMessage(jid, { text: `❌ كلمة مرور خاطئة! المحاولة (${attempts}/20). انتبه لنفسك!` });
                    }
                }
                return;
            }

            // نظام التحقق للمدير
            if (currentState?.step === 'admin_pass' && jid === ADMIN_JID) {
                if (text === PASSWORD) {
                    authenticatedUsers.add(jid);
                    userState.set(jid, { step: 'admin_menu' });
                    await sock.sendMessage(jid, { 
                        text: '👑 لوحة تحكم الملك سيف 👑\n\n1. إحصائيات البوت 📈\n2. كشف الأرقام المسجلة 📋\n3. هجوم لا نهائي (قوة فتاكة) ☢️\n4. رسائل هجومية مخصصة 💣\n5. تعطيل/تفعيل البوت ⚙️\n6. إذاعة للمستخدمين 📢\n7. تصفير العدادات 🔄' 
                    });
                } else {
                    await sock.sendMessage(jid, { text: 'حتى أنت تخطئ؟ حاول مجدداً يا ملك.' });
                }
                return;
            }

            // إذا لم يكن المستخدم موثقاً، لا يكمل
            if (!authenticatedUsers.has(jid)) return;

            // قائمة المدير
            if (jid === ADMIN_JID && currentState?.step === 'admin_menu') {
                switch(text) {
                    case '1':
                        await sock.sendMessage(jid, { text: `📊 إحصائيات السيطرة:\n- إجمالي الضحايا: ${totalUsersCount}\n- رسائل الهجوم اليوم: ${dailyMessageCount}\n- حالة النظام: ${botActive ? 'نشط 🔥' : 'خامل ❄️'}` });
                        break;
                    case '2':
                        let list = "📋 الأرقام المسجلة في جحيمك:\n";
                        registeredUsers.forEach((u, k) => list += `- ${k} (طلب: ${u.freeRequests})\n`);
                        await sock.sendMessage(jid, { text: list });
                        break;
                    case '3':
                        userState.set(jid, { step: 'admin_atk_p' });
                        await sock.sendMessage(jid, { text: '☢️ أدخل رقم الضحية للهجوم اللا نهائي:' });
                        break;
                    case '4':
                        userState.set(jid, { step: 'admin_custom_p' });
                        await sock.sendMessage(jid, { text: '💣 أدخل الرقم المستهدف:' });
                        break;
                    case '5':
                        botActive = !botActive;
                        await sock.sendMessage(jid, { text: `⚙️ تم ${botActive ? 'تفعيل' : 'تعطيل'} البوت للعامة.` });
                        break;
                    case '6':
                        userState.set(jid, { step: 'admin_bc' });
                        await sock.sendMessage(jid, { text: '📢 أدخل نص الإذاعة لجميع المستخدمين:' });
                        break;
                }
                return;
            }

            // تنفيذ الهجوم اللا نهائي (للمدير)
            if (currentState?.step === 'admin_atk_p') {
                const target = text.replace(/[^\d]/g, '') + '@s.whatsapp.net';
                userState.set(jid, { step: 'admin_menu' });
                await sock.sendMessage(jid, { text: `☣️ بدأ الهجوم النووي على ${text}... لن يتوقف حتى تطلب ذلك.` });
                while(true) {
                    // التحقق إذا كان المدير يريد الإيقاف (يمكن تطوير آلية إيقاف هنا)
                    const msg = destroyMessages[Math.floor(Math.random() * destroyMessages.length)];
                    await sock.sendMessage(target, { text: msg });
                    dailyMessageCount++;
                    await delay(1000); 
                }
            }

            // قائمة المستخدم العادي
            if (currentState?.step === 'menu') {
                switch(text) {
                    case '1':
                        userState.set(jid, { step: 'quick_atk' });
                        await sock.sendMessage(jid, { text: '⚡ أدخل رقم الضحية لهجوم سريع:' });
                        break;
                    case '2':
                        const u = registeredUsers.get(jid);
                        if (u.freeRequests > 0) {
                            u.freeRequests--;
                            userState.set(jid, { step: 'dest_p' });
                            await sock.sendMessage(jid, { text: '💀 أدخل رقم الضحية للتدمير الشامل (احذر!):' });
                        } else {
                            await sock.sendMessage(jid, { text: '❌ نفدت محاولاتك المجانية! تواصل مع المطور لزيادتها.' });
                        }
                        break;
                    case '3':
                        await sock.sendMessage(jid, { text: `👨‍💻 المطور: سيف عم اعمام المجال\n📧 البريد: ${DEVELOPER_EMAIL}\nحقوق التطوير محفوظة 2024.` });
                        break;
                    case '4':
                        const user = registeredUsers.get(jid);
                        await sock.sendMessage(jid, { text: `📊 حالتك:\n- الرقم: ${jid.split('@')[0]}\n- المحاولات المتبقية: ${user.freeRequests}\n- الترتيب: ${user.joinOrder}` });
                        break;
                }
                return;
            }

            // تنفيذ التدمير للمستخدم
            if (currentState?.step === 'dest_p') {
                const target = text.replace(/[^\d]/g, '') + '@s.whatsapp.net';
                await sock.sendMessage(jid, { text: '💀 جاري استحضار القوى... بدأ التدمير الشامل!' });
                for (const m of destroyMessages) {
                    await sock.sendMessage(target, { text: m });
                    dailyMessageCount++;
                    await delay(400); // سرعة أكبر في الهجوم
                }
                await sock.sendMessage(jid, { text: '✅ تم سحق الضحية بنجاح!' });
                userState.set(jid, { step: 'menu' });
            }

        } catch (e) {
            console.error('⚠️ خطأ في المعالجة:', e);
        }
    });
}

// تشغيل البوت
startBot();
