const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason,
    jidNormalizedUser,
    downloadContentFromMessage,
    proto
} = require('@whiskeysockets/baileys');
const P = require('pino');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const readline = require('readline');

// Load environment variables
require('dotenv').config();

// Bot Configuration from Environment Variables
const config = {
    BOT_OWNER: process.env.BOT_OWNER || "255789661031@s.whatsapp.net",
    BOT_NAME: process.env.BOT_NAME || "Silatrix Bot",
    PREFIX: process.env.PREFIX || ".",
    SESSION_ID: process.env.SESSION_ID || "silatrix_pro_bot",
    AUTO_READ: process.env.AUTO_READ !== 'false',
    PORT: process.env.PORT || 3000,
    PLATFORM: process.env.PLATFORM || 'unknown',
    AUTH_METHOD: process.env.AUTH_METHOD || 'qr',
    
    // Auto Features
    ALWAYS_ONLINE: process.env.ALWAYS_ONLINE === 'true',
    AUTO_TYPING: process.env.AUTO_TYPING === 'true',
    AUTO_RECORD: process.env.AUTO_RECORD === 'true',
    AUTO_VIEW_STATUS: process.env.AUTO_VIEW_STATUS === 'true',
    AUTO_LIKE_STATUS: process.env.AUTO_LIKE_STATUS === 'true',
    AUTO_REACT: process.env.AUTO_REACT === 'true',
    AUTO_VIEW_STORY: process.env.AUTO_VIEW_STORY === 'true',
    ANTLINK: process.env.ANTLINK === 'true'
};

// Global variables
let sock;
let qrGenerated = false;
let isConnected = false;
let authMethod = config.AUTH_METHOD;
let onlineInterval;
let statusViewerInterval;
let plugins = new Map();
let commands = new Map();

// Utility Functions
const log = (message, type = 'info') => {
    const timestamp = new Date().toLocaleString();
    const colors = {
        info: chalk.blue,
        success: chalk.green,
        warning: chalk.yellow,
        error: chalk.red,
        platform: chalk.magenta,
        pair: chalk.cyan,
        auto: chalk.greenBright,
        plugin: chalk.cyanBright
    };
    console.log(colors[type](`[${timestamp}] ${message}`));
};

// Dynamic Plugin Loader
const loadPlugins = () => {
    const pluginsDir = path.join(__dirname, 'plugins');
    
    // Create plugins directory if it doesn't exist
    if (!fs.existsSync(pluginsDir)) {
        fs.mkdirSync(pluginsDir, { recursive: true });
        log('Created plugins directory', 'plugin');
        return;
    }

    try {
        // Clear previous plugins and commands
        plugins.clear();
        commands.clear();

        const pluginFiles = fs.readdirSync(pluginsDir).filter(file => 
            file.endsWith('.js') && !file.startsWith('_')
        );

        let loadedCount = 0;
        let commandCount = 0;

        pluginFiles.forEach(file => {
            try {
                const pluginPath = path.join(pluginsDir, file);
                
                // Clear require cache for hot reload
                delete require.cache[require.resolve(pluginPath)];
                
                const plugin = require(pluginPath);
                
                if (plugin && typeof plugin === 'object') {
                    const pluginName = plugin.name || path.basename(file, '.js');
                    
                    // Register plugin
                    plugins.set(pluginName, {
                        ...plugin,
                        file: file,
                        path: pluginPath
                    });

                    // Register commands if available
                    if (plugin.commands && Array.isArray(plugin.commands)) {
                        plugin.commands.forEach(cmd => {
                            commands.set(cmd.toLowerCase(), pluginName);
                            commandCount++;
                        });
                    }

                    log(`Loaded plugin: ${pluginName}`, 'plugin');
                    loadedCount++;
                }
            } catch (error) {
                log(`Error loading plugin ${file}: ${error.message}`, 'error');
            }
        });

        log(`Loaded ${loadedCount} plugins with ${commandCount} commands`, 'success');

    } catch (error) {
        log(`Error reading plugins directory: ${error.message}`, 'error');
    }
};

// Plugin Command Handler
const handlePluginCommand = async (command, args, msg, sender) => {
    const pluginName = commands.get(command.toLowerCase());
    
    if (pluginName && plugins.has(pluginName)) {
        const plugin = plugins.get(pluginName);
        
        try {
            if (typeof plugin.execute === 'function') {
                await plugin.execute(sock, msg, args, {
                    sender: sender,
                    isGroup: sender.endsWith('@g.us'),
                    isOwner: sender === config.BOT_OWNER,
                    config: config,
                    log: log,
                    reply: (text) => sock.sendMessage(sender, { text }),
                    replyWithMention: (text) => sock.sendMessage(sender, { 
                        text: text,
                        mentions: [sender]
                    })
                });
                return true;
            }
        } catch (error) {
            log(`Error executing plugin ${pluginName}: ${error.message}`, 'error');
            await sock.sendMessage(sender, { 
                text: `❌ Error executing command: ${error.message}` 
            });
        }
    }
    
    return false;
};

// Create interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Always Online Feature
const startAlwaysOnline = () => {
    if (config.ALWAYS_ONLINE && sock) {
        log('🟢 Always Online feature activated', 'auto');
        onlineInterval = setInterval(async () => {
            try {
                await sock.sendPresenceUpdate('available');
                if (Math.random() > 0.8) {
                    await sock.sendPresenceUpdate('composing');
                    setTimeout(() => sock.sendPresenceUpdate('available'), 2000);
                }
            } catch (error) {
                log(`Always Online error: ${error.message}`, 'error');
            }
        }, 60000);
    }
};

// Auto React to Messages
const autoReact = async (msg) => {
    if (config.AUTO_REACT && sock && msg.key.fromMe === false) {
        try {
            const reactions = ['❤️', '🔥', '👍', '🎉', '😂'];
            const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
            
            await sock.sendMessage(msg.key.remoteJid, {
                react: { text: randomReaction, key: msg.key }
            });
        } catch (error) {
            log(`Auto React error: ${error.message}`, 'error');
        }
    }
};

// Auto Typing Indicator
const startAutoTyping = async (msg) => {
    if (config.AUTO_TYPING && sock && msg.key.fromMe === false) {
        try {
            await sock.sendPresenceUpdate('composing', msg.key.remoteJid);
            setTimeout(() => sock.sendPresenceUpdate('available', msg.key.remoteJid), 2000);
        } catch (error) {
            log(`Auto Typing error: ${error.message}`, 'error');
        }
    }
};

// Anti Link Feature
const checkAntiLink = async (msg) => {
    if (config.ANTLINK && sock && msg.key.fromMe === false) {
        try {
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const urls = text.match(urlRegex);
            
            if (urls && urls.length > 0) {
                await sock.sendMessage(msg.key.remoteJid, {
                    text: `⚠️ Links are not allowed here!`,
                    mentions: [msg.key.participant || msg.key.remoteJid]
                });
            }
        } catch (error) {
            log(`Anti Link error: ${error.message}`, 'error');
        }
    }
};

// Ask user to choose auth method
const askAuthMethod = () => {
    return new Promise((resolve) => {
        console.log('\n' + '='.repeat(60));
        console.log('🤖 SILATRIX BOT - CHOOSE AUTHENTICATION METHOD');
        console.log('='.repeat(60));
        console.log('1. QR Code Authentication (Default)');
        console.log('2. Pair Code Authentication');
        console.log('='.repeat(60));
        
        rl.question('Choose option (1 or 2): ', (answer) => {
            resolve(answer.trim() === '2' ? 'pair' : 'qr');
        });
    });
};

// QR Code Authentication
const startQRAuth = async () => {
    log('Starting QR Code authentication...', 'info');
    
    const sessionPath = './sessions';
    if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        auth: state,
        logger: P({ level: 'silent' }),
        browser: ['SILATRIX Bot', 'Chrome', '1.0.0'],
        markOnlineOnConnect: true,
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', handleQRAuthConnection);
};

// Pair Code Authentication  
const startPairAuth = async () => {
    log('Starting Pair Code authentication...', 'pair');
    
    const sessionPath = './sessions_pair';
    if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        auth: state,
        logger: P({ level: 'silent' }),
        browser: ['SILATRIX Pair', 'Chrome', '1.0.0'],
        markOnlineOnConnect: false,
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', handlePairConnection);
};

// QR Code Connection Handler
const handleQRAuthConnection = async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr && !qrGenerated) {
        qrGenerated = true;
        
        console.log('\n' + '='.repeat(65));
        console.log('📱 SILATRIX BOT - QR CODE AUTHENTICATION');
        console.log('🌐 Platform: ' + config.PLATFORM);
        console.log('⏰ QR Code Valid for 2 Minutes');
        console.log('='.repeat(65));
        
        qrcode.generate(qr, { small: true });
        
        console.log('='.repeat(65));
        log('Scan QR code quickly!', 'warning');
        
        setTimeout(() => {
            if (sock && !sock.user && !isConnected) {
                qrGenerated = false;
                console.log('\n🔄 Generating new QR code...');
                startQRAuth();
            }
        }, 120000);
    }
    
    if (connection === 'close') {
        isConnected = false;
        stopAutoFeatures();
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        
        if (shouldReconnect) {
            log('Connection closed, reconnecting...', 'warning');
            setTimeout(() => startQRAuth(), 3000);
        } else {
            log('Session expired. Generating new QR...', 'error');
            setTimeout(() => startQRAuth(), 5000);
        }
    } else if (connection === 'open') {
        isConnected = true;
        log('✅ Connected via QR successfully!', 'success');
        startAutoFeatures();
        startMessageHandling();
    }
};

// Pair Code Connection Handler
const handlePairConnection = async (update) => {
    const { connection, lastDisconnect, isNewLogin, qr } = update;
    
    if (isNewLogin) {
        console.log('\n' + '='.repeat(65));
        console.log('📱 SILATRIX BOT - PAIR CODE AUTHENTICATION');
        console.log('🌐 Platform: ' + config.PLATFORM);
        console.log('🔢 Check your WhatsApp for pair code notification');
        console.log('='.repeat(65));
        log('Waiting for pair code approval...', 'pair');
    }
    
    if (connection === 'close') {
        isConnected = false;
        stopAutoFeatures();
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        
        if (shouldReconnect) {
            log('Connection closed, reconnecting...', 'warning');
            setTimeout(() => startPairAuth(), 3000);
        } else {
            log('Pairing failed. Restarting...', 'error');
            setTimeout(() => startPairAuth(), 5000);
        }
    } else if (connection === 'open') {
        isConnected = true;
        log('✅ Connected via Pair Code successfully!', 'success');
        startAutoFeatures();
        startMessageHandling();
    }
};

// Start all auto features
const startAutoFeatures = () => {
    log('🚀 Starting all auto features...', 'auto');
    startAlwaysOnline();
};

// Stop all auto features
const stopAutoFeatures = () => {
    if (onlineInterval) clearInterval(onlineInterval);
    if (statusViewerInterval) clearInterval(statusViewerInterval);
    log('Auto features stopped', 'auto');
};

// Start message handling after connection
const startMessageHandling = () => {
    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            await handleMessage(msg);
            await autoReact(msg);
            await startAutoTyping(msg);
            await checkAntiLink(msg);
        }
    });
    
    console.log('\n🎉 BOT IS NOW LIVE WITH PLUGINS SUPPORT!');
    console.log('📝 Send "' + config.PREFIX + 'help" for commands');
};

// Message Handler with Plugin Support
const handleMessage = async (msg) => {
    try {
        if (!msg.message) return;
        
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const sender = jidNormalizedUser(msg.key.remoteJid);
        
        if (msg.key.fromMe) return;
        
        // Auto read messages
        if (config.AUTO_READ) {
            await sock.readMessages([msg.key]);
        }
        
        // Command processing
        if (text.startsWith(config.PREFIX)) {
            const args = text.slice(config.PREFIX.length).trim().split(' ');
            const command = args.shift().toLowerCase();
            
            // Try plugin commands first
            const handledByPlugin = await handlePluginCommand(command, args, msg, sender);
            if (handledByPlugin) return;
            
            // Built-in commands
            if (command === 'ping') {
                await sock.sendMessage(sender, { text: '🏓 Pong!' });
            }
            else if (command === 'help' || command === 'menu') {
                await showHelpMenu(sender);
            }
            else if (command === 'plugins') {
                await showPluginsList(sender);
            }
            else if (command === 'reload' && sender === config.BOT_OWNER) {
                loadPlugins();
                await sock.sendMessage(sender, { text: '🔄 Plugins reloaded successfully!' });
            }
            else if (command === 'restart' && sender === config.BOT_OWNER) {
                await sock.sendMessage(sender, { text: '🔄 Restarting bot...' });
                process.exit(0);
            }
            else {
                await sock.sendMessage(sender, { text: `❌ Unknown command: ${command}\nType ${config.PREFIX}help for available commands` });
            }
        }
        
    } catch (error) {
        log(`Error handling message: ${error.message}`, 'error');
    }
};

// Show Help Menu
const showHelpMenu = async (sender) => {
    const commandList = Array.from(commands.keys()).join(', ');
    const menu = `
🤖 ${config.BOT_NAME}
📍 Auth Method: ${authMethod.toUpperCase()}
🔰 Prefix: ${config.PREFIX}

📋 BUILT-IN COMMANDS:
• ${config.PREFIX}ping - Test bot response
• ${config.PREFIX}help - Show this menu
• ${config.PREFIX}plugins - Show loaded plugins
• ${config.PREFIX}reload - Reload plugins (Owner)
• ${config.PREFIX}restart - Restart bot (Owner)

🔌 PLUGIN COMMANDS:
${commandList || 'No plugin commands loaded'}

👑 Owner: wa.me/${config.BOT_OWNER.split('@')[0]}
    `;
    await sock.sendMessage(sender, { text: menu });
};

// Show Plugins List
const showPluginsList = async (sender) => {
    const pluginList = Array.from(plugins.keys()).join('\n• ');
    const pluginsInfo = `
📦 LOADED PLUGINS (${plugins.size}):

• ${pluginList || 'No plugins loaded'}

💡 Add plugins in the 'plugins' folder and use ${config.PREFIX}reload
    `;
    await sock.sendMessage(sender, { text: pluginsInfo });
};

// Health server for platforms
const startHealthServer = () => {
    const http = require('http');
    
    const server = http.createServer((req, res) => {
        if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': : 'application/json' });
            res.end(JSON.stringify({ 
                status: 'ok', 
                connected: isConnected,
                auth_method: authMethod,
                platform: config.PLATFORM,
                plugins_loaded: plugins.size,
                commands_available: commands.size
            }));
        } else {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('🤖 Silatrix Bot with Plugin Support is Running...');
        }
    });
    
    server.listen(config.PORT, () => {
        log(`Health server running on port ${config.PORT}`, 'platform');
    });
};

// Main function
async function startBot() {
    try {
        console.log('\n' + '='.repeat(60));
        console.log('🤖 SILATRIX BOT - PLUGIN SUPPORT EDITION');
        console.log('='.repeat(60));
        
        // Load plugins first
        loadPlugins();
        
        // Ask for auth method if not set
        if (process.argv.includes('--qr')) {
            authMethod = 'qr';
        } else if (process.argv.includes('--pair')) {
            authMethod = 'pair';
        } else if (process.stdin.isTTY) {
            authMethod = await askAuthMethod();
        }
        
        log(`Selected authentication method: ${authMethod}`, 'info');
        
        // Start health server for platforms
        startHealthServer();
        
        // Start selected auth method
        if (authMethod === 'pair') {
            await startPairAuth();
        } else {
            await startQRAuth();
        }
        
        // Handle process exit
        process.on('SIGINT', () => {
            log('Shutting down bot...', 'warning');
            stopAutoFeatures();
            process.exit(0);
        });
        
    } catch (error) {
        log(`Error starting bot: ${error.message}`, 'error');
        setTimeout(() => startBot(), 5000);
    }
}

// Start the bot
startBot();
