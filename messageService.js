const axios = require('axios');
const { db, messageTemplates, messageHistory, whatsappInstances, members } = require('./database');

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';

// Helper to format date "YYYY-MM-DD" to "DD/MM"
function formatEventDate(dateStr) {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}`;
}

// Helper to choose a template avoiding recent ones
function pickTemplate(memberId, category) {
    const templates = messageTemplates.getAllByCategory(category);
    if (!templates || templates.length === 0) return null;

    const recentIds = messageHistory.getRecentByMemberAndCategory(memberId, category, 3).map(h => h.template_id);
    
    // Filter out recent templates if possible
    const available = templates.filter(t => !recentIds.includes(t.id));
    
    // If all templates were used recently, fallback to all
    const pool = available.length > 0 ? available : templates;
    
    // Pick random
    const randomIndex = Math.floor(Math.random() * pool.length);
    return pool[randomIndex];
}

async function sendWhatsAppMessage(phone, text) {
    // Basic phone sanitization
    let cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('55') && cleanPhone.length <= 11) {
        cleanPhone = '55' + cleanPhone;
    }
    
    // Find active whatsapp instance
    const instances = whatsappInstances.getAll();
    const activeInstance = instances.find(i => i.status === 'open');
    
    if (!activeInstance) {
        console.warn('Nenhuma instância do WhatsApp conectada. Mensagem não enviada.');
        return false;
    }

    try {
        await axios.post(`${EVOLUTION_API_URL}/message/sendText/${activeInstance.name}`, {
            number: cleanPhone,
            text: text
        }, {
            headers: {
                'apikey': activeInstance.apikey || process.env.EVOLUTION_API_KEY,
                'Content-Type': 'application/json'
            }
        });
        return true;
    } catch (e) {
        console.error(`Erro ao enviar WhatsApp para ${cleanPhone}:`, e.message);
        return false;
    }
}

// 1. Send Aviso Escalas Futuras
async function sendAvisoEscalasFuturas(memberId) {
    const member = members.getById(memberId);
    if (!member || !member.phone) return;

    // Get future scales
    const scalesQuery = db.prepare(`
        SELECT 
            te.event_date,
            te.event_name,
            t.name as team_name,
            ts.name as funcao
        FROM scale_assignments sa
        JOIN team_events te ON sa.event_id = te.id
        JOIN teams t ON sa.team_id = t.id
        JOIN team_subdivisions ts ON sa.subdivision_id = ts.id
        WHERE sa.member_id = ?
          AND date(te.event_date) >= date('now')
        ORDER BY te.event_date ASC
    `);
    const scales = scalesQuery.all(memberId);
    if (scales.length === 0) return;

    let listaText = scales.map(s => `${formatEventDate(s.event_date)} - ${s.event_name} - ${s.team_name} - ${s.funcao}`).join('\n');

    const template = pickTemplate(memberId, 'escala_aviso');
    if (!template) return;

    let content = template.content
        .replace(/{nome}/g, member.name.split(' ')[0])
        .replace(/{lista_escalas}/g, listaText);

    const sent = await sendWhatsAppMessage(member.phone, content);
    if (sent) {
        messageHistory.create({
            member_id: memberId,
            category: 'escala_aviso',
            template_id: template.id,
            event_id: null
        });
    }
}

// 2. Cron: Send Lembretes 12h
async function cronLembretes12h() {
    const now = new Date();
    const in11h = new Date(now.getTime() + 11 * 60 * 60 * 1000);
    const in12h30 = new Date(now.getTime() + 12.5 * 60 * 60 * 1000); // Give some margin

    const upcomingQuery = db.prepare(`
        SELECT 
            sa.member_id,
            sa.event_id,
            te.event_date,
            te.event_time,
            te.event_name,
            t.name as team_name,
            ts.name as funcao,
            m.name as member_name,
            m.phone
        FROM scale_assignments sa
        JOIN team_events te ON sa.event_id = te.id
        JOIN teams t ON sa.team_id = t.id
        JOIN team_subdivisions ts ON sa.subdivision_id = ts.id
        JOIN members m ON sa.member_id = m.id
        WHERE date(te.event_date) >= date('now')
          AND m.phone IS NOT NULL AND m.phone != ''
    `);

    const allUpcoming = upcomingQuery.all();

    for (const scale of allUpcoming) {
        if (!scale.event_time) continue;
        const [year, month, day] = scale.event_date.split('-');
        const [hour, minute] = scale.event_time.split(':');
        const eventDateTime = new Date(year, month - 1, day, hour, minute);

        // Check if event is between 11h and 12.5h from now
        if (eventDateTime >= in11h && eventDateTime <= in12h30) {
            // Check if already sent
            if (messageHistory.hasSentReminder(scale.member_id, scale.event_id, 'escala_lembrete_12h')) {
                continue;
            }

            const template = pickTemplate(scale.member_id, 'escala_lembrete_12h');
            if (!template) continue;

            let linhaDaEscala = `${formatEventDate(scale.event_date)} - ${scale.event_name} - ${scale.team_name} - ${scale.funcao}`;
            let content = template.content
                .replace(/{nome}/g, scale.member_name.split(' ')[0])
                .replace(/{lista_escalas}/g, linhaDaEscala)
                .replace(/{data_evento}/g, formatEventDate(scale.event_date))
                .replace(/{nome_evento}/g, scale.event_name)
                .replace(/{nome_equipe}/g, scale.team_name)
                .replace(/{funcao}/g, scale.funcao);

            const sent = await sendWhatsAppMessage(scale.phone, content);
            if (sent) {
                messageHistory.create({
                    member_id: scale.member_id,
                    category: 'escala_lembrete_12h',
                    template_id: template.id,
                    event_id: scale.event_id
                });
            }
        }
    }
}

// 3. Cron: Send Aniversarios
async function cronAniversarios() {
    const today = new Date();
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
    const currentDay = String(today.getDate()).padStart(2, '0');
    const todayStr = `-${currentMonth}-${currentDay}`;

    const bdayQuery = db.prepare(`
        SELECT id, name, phone, birth_date
        FROM members
        WHERE birth_date LIKE ? AND phone IS NOT NULL AND phone != ''
    `);
    const birthdays = bdayQuery.all(`%${todayStr}`);

    const currentYear = today.getFullYear().toString();

    for (const member of birthdays) {
        if (messageHistory.hasSentBirthdayThisYear(member.id, currentYear)) {
            continue;
        }

        const template = pickTemplate(member.id, 'aniversario');
        if (!template) continue;

        let content = template.content.replace(/{nome}/g, member.name.split(' ')[0]);

        const sent = await sendWhatsAppMessage(member.phone, content);
        if (sent) {
            messageHistory.create({
                member_id: member.id,
                category: 'aniversario',
                template_id: template.id,
                event_id: null
            });
        }
    }
}

// 4. Triggered when member is created/updated
async function checkAndSendBirthdayOnSave(memberId) {
    const member = members.getById(memberId);
    if (!member || !member.birth_date || !member.phone) return;

    const today = new Date();
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
    const currentDay = String(today.getDate()).padStart(2, '0');
    
    // Check if birth_date matches today
    const [, bMonth, bDay] = member.birth_date.split('-');
    if (bMonth !== currentMonth || bDay !== currentDay) return;

    // Time validation (between 07:30 and 22:00)
    const currentHour = today.getHours();
    const currentMinute = today.getMinutes();
    const fractionalHour = currentHour + (currentMinute / 60);

    if (fractionalHour < 7.5 || fractionalHour > 22.0) {
        console.log(`[Aniversário] Fora do horário comercial (7:30 - 22:00). Nenhuma msg enviada agora para ${member.name}.`);
        return;
    }

    const currentYear = today.getFullYear().toString();

    // Check if already sent
    if (messageHistory.hasSentBirthdayThisYear(memberId, currentYear)) {
        return;
    }

    const template = pickTemplate(memberId, 'aniversario');
    if (!template) return;

    let content = template.content.replace(/{nome}/g, member.name.split(' ')[0]);

    const sent = await sendWhatsAppMessage(member.phone, content);
    if (sent) {
        messageHistory.create({
            member_id: memberId,
            category: 'aniversario',
            template_id: template.id,
            event_id: null
        });
    }
}

module.exports = {
    sendWhatsAppMessage,
    sendAvisoEscalasFuturas,
    cronLembretes12h,
    cronAniversarios,
    checkAndSendBirthdayOnSave
};
