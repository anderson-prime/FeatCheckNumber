const express = require('express');
const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app = express();
const port = 3000;

// Middleware para medir tempo de resposta
app.use((req, res, next) => {
    req.startTime = Date.now();
    next();
});

app.use(express.json());

const client = new Client({
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    console.log('QR RECEIVED');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Cliente do WhatsApp está pronto!');
});

client.on('authenticated', (session) => {
    console.log('Autenticado com sucesso!');
});

client.on('auth_failure', (msg) => {
    console.error('Falha na autenticação:', msg);
});

client.on('disconnected', (reason) => {
    console.log('Cliente desconectado:', reason);
    console.log('Reiniciando cliente...');
    client.initialize();
});

function formatPhoneNumber(phoneNumber, defaultCountryCode = '55') {
    let cleaned = phoneNumber.replace(/\D/g, '');

    if (cleaned.startsWith('0')) {
        cleaned = cleaned.substring(1);
    }

    if (!cleaned.startsWith(defaultCountryCode) && cleaned.length >= 10 && cleaned.length <= 11) {
        cleaned = defaultCountryCode + cleaned;
    }

    return cleaned;
}

app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'API WhatsApp Check Contact',
        dados: {
            status: client.info ? 'Conectado' : 'Aguardando QR Code',
            endpoints: [
                { method: 'POST', path: '/check-contact', description: 'Verifica se número é contato WhatsApp' },
                { method: 'GET', path: '/check-contact?phone=NUMERO', description: 'Verifica via GET' },
                { method: 'GET', path: '/status', description: 'Status da conexão' }
            ],
            timestamp: new Date().toISOString()
        }
    });
});

app.get('/status', (req, res) => {
    res.json({
        success: true,
        message: 'Status da conexão WhatsApp',
        dados: {
            isReady: !!client.info,
            isAuthenticated: client.authState ? client.authState : 'unknown',
            timestamp: new Date().toISOString()
        }
    });
});

app.post('/check-contact', async (req, res) => {
    try {
        let { phoneNumber, countryCode = '55', numero, ddd, ddi } = req.body;

        if (numero) {
            ddi = ddi || '55';
            ddd = ddd || '';
            phoneNumber = `${ddi}${ddd}${numero}`;
            countryCode = ddi;
        }

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Número de telefone é obrigatório (envie "phoneNumber" ou objeto com "numero", "ddd", "ddi")',
                dados: null
            });
        }

        if (!/^[\d\s\+\-\(\)]+$/.test(phoneNumber)) {
            return res.status(400).json({
                success: false,
                message: 'Número de telefone contém caracteres inválidos',
                dados: null
            });
        }

        let formattedNumber;
        try {
            formattedNumber = formatPhoneNumber(phoneNumber, countryCode);

            if (formattedNumber.length < 10 || formattedNumber.length > 15) {
                return res.status(400).json({
                    success: false,
                    message: 'Número deve ter entre 10 e 15 dígitos',
                    dados: null
                });
            }
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: 'Erro ao formatar número: ' + error.message,
                dados: null
            });
        }

        if (!client.info) {
            return res.status(503).json({
                success: false,
                message: 'Cliente do WhatsApp não está pronto. Aguarde a autenticação.',
                dados: {
                    qrNeeded: true,
                    status: 'waiting_authentication',
                    timestamp: new Date().toISOString()
                }
            });
        }

        const checkPromise = client.getNumberId(formattedNumber);
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout ao verificar contato')), 10000);
        });

        const contactId = await Promise.race([checkPromise, timeoutPromise]);

        let contactInfo = null;
        if (contactId) {
            try {
                contactInfo = await client.getContactById(contactId._serialized);
            } catch (error) {
                console.log('Não foi possível obter detalhes do contato:', error.message);
            }
        }

        const responseTime = Date.now() - req.startTime;

        return res.json({
            success: true,
            message: contactId ? 'Contato válido do WhatsApp' : 'Contato não encontrado',
            dados: {
                isWhatsAppContact: !!contactId,
                phoneNumber: formattedNumber,
                contactId: contactId ? contactId._serialized : null,
                contactDetails: contactInfo ? {
                    name: contactInfo.name || contactInfo.pushname || null,
                    isBusiness: contactInfo.isBusiness || false,
                    isEnterprise: contactInfo.isEnterprise || false,
                    isUser: contactInfo.isUser || false,
                    isGroup: contactInfo.isGroup || false,
                    isMe: contactInfo.isMe || false
                } : null,
                metadata: {
                    originalNumber: phoneNumber,
                    countryCode: countryCode,
                    formattedNumber: formattedNumber,
                    length: formattedNumber.length,
                    validation: 'valid'
                },
                timestamp: new Date().toISOString(),
                responseTime: responseTime + 'ms'
            }
        });

    } catch (error) {
        console.error('Erro ao verificar contato:', error);

        if (error.message.includes('Timeout')) {
            return res.status(504).json({
                success: false,
                message: 'Tempo limite excedido ao verificar contato',
                dados: {
                    errorType: 'timeout',
                    timestamp: new Date().toISOString(),
                    retryAfter: 30
                }
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Erro ao verificar contato',
            dados: {
                errorType: 'internal_error',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined,
                timestamp: new Date().toISOString()
            }
        });
    }
});

app.get('/check-contact', async (req, res) => {
    try {
        const { phone } = req.query;

        if (!phone) {
            return res.status(400).json({
                success: false,
                message: 'Parâmetro "phone" é obrigatório (ex: ?phone=6282391269)',
                dados: null
            });
        }

        const phoneNumber = phone;
        const countryCode = '55';

        if (!/^[\d\s\+\-\(\)]+$/.test(phoneNumber)) {
            return res.status(400).json({
                success: false,
                message: 'Número de telefone contém caracteres inválidos',
                dados: null
            });
        }

        let formattedNumber;
        try {
            formattedNumber = formatPhoneNumber(phoneNumber, countryCode);

            if (formattedNumber.length < 10 || formattedNumber.length > 15) {
                return res.status(400).json({
                    success: false,
                    message: 'Número deve ter entre 10 e 15 dígitos',
                    dados: null
                });
            }
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: 'Erro ao formatar número: ' + error.message,
                dados: null
            });
        }

        if (!client.info) {
            return res.status(503).json({
                success: false,
                message: 'Cliente do WhatsApp não está pronto. Aguarde a autenticação.',
                dados: {
                    qrNeeded: true,
                    status: 'waiting_authentication',
                    timestamp: new Date().toISOString()
                }
            });
        }

        const checkPromise = client.getNumberId(formattedNumber);
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout ao verificar contato')), 10000);
        });

        const contactId = await Promise.race([checkPromise, timeoutPromise]);

        let contactInfo = null;
        if (contactId) {
            try {
                contactInfo = await client.getContactById(contactId._serialized);
            } catch (error) {
                console.log('Não foi possível obter detalhes do contato:', error.message);
            }
        }

        const responseTime = Date.now() - req.startTime;

        return res.json({
            success: true,
            message: contactId ? 'Contato válido do WhatsApp' : 'Contato não encontrado',
            dados: {
                isWhatsAppContact: !!contactId,
                phoneNumber: formattedNumber,
                contactId: contactId ? contactId._serialized : null,
                contactDetails: contactInfo ? {
                    name: contactInfo.name || contactInfo.pushname || null,
                    isBusiness: contactInfo.isBusiness || false,
                    isEnterprise: contactInfo.isEnterprise || false,
                    isUser: contactInfo.isUser || false,
                    isGroup: contactInfo.isGroup || false,
                    isMe: contactInfo.isMe || false
                } : null,
                metadata: {
                    originalNumber: phoneNumber,
                    countryCode: countryCode,
                    formattedNumber: formattedNumber,
                    length: formattedNumber.length,
                    validation: 'valid'
                },
                timestamp: new Date().toISOString(),
                responseTime: responseTime + 'ms'
            }
        });

    } catch (error) {
        console.error('Erro na rota GET:', error);

        if (error.message.includes('Timeout')) {
            return res.status(504).json({
                success: false,
                message: 'Tempo limite excedido ao verificar contato',
                dados: {
                    errorType: 'timeout',
                    timestamp: new Date().toISOString(),
                    retryAfter: 30
                }
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            dados: {
                errorType: 'internal_error',
                timestamp: new Date().toISOString()
            }
        });
    }
});

// Inicializar cliente
console.log('Inicializando cliente do WhatsApp...');
client.initialize();

// Iniciar servidor
app.listen(port, () => {
    console.log(`✅ Servidor rodando em http://localhost:${port}`);
    console.log(`📱 Aguardando autenticação do WhatsApp...`);
    console.log(`\n📋 Exemplos de uso:`);
    console.log(`1. POST: curl -X POST http://localhost:${port}/check-contact \\`);
    console.log(`   -H "Content-Type: application/json" \\`);
    console.log(`   -d '{"numero": "912345678", "ddd": "62", "ddi": "55"}'`);
    console.log(`\n2. GET:  curl "http://localhost:${port}/check-contact?phone=6282391269"`);
});

process.on('SIGINT', () => {
    console.log('\nEncerrando servidor...');
    client.destroy();
    process.exit(0);
});