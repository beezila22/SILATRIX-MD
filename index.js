# Futa index.js ya zamani
rm -f index.js

# Weka index.js mpya yenye feature control
cat > index.js << 'EOF'
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
    
    // Auto Features - Default values
    ALWAYS_ONLINE: process.env.ALWAYS_ONLINE === 'true',
    AUTO_TYPING: process.env.AUTO_TYPING === 'true',
    AUTO_RECORD: process.env.AUTO_RECORD === 'true',
    AUTO_VIEW_STATUS: process.env.AUTO_VIEW_STATUS === 'true',
    AUTO_LIKE_STATUS: process.env.AUTO_LIKE_STATUS === 'true',
    AUTO_REACT: process.env.AUTO_REACT === 'true',
    AUTO_VIEW_STORY: process.env.AUTO_VIEW_STORY === 'true',
    ANTLINK: process.env.ANTLINK === 'true',
    
    // Custom Links
    WHATSAPP_GROUP: process.env.WHATSAPP_GROUP || "https://chat.whatsapp.com/FJaYH3HS1rv5pQeGOmKtbM",
    WHATSAPP_CHANNEL: process.env.WHATSAPP_CHANNEL || "https://whatsapp.com/channel/0029Vb6DeKwCHDygxt0RXh0L",
    YOUTUBE_CHANNEL: process.env.YOUTUBE_CHANNEL || "https://youtube.com/@silatrix22",
    GITHUB_REPO: process.env.GITHUB_REPO || "https://github.com/silatrix2/SILATRIX-XMD",
    PAIR_CODE_SITE: process.env.PAIR_CODE_SITE || "https://beezila.onrender.com",
    
    // Media Files
    MENU_IMAGE: process.env.MENU_IMAGE || "https://i.ibb.co.com/0QZ1q1C/silatrix-logo.png",
    OWNER_IMAGE: process.env.OWNER_IMAGE || "https://i.ibb.co.com/0QZ1q1C/silatrix-logo.png",
    REPO_IMAGE: process.env.REPO_IMAGE || "https://i.ibb.co.com/0QZ1q1C/silatrix-logo.png",
    ALIVE_IMAGE: process.env.ALIVE_IMAGE || "https://i.ibb.co.com/0QZ1q1C/silatrix-logo.png"
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
let linkedDevices = new Set();

// Feature State Storage
const featureState = {
    autoreact: config.AUTO_REACT,
    autotyping: config.AUTO_TYPING,
    alwaysonline: config.ALWAYS_ONLINE,
    antilink: config.ANTLINK,
    autorecord: config.AUTO_RECORD,
    autoviewstatus: config.AUTO_VIEW_STATUS
};

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
        plugin: chalk.cyanBright,
        link: chalk.yellowBright,
        feature: chalk.magentaBright
    };
    console.log(colors[type](`[${timestamp}] ${message}`));
};

// Save feature state to file
const saveFeatureState = () => {
    const stateFile = './feature_state.json';
    fs.writeFileSync(stateFile, JSON.stringify(featureState, null, 2));
    log('Feature state saved', 'feature');
};

// Load feature state from file
const loadFeatureState = () => {
    const stateFile = './feature_state.json';
    if (fs.existsSync(stateFile)) {
        const savedState = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
        Object.assign(featureState, savedState);
        log('Feature state loaded', 'feature');
    }
};

// Dynamic Plugin Loader
const loadPlugins = () => {
    const pluginsDir = path.join(__dirname, 'plugins');
    
    if (!fs.existsSync(pluginsDir)) {
        fs.mkdirSync(pluginsDir, { recursive: true });
        log('Created plugins directory', 'plugin');
        return;
    }

    try {
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
                delete require.cache[require.resolve(pluginPath)];
                
                const plugin = require(pluginPath);
                
                if (plugin && typeof plugin === 'object') {
                    const pluginName = plugin.name || path.basename(file, '.js');
                    
                    plugins.set(pluginName, {
                        ...plugin,
                        file: file,
                        path: pluginPath
                    });

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
                    }),
                    sendImage: (url, caption) => sock.sendMessage(sender, {
                        image: { url: url },
                        caption: caption
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

// Feature Control Commands
const handleFeatureControl = async (command, args, sender) => {
    const feature = args[0]?.toLowerCase();
    const action = args[1]?.toLowerCase();
    
    if (!feature || !action) {
        await sock.sendMessage(sender, { 
            text: `❌ Usage: ${config.PREFIX}feature <featurename> <on/off>\nExample: ${config.PREFIX}feature autoreact off` 
        });
        return true;
    }

    if (!['on', 'off'].includes(action)) {
        await sock.sendMessage(sender, { 
            text: '❌ Action must be "on" or "off"' 
        });
        return true;
    }

    const featuresList = {
        'autoreact': 'Auto React',
        'autotyping': 'Auto Typing', 
        'alwaysonline': 'Always Online',
        'antilink': 'Anti Link',
        'autorecord': 'Auto Record',
        'autoviewstatus': 'Auto View Status'
    };

    if (!featuresList[feature]) {
        await sock.sendMessage(sender, { 
            text: `❌ Unknown feature. Available: ${Object.keys(featuresList).join(', ')}` 
        });
        return true;
    }

    // Update feature state
    featureState[feature] = action === 'on';
    saveFeatureState();

    await sock.sendMessage(sender, { 
        text: `✅ ${featuresList[feature]} turned ${action.toUpperCase()}` 
    });

    log(`Feature ${feature} turned ${action} by ${sender}`, 'feature');
    return true;
};

// Show Feature Status
const showFeatureStatus = async (sender) => {
    const statusText = `
⚙️ *FEATURE STATUS*

• Auto React: ${featureState.autoreact ? '🟢 ON' : '🔴 OFF'}
• Auto Typing: ${featureState.autotyping ? '🟢 ON' : '🔴 OFF'}
• Always Online: ${featureState.alwaysonline ? '🟢 ON' : '🔴 OFF'}
• Anti Link: ${featureState.antilink ? '🟢 ON' : '🔴 OFF'}
• Auto Record: ${featureState.autorecord ? '🟢 ON' : '🔴 OFF'}
• Auto View Status: ${featureState.autoviewstatus ? '🟢 ON' : '🔴 OFF'}

💡 Use: ${config.PREFIX}feature <name> <on/off>
Example: ${config.PREFIX}feature autoreact off
    `;

    await sock.sendMessage(sender, { text: statusText });
};

// Send Welcome Message to Linked Devices
const sendWelcomeMessage = async (jid) => {
    try {
        const welcomeMessage = `
🌟 *WELCOME TO SILATRIX XMD BOT!* 🌟

🤖 *Bot Name:* ${config.BOT_NAME}
🔰 *Prefix:* ${config.PREFIX}

📋 *Available Features:*
• Status Save & Send
• Group Management  
• AI ChatBot
• Media Downloader
• Anti-Delete
• ViewOnce Reader
• Fun Commands
• Auto Reacts
• Status Replies

⚙️ *Feature Control:* Use ${config.PREFIX}feature to turn on/off features

🌐 *Important Links:*
• WhatsApp Group: ${config.WHATSAPP_GROUP}
• WhatsApp Channel: ${config.WHATSAPP_CHANNEL}
• YouTube: ${config.YOUTUBE_CHANNEL}
• GitHub Repo: ${config.GITHUB_REPO}
• Pair Code Site: ${config.PAIR_CODE_SITE}

🔧 *Bot Developed By:* SILATRIX
🎯 *Version:* 5.0.0 Ultimate
        `;

        await sock.sendMessage(jid, { text: welcomeMessage });
        
        if (config.MENU_IMAGE) {
            await sock.sendMessage(jid, {
                image: { url: config.MENU_IMAGE },
                caption: "🎨 Bot Menu Preview"
            });
        }

        log(`Sent welcome message to ${jid}`, 'link');

    } catch (error) {
        log(`Welcome message error: ${error.message}`, 'error');
    }
};

// Always Online Feature
const startAlwaysOnline = () => {
    if (featureState.alwaysonline && sock) {
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
    } else if (onlineInterval) {
        clearInterval(onlineInterval);
        log('🔴 Always Online feature deactivated', 'auto');
    }
};

// Auto React to Messages
const autoReact = async (msg) => {
    if (featureState.autoreact && sock && msg.key.fromMe === false) {
        try {
            const reactions = ['❤️', '🔥', '👍', '🎉', '😂', '😍', '🤩', '🥰'];
            const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
            
            await sock.sendMessage(msg.key.remoteJid, {
                react: { text: randomReaction, key: msg.key }
            });
            
            log(`Reacted with ${randomReaction} to message`, 'auto');
        } catch (error) {
            log(`Auto React error: ${error.message}`, 'error');
        }
    }
};

// Auto Typing Indicator
const startAutoTyping = async (msg) => {
    if (featureState.autotyping && sock && msg.key.fromMe === false) {
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
    if (featureState.antilink && sock && msg.key.fromMe === false) {
        try {
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const urls = text.match(urlRegex);
            
            if (urls && urls.length > 0) {
                await sock.sendMessage(msg.key.remoteJid, {
                    text: `⚠️ Links are not allowed here! Please avoid sharing links.`,
                    mentions: [msg.key.participant || msg.key.remoteJid]
                });
                
                log(`Detected link from ${msg.key.remoteJid}`, 'auto');
            }
        } catch (error) {
            log(`Anti Link error: ${error.message}`, 'error');
        }
    }
};

// Handle Linked Devices
const handleLinkedDevices = async (update) => {
    try {
        if (update.connection === 'open' && update.qr === undefined) {
            const deviceJid = sock.user?.id;
            if (deviceJid && !linkedDevices.has(deviceJid)) {
                linkedDevices.add(deviceJid);
                await sendWelcomeMessage(deviceJid);
            }
        }
    } catch (error) {
        log(`Linked devices handler error: ${error.message}`, 'error');
    }
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
        handleLinkedDevices({ connection: 'open' });
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
        handleLinkedDevices({ connection: 'open' });
        startAutoFeatures();
        startMessageHandling();
    }
};

// Start all auto features
const startAutoFeatures = () => {
    log('🚀 Starting auto features...', 'auto');
    startAlwaysOnline();
};

// Stop all auto features
const stopAutoFeatures = () => {
    if (onlineInterval) clearInterval(onlineInterval);
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
    
    console.log('\n🎉 BOT IS NOW LIVE WITH FEATURE CONTROL!');
    console.log('📝 Send "' + config.PREFIX + 'menu" for commands');
    console.log('⚙️  Send "' + config.PREFIX + 'feature" to control features');
};

// Message Handler with Feature Control
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
            
            // Feature control commands
            if (command === 'feature' || command === 'features') {
                if (args.length === 0) {
                    await showFeatureStatus(sender);
                    return true;
                }
                const handled = await handleFeatureControl(command, args, sender);
                if (handled) return true;
            }
            
            // Try plugin commands first
            const handledByPlugin = await handlePluginCommand(command, args, msg, sender);
            if (handledByPlugin) return;
            
            // Built-in commands
            if (command === 'ping') {
                await sock.sendMessage(sender, { text: '🏓 Pong!' });
            }
            else if (command === 'menu' || command === 'help' || command === 'start') {
                await showAwesomeMenu(sender);
            }
            else if (command === 'plugins') {
                await showPluginsList(sender);
            }
            else if (command === 'owner') {
                await showOwnerInfo(sender);
            }
            else if (command === 'repo') {
                await showRepoInfo(sender);
            }
            else if (command === 'alive') {
                await showAliveStatus(sender);
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
                await sock.sendMessage(sender, { text: `❌ Unknown command: ${command}\nType ${config.PREFIX}menu for commands` });
            }
        }
        
    } catch (error) {
        log(`Error handling message: ${error.message}`, 'error');
    }
};

// Show Awesome Menu
const showAwesomeMenu = async (sender) => {
    try {
        if (config.MENU_IMAGE) {
            await sock.sendMessage(sender, {
                image: { url: config.MENU_IMAGE },
                caption: `🎨 *${config.BOT_NAME} MENU*`
            });
        }

        const menuText = `
🌟 *${config.BOT_NAME} ULTIMATE MENU* 🌟

🔰 *Prefix:* ${config.PREFIX}
🤖 *Version:* 5.0.0 Feature Control

📦 *CORE FEATURES:*
• Status Save + Send
• Group Management
• AI ChatBot
• Media Downloader
• Anti-Delete
• ViewOnce Reader
• Fun Commands
• Status Reply
• Auto Reacts
• Heart Reacts

⚙️ *FEATURE CONTROL:*
• ${config.PREFIX}feature - Show feature status
• ${config.PREFIX}feature <name> <on/off> - Control features
• Example: ${config.PREFIX}feature autoreact off

🚀 *QUICK COMMANDS:*
• ${config.PREFIX}menu - This menu
• ${config.PREFIX}owner - Bot owner info
• ${config.PREFIX}repo - GitHub repository
• ${config.PREFIX}alive - Bot status
• ${config.PREFIX}plugins - Loaded plugins

🌐 *IMPORTANT LINKS:*
• WhatsApp Group: ${config.WHATSAPP_GROUP}
• WhatsApp Channel: ${config.WHATSAPP_CHANNEL}
• YouTube: ${config.YOUTUBE_CHANNEL}
• GitHub: ${config.GITHUB_REPO}
• Pair Code: ${config.PAIR_CODE_SITE}

🔧 *Developed By:* SILATRIX
🎯 *The Ultimate WhatsApp Bot Solution*
        `;

        await sock.sendMessage(sender, { text: menuText });

    } catch (error) {
        await sock.sendMessage(sender, { text: "📋 Menu is available! Check your media tab." });
    }
};

// Show Owner Info
const showOwnerInfo = async (sender) => {
    try {
        if (config.OWNER_IMAGE) {
            await sock.sendMessage(sender, {
                image: { url: config.OWNER_IMAGE },
                caption: "👑 *BOT OWNER*"
            });
        }

        const ownerInfo = `
👑 *BOT OWNER INFORMATION*

• Name: SILATRIX
• Number: wa.me/${config.BOT_OWNER.split('@')[0]}
• Role: Bot Developer

🌐 *Social Links:*
• WhatsApp Group: ${config.WHATSAPP_GROUP}
• Channel: ${config.WHATSAPP_CHANNEL}
• YouTube: ${config.YOUTUBE_CHANNEL}

💼 *For business inquiries or bot development, contact the owner!*
        `;

        await sock.sendMessage(sender, { text: ownerInfo });

    } catch (error) {
        log(`Owner info error: ${error.message}`, 'error');
    }
};

// Show Repo Info
const showRepoInfo = async (sender) => {
    try {
        if (config.REPO_IMAGE) {
            await sock.sendMessage(sender, {
                image: { url: config.REPO_IMAGE },
                caption: "💻 *GITHUB REPOSITORY*"
            });
        }

        const repoInfo = `
💻 *GITHUB REPOSITORY*

📁 Repository: ${config.GITHUB_REPO}
🌟 Stars: ⭐⭐⭐⭐⭐
🔧 Status: Active Development

🚀 *Features:*
• Multi-Platform Support
• Plugin System
• Feature Control
• Easy Deployment
• Regular Updates

📖 *How to Deploy:*
1. Visit ${config.PAIR_CODE_SITE}
2. Get your session code
3. Deploy to Heroku/Railway
4. Enjoy your bot!

🔗 *Direct Link:* ${config.GITHUB_REPO}
        `;

        await sock.sendMessage(sender, { text: repoInfo });

    } catch (error) {
        log(`Repo info error: ${error.message}`, 'error');
    }
};

// Show Alive Status
const showAliveStatus = async (sender) => {
    try {
        if (config.ALIVE_IMAGE) {
            await sock.sendMessage(sender, {
                image: { url: config.ALIVE_IMAGE },
                caption: "✅ *BOT IS ALIVE AND RUNNING*"
            });
        }

        const aliveInfo = `
✅ *BOT STATUS: ALIVE*

🤖 Bot Name: ${config.BOT_NAME}
🕒 Uptime: ${process.uptime().toFixed(0)} seconds
📊 Platform: ${config.PLATFORM}
🔌 Plugins: ${plugins.size}
⚡ Commands: ${commands.size}

🌐 *Deployment Links:*
• Heroku: Ready
• Railway: Ready  
• Replit: Ready
• Panel: Ready
• Termux: Ready (Background)

💪 *System Status:* Optimal
🎯 *Performance:* Excellent

🔧 *Maintained By:* SILATRIX
        `;

        await sock.sendMessage(sender, { text: aliveInfo });

    } catch (error) {
        log(`Alive status error: ${error.message}`, 'error');
    }
};

// Show Plugins List
const showPluginsList = async (sender) => {
    const pluginList = Array.from(plugins.keys()).join('\n• ');
    const pluginsInfo = `
📦 *LOADED PLUGINS* (${plugins.size})

• ${pluginList || 'No plugins loaded'}

💡 *How to add plugins:*
1. Place plugin files in 'plugins' folder
2. Use ${config.PREFIX}reload to refresh
3. Enjoy new features!

🔧 *Default Plugins Included:*
• Status Saver, Group Manager, AI ChatBot, Downloader
        `;
    await sock.sendMessage(sender, { text: pluginsInfo });
};

// Health server for platforms
const startHealthServer = () => {
    const http = require('http');
    
    const server = http.createServer((req, res) => {
        if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                status: 'ok', 
                connected: isConnected,
                auth_method: authMethod,
                platform: config.PLATFORM,
                plugins_loaded: plugins.size,
                commands_available: commands.size,
                features: featureState
            }));
        } else {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('🤖 Silatrix Ultimate Bot with Feature Control is Running...');
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
        console.log('🤖 SILATRIX BOT - FEATURE CONTROL EDITION');
        console.log('='.repeat(60));
        
        // Load feature state and plugins
        loadFeatureState();
        loadPlugins();
        
        // Auto-select auth method based on platform
        if (process.env.PLATFORM === 'termux') {
            authMethod = 'qr';
            log('Termux detected, using QR code authentication', 'platform');
        } else {
            authMethod = config.AUTH_METHOD;
        }
        
        log(`Using authentication method: ${authMethod}`, 'info');
        
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
EOF

echo "✅ index.js imebadilishwa kikamilifu na Feature Control!"