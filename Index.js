const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const ffmpeg = require('fluent-ffmpeg');
const os = require('os');

// ✅ توكن البوت هنا (للاستخدام التجريبي فقط)
const BOT_TOKEN = '7892395794:AAHy-_f_ej0IT0ZLF1jzdXJDMccLiCrMrZA';
const bot = new Telegraf(BOT_TOKEN);

// مجلد مؤقت داخل النظام (يُحذف تلقائيًا بعد الإيقاف)
const audioDir = os.tmpdir();
const userAudios = {};

// تحميل وحفظ الملف مؤقتًا
async function downloadFile(fileUrl, destPath) {
  const res = await fetch(fileUrl);
  const dest = fs.createWriteStream(destPath);
  await new Promise((resolve, reject) => {
    res.body.pipe(dest);
    res.body.on("end", resolve);
    res.body.on("error", reject);
  });
}

// استقبال الرسائل الصوتية
bot.on('voice', async (ctx) => {
  const userId = ctx.from.id;
  if (!userAudios[userId]) userAudios[userId] = [];

  try {
    const file = await ctx.telegram.getFile(ctx.message.voice.file_id);
    const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
    const filename = `audio_${userId}_${Date.now()}.ogg`;
    const filepath = path.join(audioDir, filename);

    await downloadFile(url, filepath);
    userAudios[userId].push(filepath);

    await ctx.reply(`📥 تم استلام المقطع رقم ${userAudios[userId].length}`);

    if (userAudios[userId].length >= 2) {
      await ctx.reply("🔄 جاري دمج المقاطع، الرجاء الانتظار...");

      const outputPath = path.join(audioDir, `merged_${userId}_${Date.now()}.mp3`);
      const command = ffmpeg();

      userAudios[userId].forEach(file => command.input(file));

      command
        .on('error', async (err) => {
          console.error('FFmpeg error:', err.message);
          await ctx.reply('❌ حدث خطأ أثناء الدمج.');
          cleanupFiles([...userAudios[userId], outputPath]);
          delete userAudios[userId];
        })
        .on('end', async () => {
          await ctx.replyWithAudio({ source: outputPath });
          cleanupFiles([...userAudios[userId], outputPath]);
          delete userAudios[userId];
        })
        .mergeToFile(outputPath, audioDir);
    }

  } catch (err) {
    console.error("❌ Error:", err.message);
    await ctx.reply("⚠️ حدث خلل أثناء تحميل الملف.");
  }
});

// حذف الملفات بعد الدمج
function cleanupFiles(paths) {
  for (const file of paths) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
}

bot.launch();
console.log("✅ البوت شغّال الآن.");
