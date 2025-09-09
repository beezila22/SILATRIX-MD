const { default: makeWASocket } = require('@whiskeysockets/baileys');

module.exports = {
    name: 'menu',
    description: 'Show advanced menu with all commands',
    commands: ['menu', 'help', 'm'],
    
    async execute(sock, msg, args, { sender, isGroup, isOwner, config, reply }) {
        try {
            const menuText = `
╔═══════════════════════╗
║    🤖 *${config.BOT_NAME}* 🤖    ║
║    *PLUGIN EDITION*   ║
╚═══════════════════════╝

📊 *BOT STATISTICS*
• 👑 Owner: ${config.BOT_OWNER.split('@')[0]}
• 🔌 Plugins: ${Array.from(require('../index').plugins.keys()).length}
• ⚡ Commands: ${Array.from(require('../index').commands.keys()).length}
• 🌐 Platform: ${config.PLATFORM}

╔═══════════════════════╗
║     📋 *COMMANDS*     ║
╚═══════════════════════╝

🎨 *MEDIA TOOLS*
• ${config.PREFIX}sticker - Create sticker from image
• ${config.PREFIX}toimg - Convert sticker to image
• ${config.PREFIX}emojimix - Mix two emojis
• ${config.PREFIX}attp - Create animated text

⬇️ *DOWNLOADERS*
• ${config.PREFIX}ytmp4 [url] - Download YouTube video
• ${config.PREFIX}ytmp3 [url] - Download YouTube audio
• ${config.PREFIX}igdl [url] - Download Instagram media
• ${config.PREFIX}fbdl [url] - Download Facebook video
• ${config.PREFIX}tiktok [url] - Download TikTok video

🤖 *AI CHAT*
• ${config.PREFIX}ai [question] - Chat with AI
• ${config.PREFIX}gpt [question] - GPT-3.5 turbo
• ${config.PREFIX}gemini [question] - Google Gemini

👥 *GROUP MANAGEMENT*
• ${config.PREFIX}kick @user - Remove user from group
• ${config.PREFIX}add @user - Add user to group
• ${config.PREFIX}promote @user - Make user admin
• ${config.PREFIX}demote @user - Remove admin
• ${config.PREFIX}group open/close - Change group settings

🎮 *FUN & GAMES*
• ${config.PREFIX}quote - Random quote
• ${config.PREFIX}fact - Interesting fact
• ${config.PREFIX}joke - Funny joke
• ${config.PREFIX}math - Math calculation
• ${config.PREFIX}roll - Roll dice

⚙️ *BOT CONTROLS*
• ${config.PREFIX}ping - Check bot response
• ${config.PREFIX}speed - Bot speed test
• ${config.PREFIX}owner - Contact owner
• ${config.PREFIX}report [issue] - Report problem

🔧 *OWNER ONLY*
• ${config.PREFIX}restart - Restart bot
• ${config.PREFIX}reload - Reload plugins
• ${config.PREFIX}broadcast [msg] - Broadcast message
• ${config.PREFIX}exec [code] - Execute code

╔═══════════════════════╗
║     📱 *SOCIALS*      ║
╚═══════════════════════╝

• YouTube: ${process.env.YOUTUBE || 'https://youtube.com/@silatrix22'}
• Group: ${process.env.WHATSAPP_GROUP || 'https://chat.whatsapp.com/FJaYH3HS1rv5pQeGOmKtbM'}
• Channel: ${process.env.WHATSAPP_CHANNEL || 'https://whatsapp.com/channel/0029Vb6DeKwCHDygxt0RXh0L'}

🔰 *Prefix:* [ ${config.PREFIX} ]
            `;

            await reply(menuText);
        } catch (error) {
            console.error('Menu error:', error);
            await reply('❌ Error showing menu');
        }
    }
};
