import TelegramBot from "node-telegram-bot-api";
import { exit, hasUncaughtExceptionCaptureCallback } from "process";
import { ArgumentParser } from "argparse";
import readline from "readline";
import { readFileSync, fstat } from "fs";
import { getHandler, login } from "./handlers";

const parser = new ArgumentParser({
  description: "Telegram COD 16 Warzone Data Bot",
});

parser.add_argument("--local", {
  default: "false",
  choices: ["false", "true"],
});
parser.add_argument("--config", {
  required: true,
});

function auth(id: string | undefined, adminId: string[]): boolean {
  if (id === undefined) return false;
  return adminId.indexOf(id) !== -1;
}

type Config = {
  BOT_TOKEN: string;
  ACTIVISION_PASSWORD: string;
  ACTIVISION_EMAIL: string;
  ADMIN_ID: string[];
};

function getConfig(path: string): Config {
  return JSON.parse(readFileSync(path).toString()) as Config;
}

async function localMain() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  while (true) {
    const answer = await new Promise((resolve) =>
      rl.question("Command: ", (answer) => resolve(answer))
    );
    if (answer === "") break;
    const message = {
      text: answer,
      message_id: 0,
      date: 0,
      chat: {
        id: 0,
        type: "private",
      },
    } as TelegramBot.Message;
    const h = getHandler(message);
    const resp = await h(message);
    console.log(resp);
  }
}

async function main() {
  const args = parser.parse_args();
  const config = getConfig(args.config);
  const TOKEN = config.BOT_TOKEN;

  if (TOKEN === undefined) {
    console.error("No bot token provided");
    exit();
  }

  const bot = new TelegramBot(TOKEN, { polling: true });

  await login(config.ACTIVISION_EMAIL, config.ACTIVISION_PASSWORD);

  if (args.local === "true") {
    await localMain();
    return;
  }

  // query a user information
  bot.on(
    "message",
    async (message: TelegramBot.Message, metadata: TelegramBot.Metadata) => {
      if (!auth(message.from?.id.toString(), config.ADMIN_ID)) return;
      const chatId = message.chat.id;
      if (metadata.type !== "text") {
        bot.sendMessage(chatId, `Unsupport type: ${metadata.type}`);
        return;
      }
      let resp;
      try {
        const h = getHandler(message);
        resp = await h(message);
        if (resp.resp.length === 0) {
          return;
        }
      } catch (err) {
        bot.sendMessage(chatId, `Error: ${err}`);
        return;
      }
      if (resp.type === "text")
        bot.sendMessage(chatId, resp.resp, {
          parse_mode: "MarkdownV2",
        });
      else
        bot.sendDocument(
          chatId,
          Buffer.from(resp.resp),
          {},
          {
            filename: resp.fileName,
            contentType: resp.contentType,
          }
        );
    }
  );
}

main().catch((err) => {
  console.error(err);
  exit(1);
});
