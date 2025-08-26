// Polyfill for ReadableStream and File if not available
if (typeof globalThis.ReadableStream === 'undefined') {
    const { ReadableStream } = require('web-streams-polyfill/ponyfill');
    globalThis.ReadableStream = ReadableStream;
}

if (typeof globalThis.File === 'undefined') {
    try {
        const { File } = require('undici');
        globalThis.File = File;
    } catch (e) {
        // Fallback File implementation
        globalThis.File = class File {
            constructor(chunks, name, options = {}) {
                this.name = name;
                this.type = options.type || '';
                this.lastModified = options.lastModified || Date.now();
                this.chunks = chunks;
            }
        };
    }
}

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { DisTube } = require('distube');
const { YouTubePlugin } = require('@distube/youtube');
const { SpotifyPlugin } = require('@distube/spotify');
const fs = require('fs');
const http = require('http');

// Đọc config từ environment hoặc file
let config;
if (process.env.DISCORD_TOKEN) {
    // Production: đọc từ environment variables
    config = {
        token: process.env.DISCORD_TOKEN,
        prefix: process.env.PREFIX || '!',
        clientId: process.env.CLIENT_ID || ''
    };
    console.log('📡 Using environment variables for config');
} else {
    // Development: đọc từ file config.json
    try {
        config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
        console.log('📁 Using config.json file');
    } catch (error) {
        console.error('❌ Không tìm thấy file config.json! Vui lòng tạo file config.json từ config.example.json');
        process.exit(1);
    }
}

// Tạo client Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// Tạo DisTube instance với YouTube và Spotify plugins
const distube = new DisTube(client, {
    plugins: [
        new YouTubePlugin(),
        new SpotifyPlugin()
    ],
    ffmpeg: {
        path: require('ffmpeg-static')
    },
    ytdlOptions: {
        quality: 'highestaudio',
        filter: 'audioonly',
        dlChunkSize: 0,
        highWaterMark: 1 << 25
    }
});

// Hàm kiểm tra URL YouTube
function isValidYouTubeUrl(url) {
    const regex = /^(https?\:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    return regex.test(url);
}

// Hàm kiểm tra URL Spotify
function isValidSpotifyUrl(url) {
    const regex = /^(https?\:\/\/)?(open\.)?spotify\.com\/(track|album|playlist|artist)\/.+/;
    return regex.test(url);
}

// Hàm nhận diện loại URL
function getUrlType(url) {
    if (isValidYouTubeUrl(url)) return 'YouTube';
    if (isValidSpotifyUrl(url)) return 'Spotify';
    return 'Unknown';
}

// Event khi bot sẵn sàng
client.once('ready', () => {
    console.log(`✅ Bot đã sẵn sàng! Đăng nhập với tên: ${client.user.tag}`);
    client.user.setActivity('🎵 YouTube & Spotify Music', { type: 'LISTENING' });
});

// DisTube Events
distube
    .on('playSong', (queue, song) => {
        console.log(`🎵 Playing: ${song.name}`);
        console.log(`Voice channel: ${queue.voiceChannel?.name}`);
        console.log(`Connection state: ${queue.voice?.connection?.state?.status}`);
        
        // Auto shuffle logic - when queue restarts and auto shuffle is enabled
        if (queue.autoShuffle && queue.repeatMode === 2 && queue.songs.indexOf(song) === 0 && queue.songs.length > 1) {
            // Shuffle when starting the queue again (first song plays)
            setTimeout(() => {
                if (queue.songs.length > 1) {
                    queue.shuffle();
                    queue.textChannel.send('🔀 **Auto shuffle:** Đã trộn lại queue cho vòng lặp mới!');
                }
            }, 2000); // Delay 2s để tránh conflict
        }

        const embed = new EmbedBuilder()
            .setTitle('🎵 Đang phát')
            .setDescription(`**${song.name}**`)
            .setColor('#00ff00')
            .setThumbnail(song.thumbnail)
            .addFields(
                { name: 'Thời lượng', value: song.formattedDuration, inline: true },
                { name: 'Người yêu cầu', value: song.user.toString(), inline: true },
                { name: 'Views', value: song.views?.toLocaleString() || 'N/A', inline: true }
            )
            .setURL(song.url);

        // Add repeat and shuffle status if enabled
        if (queue.repeatMode > 0 || queue.autoShuffle) {
            const statusTexts = [];
            if (queue.repeatMode === 1) statusTexts.push('🔁 Repeat Song');
            if (queue.repeatMode === 2) statusTexts.push('🔁 Repeat Queue');
            if (queue.autoShuffle) statusTexts.push('🔀 Auto Shuffle');
            
            if (statusTexts.length > 0) {
                embed.addFields({ name: 'Trạng thái', value: statusTexts.join(' • '), inline: false });
            }
        }

        queue.textChannel.send({ embeds: [embed] });
    })
    .on('addSong', (queue, song) => {
        const embed = new EmbedBuilder()
            .setTitle('✅ Đã thêm vào queue')
            .setDescription(`**${song.name}**`)
            .setColor('#0099ff')
            .setThumbnail(song.thumbnail)
            .addFields(
                { name: 'Thời lượng', value: song.formattedDuration, inline: true },
                { name: 'Vị trí trong queue', value: `${queue.songs.length}`, inline: true },
                { name: 'Người yêu cầu', value: song.user.toString(), inline: true }
            )
            .setURL(song.url);

        queue.textChannel.send({ embeds: [embed] });
    })
    .on('addList', (queue, playlist) => {
        const embed = new EmbedBuilder()
            .setTitle('📝 Đã thêm playlist')
            .setDescription(`**${playlist.name}**`)
            .setColor('#1db954')
            .setThumbnail(playlist.thumbnail)
            .addFields(
                { name: 'Số bài hát', value: `${playlist.songs.length}`, inline: true },
                { name: 'Người yêu cầu', value: playlist.user.toString(), inline: true },
                { name: 'Nguồn', value: playlist.source || 'Unknown', inline: true }
            )
            .setURL(playlist.url);

        queue.textChannel.send({ embeds: [embed] });
    })
    .on('error', (channel, error) => {
        console.error('DisTube Error:', error);
        if (channel) {
            channel.send('❌ Có lỗi xảy ra khi phát nhạc! Vui lòng thử lại.');
        }
    })
    .on('empty', (queue) => {
        queue.textChannel.send('⏹️ Voice channel trống, bot đã rời khỏi channel!');
    })
    .on('finish', (queue) => {
        queue.textChannel.send('🎶 Queue đã hết! Bot sẽ rời voice channel.');
    })
    .on('disconnect', (queue) => {
        queue.textChannel.send('⏹️ Bot đã ngắt kết nối khỏi voice channel!');
    })
    .on('noRelated', (queue) => {
        queue.textChannel.send('🔍 Không tìm thấy bài hát liên quan!');
    });

// Event xử lý tin nhắn
client.on('messageCreate', async (message) => {
    // Bỏ qua tin nhắn từ bot
    if (message.author.bot) return;
    
    // Kiểm tra prefix
    if (!message.content.startsWith(config.prefix)) return;

    const args = message.content.slice(config.prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Kiểm tra xem user có trong voice channel không (cho các lệnh cần voice)
    const voiceCommands = ['play', 'p'];
    if (voiceCommands.includes(command)) {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply('❌ Bạn phải vào voice channel trước!');
        }
    }

    switch (command) {
        case 'play':
        case 'p':
            if (!args[0]) {
                return message.reply('❌ Vui lòng cung cấp URL (YouTube/Spotify) hoặc tên bài hát!');
            }

            const query = args.join(' ');
            
            // Hiển thị thông báo đang xử lý cho Spotify
            let processingMessage;
            if (isValidSpotifyUrl(query)) {
                processingMessage = await message.reply('🎵 Đang xử lý Spotify URL...');
            }
            
            try {
                await distube.play(message.member.voice.channel, query, {
                    member: message.member,
                    textChannel: message.channel,
                    message
                });
                
                // Xóa thông báo đang xử lý nếu có
                if (processingMessage) {
                    processingMessage.delete().catch(() => {});
                }
            } catch (error) {
                console.error('Play Error:', error);
                
                // Xóa thông báo đang xử lý nếu có
                if (processingMessage) {
                    processingMessage.delete().catch(() => {});
                }
                
                const urlType = getUrlType(query);
                let errorMsg = '❌ Không thể phát nhạc! ';
                
                if (urlType === 'Spotify') {
                    errorMsg += 'Kiểm tra lại Spotify URL hoặc thử URL khác.';
                } else if (urlType === 'YouTube') {
                    errorMsg += 'Kiểm tra lại YouTube URL hoặc thử URL khác.';
                } else {
                    errorMsg += 'Vui lòng kiểm tra lại URL hoặc thử tìm kiếm bài khác.';
                }
                
                message.reply(errorMsg);
            }
            break;

        case 'skip':
        case 's':
            const queue = distube.getQueue(message.guild.id);
            if (!queue) {
                return message.reply('❌ Không có bài hát nào đang phát!');
            }

            try {
                await distube.skip(message.guild.id);
                message.reply('⏭️ Đã skip bài hát!');
            } catch (error) {
                message.reply('❌ Không thể skip bài hát!');
            }
            break;

        case 'stop':
            const stopQueue = distube.getQueue(message.guild.id);
            if (!stopQueue) {
                return message.reply('❌ Không có bài hát nào đang phát!');
            }

            try {
                await distube.stop(message.guild.id);
                message.reply('⏹️ Đã dừng phát nhạc và xóa queue!');
            } catch (error) {
                message.reply('❌ Không thể dừng phát nhạc!');
            }
            break;

        case 'queue':
        case 'q':
            const queueList = distube.getQueue(message.guild.id);
            if (!queueList) {
                return message.reply('❌ Queue trống!');
            }

            const songs = queueList.songs;
            let queueText = '';
            
            // Bài đang phát
            if (songs[0]) {
                queueText += `**🎵 Đang phát:**\n${songs[0].name} - \`${songs[0].formattedDuration}\`\n\n`;
            }

            // Queue
            if (songs.length > 1) {
                queueText += '**📝 Queue:**\n';
                const queueSongs = songs.slice(1, 11); // Hiển thị tối đa 10 bài
                queueSongs.forEach((song, index) => {
                    queueText += `${index + 1}. ${song.name} - \`${song.formattedDuration}\`\n`;
                });
                
                if (songs.length > 11) {
                    queueText += `\n*...và ${songs.length - 11} bài khác*`;
                }
            }

            const queueEmbed = new EmbedBuilder()
                .setTitle('🎵 Music Queue')
                .setDescription(queueText || 'Queue trống')
                .setColor('#0099ff')
                .addFields(
                    { name: 'Tổng số bài', value: `${songs.length}`, inline: true },
                    { name: 'Tổng thời lượng', value: queueList.formattedDuration, inline: true }
                );

            message.channel.send({ embeds: [queueEmbed] });
            break;

        case 'nowplaying':
        case 'np':
            const npQueue = distube.getQueue(message.guild.id);
            if (!npQueue) {
                return message.reply('❌ Không có bài hát nào đang phát!');
            }

            const currentSong = npQueue.songs[0];
            const nowPlayingEmbed = new EmbedBuilder()
                .setTitle('🎵 Đang phát')
                .setDescription(`**${currentSong.name}**`)
                .setColor('#00ff00')
                .setThumbnail(currentSong.thumbnail)
                .addFields(
                    { name: 'Thời lượng', value: currentSong.formattedDuration, inline: true },
                    { name: 'Tiến độ', value: npQueue.formattedCurrentTime, inline: true },
                    { name: 'Người yêu cầu', value: currentSong.user.toString(), inline: true },
                    { name: 'Views', value: currentSong.views?.toLocaleString() || 'N/A', inline: true },
                    { name: 'Volume', value: `${npQueue.volume}%`, inline: true }
                )
                .setURL(currentSong.url);

            message.channel.send({ embeds: [nowPlayingEmbed] });
            break;

        case 'volume':
        case 'vol':
            const volQueue = distube.getQueue(message.guild.id);
            if (!volQueue) {
                return message.reply('❌ Không có bài hát nào đang phát!');
            }

            const volume = parseInt(args[0]);
            if (isNaN(volume) || volume < 0 || volume > 100) {
                return message.reply('❌ Volume phải là số từ 0 đến 100!');
            }

            try {
                distube.setVolume(message.guild.id, volume);
                message.reply(`🔊 Đã đặt volume thành ${volume}%!`);
            } catch (error) {
                message.reply('❌ Không thể thay đổi volume!');
            }
            break;

        case 'pause':
            const pauseQueue = distube.getQueue(message.guild.id);
            if (!pauseQueue) {
                return message.reply('❌ Không có bài hát nào đang phát!');
            }

            if (pauseQueue.paused) {
                distube.resume(message.guild.id);
                message.reply('▶️ Đã tiếp tục phát nhạc!');
            } else {
                distube.pause(message.guild.id);
                message.reply('⏸️ Đã tạm dừng phát nhạc!');
            }
            break;

        case 'shuffle':
        case 'mix':
            const shuffleQueue = distube.getQueue(message.guild.id);
            if (!shuffleQueue) {
                return message.reply('❌ Không có queue nào để trộn!');
            }

            if (shuffleQueue.songs.length <= 1) {
                return message.reply('❌ Cần ít nhất 2 bài trong queue để trộn!');
            }

            try {
                // Shuffle queue (giữ bài đang phát ở vị trí đầu)
                shuffleQueue.shuffle();
                
                const embed = new EmbedBuilder()
                    .setTitle('🔀 Đã trộn queue!')
                    .setDescription(`Đã trộn ngẫu nhiên ${shuffleQueue.songs.length} bài hát`)
                    .setColor('#ff6b35')
                    .addFields(
                        { name: 'Bài tiếp theo', value: shuffleQueue.songs[1]?.name || 'Không có', inline: true },
                        { name: 'Tổng bài', value: `${shuffleQueue.songs.length}`, inline: true }
                    );

                message.channel.send({ embeds: [embed] });
            } catch (error) {
                message.reply('❌ Không thể trộn queue!');
            }
            break;

        case 'repeat':
        case 'loop':
            const repeatQueue = distube.getQueue(message.guild.id);
            if (!repeatQueue) {
                return message.reply('❌ Không có bài hát nào đang phát!');
            }

            const mode = args[0];
            let repeatMode;
            let modeText;
            let modeColor;

            if (mode === 'off' || mode === '0') {
                repeatMode = 0;
                modeText = 'Tắt repeat';
                modeColor = '#6c757d';
            } else if (mode === 'song' || mode === '1') {
                repeatMode = 1;
                modeText = 'Repeat bài hiện tại';
                modeColor = '#28a745';
            } else if (mode === 'queue' || mode === '2') {
                repeatMode = 2;
                modeText = 'Repeat toàn bộ queue';
                modeColor = '#007bff';
            } else {
                // Toggle mode nếu không có tham số
                repeatMode = (repeatQueue.repeatMode + 1) % 3;
                const modes = ['Tắt repeat', 'Repeat bài hiện tại', 'Repeat toàn bộ queue'];
                const colors = ['#6c757d', '#28a745', '#007bff'];
                modeText = modes[repeatMode];
                modeColor = colors[repeatMode];
            }

            try {
                distube.setRepeatMode(message.guild.id, repeatMode);
                
                const embed = new EmbedBuilder()
                    .setTitle('🔁 Đã thay đổi chế độ repeat')
                    .setDescription(`**${modeText}**`)
                    .setColor(modeColor)
                    .addFields({
                        name: 'Hướng dẫn',
                        value: '`!repeat off/0` - Tắt\n`!repeat song/1` - Repeat bài\n`!repeat queue/2` - Repeat queue\n`!repeat` - Chuyển đổi',
                        inline: false
                    });

                message.channel.send({ embeds: [embed] });
            } catch (error) {
                message.reply('❌ Không thể thay đổi chế độ repeat!');
            }
            break;

        case 'autoplay':
            const autoQueue = distube.getQueue(message.guild.id);
            if (!autoQueue) {
                return message.reply('❌ Không có bài hát nào đang phát!');
            }

            try {
                const newAutoplay = !autoQueue.autoplay;
                distube.toggleAutoplay(message.guild.id);
                
                const embed = new EmbedBuilder()
                    .setTitle('🎵 Autoplay')
                    .setDescription(`**${newAutoplay ? 'Bật' : 'Tắt'} autoplay**`)
                    .setColor(newAutoplay ? '#28a745' : '#6c757d')
                    .addFields({
                        name: 'Mô tả',
                        value: newAutoplay ? 
                            'Bot sẽ tự động thêm bài liên quan khi queue hết' : 
                            'Bot sẽ dừng khi queue hết',
                        inline: false
                    });

                message.channel.send({ embeds: [embed] });
            } catch (error) {
                message.reply('❌ Không thể thay đổi chế độ autoplay!');
            }
            break;

        case 'autoshuffle':
            const shuffleAutoQueue = distube.getQueue(message.guild.id);
            if (!shuffleAutoQueue) {
                return message.reply('❌ Không có bài hát nào đang phát!');
            }

            // Toggle auto-shuffle setting in queue
            shuffleAutoQueue.autoShuffle = !shuffleAutoQueue.autoShuffle;
            
            const embed = new EmbedBuilder()
                .setTitle('🔀 Auto Shuffle')
                .setDescription(`**${shuffleAutoQueue.autoShuffle ? 'Bật' : 'Tắt'} auto shuffle**`)
                .setColor(shuffleAutoQueue.autoShuffle ? '#ff6b35' : '#6c757d')
                .addFields({
                    name: 'Mô tả',
                    value: shuffleAutoQueue.autoShuffle ? 
                        'Queue sẽ tự động trộn lại sau mỗi vòng lặp (khi repeat queue)' : 
                        'Tắt tự động trộn queue',
                    inline: false
                })
                .addFields({
                    name: 'Tip',
                    value: 'Kết hợp với `!repeat queue` để phát 24/7 với thứ tự ngẫu nhiên!',
                    inline: false
                });

            message.channel.send({ embeds: [embed] });
            break;

        case '24h':
        case '24/7':
            const queue247 = distube.getQueue(message.guild.id);
            if (!queue247) {
                return message.reply('❌ Cần có ít nhất 1 bài trong queue trước!');
            }

            if (queue247.songs.length < 2) {
                return message.reply('❌ Cần ít nhất 2 bài để thiết lập phát 24/7!');
            }

            // Setup 24/7 mode
            try {
                distube.setRepeatMode(message.guild.id, 2); // Repeat queue
                queue247.shuffle(); // Shuffle ngay
                queue247.autoShuffle = true; // Enable auto shuffle
                
                const embed247 = new EmbedBuilder()
                    .setTitle('🎵 Chế độ 24/7 đã bật!')
                    .setDescription('**Bot sẽ phát nhạc liên tục với thứ tự ngẫu nhiên**')
                    .setColor('#00ff00')
                    .addFields(
                        { name: '🔁 Repeat Mode', value: 'Queue (Lặp toàn bộ)', inline: true },
                        { name: '🔀 Shuffle', value: 'Tự động trộn mỗi vòng', inline: true },
                        { name: '🎵 Số bài', value: `${queue247.songs.length}`, inline: true }
                    )
                    .addFields({
                        name: '⚙️ Thiết lập đã bật',
                        value: '✅ Repeat Queue\n✅ Auto Shuffle\n✅ Continuous Play',
                        inline: false
                    })
                    .addFields({
                        name: '🛑 Để tắt',
                        value: '`!stop` hoặc `!repeat off`',
                        inline: false
                    });

                message.channel.send({ embeds: [embed247] });
            } catch (error) {
                message.reply('❌ Không thể thiết lập chế độ 24/7!');
            }
            break;

        case 'help':
        case 'h':
            const helpEmbed = new EmbedBuilder()
                .setTitle('🎵 Hướng dẫn sử dụng Bot Music')
                .setDescription('**Hỗ trợ YouTube & Spotify** 🎶')
                .addFields(
                    { name: '🎵 Phát nhạc', value: `\`${config.prefix}play <URL/Tên bài>\`\nHỗ trợ: YouTube URL, Spotify URL (songs/playlists), tìm kiếm tên bài`, inline: false },
                    { name: '⏯️ Điều khiển cơ bản', value: `\`${config.prefix}skip\` - Skip bài hiện tại\n\`${config.prefix}stop\` - Dừng và xóa queue\n\`${config.prefix}pause\` - Tạm dừng/tiếp tục`, inline: false },
                    { name: '🔀 Điều khiển nâng cao', value: `\`${config.prefix}shuffle\` - Trộn queue ngẫu nhiên\n\`${config.prefix}repeat [off/song/queue]\` - Chế độ lặp\n\`${config.prefix}autoplay\` - Tự động thêm bài liên quan\n\`${config.prefix}autoshuffle\` - Tự động trộn mỗi vòng lặp`, inline: false },
                    { name: '🎵 Chế độ đặc biệt', value: `\`${config.prefix}24/7\` - **Phát 24/7 với trộn bài**\n(Tự động bật repeat queue + auto shuffle)`, inline: false },
                    { name: '🔊 Âm thanh', value: `\`${config.prefix}volume <0-100>\` - Điều chỉnh âm lượng`, inline: false },
                    { name: '📋 Thông tin', value: `\`${config.prefix}queue\` - Xem queue\n\`${config.prefix}nowplaying\` - Bài đang phát\n\`${config.prefix}help\` - Menu này`, inline: false },
                    { name: '🎶 Ví dụ Spotify', value: `\`${config.prefix}play https://open.spotify.com/track/...\`\n\`${config.prefix}play https://open.spotify.com/playlist/...\``, inline: false }
                )
                .setColor('#1db954')
                .setFooter({ text: 'Bot Music Discord - YouTube & Spotify Support' });

            message.channel.send({ embeds: [helpEmbed] });
            break;

        default:
            message.reply(`❌ Lệnh không tồn tại! Sử dụng \`${config.prefix}help\` để xem danh sách lệnh.`);
    }
});

// Xử lý lỗi
client.on('error', error => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

// Đăng nhập bot
client.login(config.token).catch(error => {
    console.error('❌ Không thể đăng nhập bot! Kiểm tra lại token:', error);
    process.exit(1);
});
