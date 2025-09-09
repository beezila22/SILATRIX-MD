const axios = require('axios');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'downloader',
    description: 'Download media from various platforms',
    commands: ['ytmp4', 'ytmp3', 'igdl', 'fbdl', 'tiktok'],
    
    async execute(sock, msg, args, { sender, isGroup, config, reply }) {
        try {
            const command = msg.message.conversation?.split(' ')[0]?.slice(config.PREFIX.length) || 
                           msg.message.extendedTextMessage?.text?.split(' ')[0]?.slice(config.PREFIX.length);
            
            const url = args[0];
            
            if (!url) {
                return await reply('❌ Please provide a URL\nExample: ' + config.PREFIX + command + ' https://example.com');
            }
            
            await reply('⬇️ Downloading media... Please wait');
            
            let downloadUrl;
            
            switch(command) {
                case 'ytmp4':
                    downloadUrl = `https://ytdl.beezila.repl.co/download?url=${encodeURIComponent(url)}&type=video`;
                    break;
                case 'ytmp3':
                    downloadUrl = `https://ytdl.beezila.repl.co/download?url=${encodeURIComponent(url)}&type=audio`;
                    break;
                case 'igdl':
                    downloadUrl = `https://insta.beezila.repl.co/download?url=${encodeURIComponent(url)}`;
                    break;
                case 'fbdl':
                    downloadUrl = `https://fbdl.beezila.repl.co/download?url=${encodeURIComponent(url)}`;
                    break;
                case 'tiktok':
                    downloadUrl = `https://tiktok.beezila.repl.co/download?url=${encodeURIComponent(url)}`;
                    break;
                default:
                    return await reply('❌ Unsupported download type');
            }
            
            // For now, send the download link
            // In a real implementation, you would download and send the file
            await reply(`✅ Download ready: ${downloadUrl}\n\nNote: This is a demo. Implement actual download in your server.`);
            
        } catch (error) {
            console.error('Download error:', error);
            await reply('❌ Download failed. Please check the URL and try again.');
        }
    }
};
