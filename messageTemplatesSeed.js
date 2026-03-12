const { messageTemplates } = require('./database');

const templates = [
    // 1) Aviso de escala futura
    { category: 'escala_aviso', content: 'Oi {nome}, você foi escalado para:\n{lista_escalas}' },
    { category: 'escala_aviso', content: 'Olá {nome}, passando para avisar suas próximas escalas:\n{lista_escalas}' },
    { category: 'escala_aviso', content: '{nome}, suas próximas datas na escala são:\n{lista_escalas}' },
    { category: 'escala_aviso', content: 'Oi {nome}, você está na escala destes dias:\n{lista_escalas}' },
    { category: 'escala_aviso', content: '{nome}, segue sua escala atualizada:\n{lista_escalas}' },
    { category: 'escala_aviso', content: 'Olá {nome}, estas são suas próximas escalas:\n{lista_escalas}' },
    { category: 'escala_aviso', content: 'Oi {nome}, confira as datas em que você foi escalado:\n{lista_escalas}' },
    { category: 'escala_aviso', content: '{nome}, você foi incluído nas seguintes escalas:\n{lista_escalas}' },
    { category: 'escala_aviso', content: 'Olá {nome}, sua participação está confirmada nas datas:\n{lista_escalas}' },
    { category: 'escala_aviso', content: 'Oi {nome}, passando sua escala:\n{lista_escalas}' },
    { category: 'escala_aviso', content: '{nome}, anota aí suas próximas escalas:\n{lista_escalas}' },
    { category: 'escala_aviso', content: 'Olá {nome}, você ficou na escala para:\n{lista_escalas}' },
    { category: 'escala_aviso', content: 'Oi {nome}, segue a relação das suas próximas escalas:\n{lista_escalas}' },
    { category: 'escala_aviso', content: '{nome}, suas datas de escala são estas:\n{lista_escalas}' },
    { category: 'escala_aviso', content: 'Olá {nome}, você está programado para servir em:\n{lista_escalas}' },
    { category: 'escala_aviso', content: 'Oi {nome}, estas são as próximas escalas registradas para você:\n{lista_escalas}' },
    { category: 'escala_aviso', content: '{nome}, sua escala ficou assim:\n{lista_escalas}' },
    { category: 'escala_aviso', content: 'Olá {nome}, passando aqui suas próximas datas:\n{lista_escalas}' },
    { category: 'escala_aviso', content: 'Oi {nome}, você foi escalado nos seguintes eventos:\n{lista_escalas}' },
    { category: 'escala_aviso', content: '{nome}, confira abaixo suas próximas escalas:\n{lista_escalas}' },

    // 2) Lembrete 12 horas antes da escala
    { category: 'escala_lembrete_12h', content: 'Oi {nome}, lembrete da sua escala:\n{lista_escalas}' },
    { category: 'escala_lembrete_12h', content: 'Olá {nome}, passando para lembrar da sua escala em 12h:\n{lista_escalas}' },
    { category: 'escala_lembrete_12h', content: '{nome}, sua escala está chegando:\n{lista_escalas}' },
    { category: 'escala_lembrete_12h', content: 'Oi {nome}, não esqueça da sua escala:\n{lista_escalas}' },
    { category: 'escala_lembrete_12h', content: '{nome}, lembrete da sua função na escala:\n{lista_escalas}' },
    { category: 'escala_lembrete_12h', content: 'Olá {nome}, sua escala acontece em breve:\n{lista_escalas}' },
    { category: 'escala_lembrete_12h', content: 'Oi {nome}, só lembrando da sua participação:\n{lista_escalas}' },
    { category: 'escala_lembrete_12h', content: '{nome}, em 12 horas você estará escalado em:\n{lista_escalas}' },
    { category: 'escala_lembrete_12h', content: 'Oi {nome}, sua escala está confirmada para:\n{lista_escalas}' },
    { category: 'escala_lembrete_12h', content: 'Olá {nome}, atenção para sua escala:\n{lista_escalas}' },
    { category: 'escala_lembrete_12h', content: '{nome}, passando para lembrar seu compromisso:\n{lista_escalas}' },
    { category: 'escala_lembrete_12h', content: 'Oi {nome}, seu lembrete de escala é este:\n{lista_escalas}' },
    { category: 'escala_lembrete_12h', content: '{nome}, não perca sua escala:\n{lista_escalas}' },
    { category: 'escala_lembrete_12h', content: 'Olá {nome}, sua função de hoje está aqui:\n{lista_escalas}' },
    { category: 'escala_lembrete_12h', content: 'Oi {nome}, lembrando que você servirá em:\n{lista_escalas}' },
    { category: 'escala_lembrete_12h', content: '{nome}, sua escala está próxima. Segue o detalhe:\n{lista_escalas}' },
    { category: 'escala_lembrete_12h', content: 'Olá {nome}, faltam 12h para sua escala:\n{lista_escalas}' },
    { category: 'escala_lembrete_12h', content: 'Oi {nome}, este é seu lembrete:\n{lista_escalas}' },
    { category: 'escala_lembrete_12h', content: '{nome}, se organiza aí para sua escala:\n{lista_escalas}' },
    { category: 'escala_lembrete_12h', content: 'Oi {nome}, sua escala está chegando. Confira:\n{lista_escalas}' },

    // 3) Mensagem de aniversário
    { category: 'aniversario', content: 'Oi {nome}, feliz aniversário! Deus abençoe muito sua vida.' },
    { category: 'aniversario', content: 'Parabéns, {nome}! Que seu dia seja especial e abençoado.' },
    { category: 'aniversario', content: 'Oi {nome}, feliz aniversário! Muita paz, saúde e alegria.' },
    { category: 'aniversario', content: '{nome}, parabéns pelo seu dia! Muitas bênçãos para você.' },
    { category: 'aniversario', content: 'Feliz aniversário, {nome}! Que não faltem motivos para sorrir.' },
    { category: 'aniversario', content: 'Oi {nome}, parabéns! Que seu novo ciclo seja abençoado.' },
    { category: 'aniversario', content: '{nome}, feliz aniversário! Desejamos um dia cheio de alegria.' },
    { category: 'aniversario', content: 'Parabéns, {nome}! Que Deus conduza seu novo ano com graça.' },
    { category: 'aniversario', content: 'Oi {nome}, hoje é seu dia. Feliz aniversário!' },
    { category: 'aniversario', content: '{nome}, muitas felicidades no seu aniversário. Deus te abençoe!' },
    { category: 'aniversario', content: 'Feliz aniversário, {nome}! Que seu dia seja leve e feliz.' },
    { category: 'aniversario', content: 'Oi {nome}, parabéns pelo seu dia! Muitas bênçãos para você.' },
    { category: 'aniversario', content: '{nome}, feliz aniversário! Saúde, paz e um novo ciclo abençoado.' },
    { category: 'aniversario', content: 'Parabéns, {nome}! Que seu coração transborde alegria hoje.' },
    { category: 'aniversario', content: 'Oi {nome}, desejamos um feliz aniversário e um ano incrível.' },
    { category: 'aniversario', content: '{nome}, que seu aniversário seja cheio de alegria e bênçãos.' },
    { category: 'aniversario', content: 'Feliz aniversário, {nome}! Que Deus abençoe cada passo seu.' },
    { category: 'aniversario', content: 'Oi {nome}, parabéns! Aproveite muito seu dia.' },
    { category: 'aniversario', content: '{nome}, muitas felicidades hoje e sempre. Feliz aniversário!' },
    { category: 'aniversario', content: 'Oi {nome}, feliz aniversário! Que seu novo ciclo seja muito especial.' }
];

function runSeed() {
    try {
        const count = messageTemplates.count();
        if (count === 0) {
            console.log('Seeding message templates...');
            messageTemplates.insertMany(templates);
            console.log('Message templates seeded successfully.');
        }
    } catch (error) {
        console.error('Error seeding message templates:', error);
    }
}

module.exports = runSeed;
