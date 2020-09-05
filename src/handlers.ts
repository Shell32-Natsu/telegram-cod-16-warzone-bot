import TelegramBot from "node-telegram-bot-api";
import CallOfDutyApi from "call-of-duty-api";

const API = CallOfDutyApi({
  ratelimit: { maxRequests: 2, perMilliseconds: 1000, maxRPS: 2 },
});

type HandlerRespType = "text" | "file";

type HandlerResp = {
  resp: string;
  type: HandlerRespType;
  fileName?: string;
  contentType?: string;
};

type Handler = (msg: TelegramBot.Message) => Promise<HandlerResp>;

const router = new Map<string, Handler>([
  ["user", UserInfoHandler],
  ["userRaw", UserInfoRawHandler],
]);

// command text format: /cmd arg1 arg2 ...
export function getHandler(message: TelegramBot.Message): Handler {
  const text = message.text;
  if (!text) {
    return unknownCommand;
  }
  let command = getCommand(text);
  if (!command.startsWith("/")) {
    return emptyHandler;
  }
  command = command.substring(1);
  if (!router.has(command)) {
    return unknownCommand;
  }
  return router.get(command)!;
}

export async function login(email: string, password: string) {
  await API.login(email, password);
}

function getCommand(text: string | undefined): string {
  if (!text) return "";
  return text.split(" ")[0];
}

function getArgs(text: string | undefined): string[] {
  if (!text) return [];
  return text.split(" ").slice(1);
}

function getPlatform(p: string) {
  switch (p) {
    case "battle":
      return API.platforms.battle;
    case "psn":
      return API.platforms.psn;
    case "xbl":
      return API.platforms.xbl;
    default:
      return API.platforms.all;
  }
}

function constructUserInfo(data: any) {
  return `\`\`\`
---
ALL
---
User: ${data.username}
Game played: ${data.lifetime.mode.br.properties.gamesPlayed}
Wins: ${data.lifetime.mode.br.properties.wins}
Kills: ${data.lifetime.mode.br.properties.kills}
Deaths: ${data.lifetime.mode.br.properties.deaths}
Downs: ${data.lifetime.mode.br.properties.downs}
K/D: ${data.lifetime.mode.br.properties.kdRatio}
Top 5: ${data.lifetime.mode.br.properties.topFive}
Top 10: ${data.lifetime.mode.br.properties.topTen}
Top 25: ${data.lifetime.mode.br.properties.topTwentyFive}
Accuracy (MP and WZ): ${data.lifetime.all.properties.accuracy}
---
Last week
---
Kills: ${data.weekly.mode.br_all.properties.kills}
Deaths: ${data.weekly.mode.br_all.properties.deaths}
K/D: ${data.weekly.mode.br_all.properties.kdRatio}
Gulag deaths: ${data.weekly.mode.br_all.properties.gulagDeaths}
Gulag kills: ${data.weekly.mode.br_all.properties.gulagKills}
Team wiped: ${data.weekly.mode.br_all.properties.objectiveTeamWiped}
Headshots: ${data.weekly.mode.br_all.properties.headshots}
Headshot percentage: ${data.weekly.mode.br_all.properties.headshotPercentage}
Kills per game: ${data.weekly.mode.br_all.properties.killsPerGame}
Damage done: ${data.weekly.mode.br_all.properties.damageDone}
Damage taken: ${data.weekly.mode.br_all.properties.damageTaken}
\`\`\`
`;
}

async function UserInfoHandler(
  message: TelegramBot.Message
): Promise<HandlerResp> {
  const args = getArgs(message.text);
  if (args.length !== 2) {
    return {
      resp: `Error: invalid arguments: ${args}`,
      type: "text",
    };
  }
  const [platform, user] = args;
  const data = await API.MWwzstats(user, getPlatform(platform));
  return {
    resp: constructUserInfo(data),
    type: "text",
  };
}

async function UserInfoRawHandler(
  message: TelegramBot.Message
): Promise<HandlerResp> {
  const args = getArgs(message.text);
  if (args.length !== 2) {
    return {
      resp: `Error: invalid arguments: ${args}`,
      type: "text",
    };
  }
  const [platform, user] = args;
  const data = await API.MWwzstats(user, getPlatform(platform));
  return {
    resp: JSON.stringify(data, null, 2),
    type: "file",
    fileName: "userData.json",
    contentType: "text/json",
  };
}

async function unknownCommand(
  message: TelegramBot.Message
): Promise<HandlerResp> {
  const command = getCommand(message.text!);
  return {
    resp: `unknown command: ${command}`,
    type: "text",
  };
}

async function emptyHandler(): Promise<HandlerResp> {
  return {
    resp: "",
    type: "text",
  };
}
