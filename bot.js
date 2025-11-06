import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from "discord.js";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY;
const POLLINATIONS_TEXT_URL = "https://enter.pollinations.ai/api/generate/v1";
const POLLINATIONS_IMAGE_URL = "https://enter.pollinations.ai/api/generate/image";

// Slash command setup
const commands = [
  new SlashCommandBuilder()
    .setName("imagine")
    .setDescription("Generate an image using Pollinations")
    .addStringOption(opt =>
      opt.setName("prompt").setDescription("Describe your image").setRequired(true)
    ),
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

// Register slash commands globally
(async () => {
  try {
    console.log("Registering /imagine...");
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log("✅ Slash command registered.");
  } catch (err) {
    console.error("❌ Slash command registration failed:", err);
  }
})();

// Handle normal messages → text generation
client.on("messageCreate", async message => {
  if (message.author.bot) return;

  try {
    const response = await fetch(POLLINATIONS_TEXT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${POLLINATIONS_API_KEY}`,
      },
      body: JSON.stringify({
        prompt: message.content,
        max_tokens: 200, // adjust as needed
        model: "pollinations-text-v1" // optional; check docs for exact model name
      }),
    });

    const data = await response.json();
    const replyText = data?.text || data?.result || "🤔 No text returned.";

    await message.reply(replyText);
  } catch (err) {
    console.error("Text generation error:", err);
    await message.reply("❌ Could not reach Pollinations API.");
  }
});

// Handle /imagine → image generation
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === "imagine") {
    const prompt = interaction.options.getString("prompt");
    try {
      await interaction.deferReply(); // show "thinking..." indicator

      const response = await fetch(POLLINATIONS_IMAGE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${POLLINATIONS_API_KEY}`,
        },
        body: JSON.stringify({
          prompt: prompt,
          width: 1024,
          height: 1024,
          model: "pollinations-image-v1" // optional; check docs
        }),
      });

      const data = await response.json();
      const imageUrl = data?.url || data?.image || data?.images?.[0];

      if (!imageUrl) {
        await interaction.editReply("❌ No image returned from Pollinations API.");
        return;
      }

      await interaction.editReply({
        content: `🖼️ **${prompt}**\n${imageUrl}`,
      });
    } catch (err) {
      console.error("Image generation error:", err);
      await interaction.editReply("❌ Error generating image with Pollinations API.");
    }
  }
});

client.once("ready", () => console.log(`🤖 Logged in as ${client.user.tag}`));
client.login(process.env.DISCORD_TOKEN);
